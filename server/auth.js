import { google }  from 'googleapis';
import crypto from 'node:crypto';
import 'dotenv/config';

const { OAuth2 } = google.auth;
const { CLIENT_ID, CLIENT_SECRET, REDIRECT_URI } = process.env;

import { fetchAccountsFromDB, refreshAccessToken, saveAccount } from './mongo.js'

const TOKEN_STORE = []; // Temporary in-memory store, better to use Redis/DB in production

const oAuth2Client = new OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

export const initializeTokenStore = async () => {
  try {
    const accounts = await fetchAccountsFromDB();
    for (const account of accounts) {
      // Check if the email is already in TOKEN_STORE to avoid duplicates
      const existingUserIndex = TOKEN_STORE.findIndex((entry) => entry.email === account.email);
      if (existingUserIndex === -1) {
        TOKEN_STORE.push({
          email: account.email,
          access_token: null, // Or fetch the latest access token if necessary
        });
      }
    }
  } catch (error) {
    console.error('Error initializing TOKEN_STORE:', error);
  }
};

export const googleAuthRoute = (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  req.session.state = state;

  const authorizationUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/drive.metadata.readonly'],
    prompt: 'consent',
    state: state,
  });
  res.redirect(authorizationUrl);
};

export const oauthCallbackRoute = async (req, res) => {
    try {
      const { code, state  } = req.query;

      if (!state || state !== req.session.state) {
        return res.status(400).send("Invalid state parameter");
      }
  
      req.session.state = null;

      const { tokens } = await oAuth2Client.getToken(code);
      oAuth2Client.setCredentials(tokens);
    
      const drive = google.drive({
        version: 'v2',
        auth: oAuth2Client
      });
    
      const user = await drive.about.get({ fields: 'user' });
    
      const userData = {
        id: user.data.user.permissionId,
        email: user.data.user.emailAddress,
        name: user.data.user.displayName,
        picture: user.data.user.picture.url,
        refresh_token: tokens.refresh_token
      }
      
      // Find if the email already exists in TOKEN_STORE
      const existingUserIndex = TOKEN_STORE.findIndex(
        (entry) => entry.email === userData.email
      );
      
      if (existingUserIndex !== -1) {
        // Update the access token for the existing email
        TOKEN_STORE[existingUserIndex].access_token = tokens.access_token;
      } else {
        // Add new entry for the user
        TOKEN_STORE.push({
          email: userData.email,
          access_token: tokens.access_token,
        });
      }
      
      await saveAccount(userData);
  
      res.redirect('http://localhost:3000/');
    } catch (e) {
      console.log('Error retrieving tokens:', e);
      res.status(500).send();
    }
};

export const getDriveFiles = async (req, res) => {
  try {
    const oauth2Client = new OAuth2(
      CLIENT_ID,
      CLIENT_SECRET,
      REDIRECT_URI
    );

    let files = [];

    if (TOKEN_STORE.length > 0) {
      for (const token of TOKEN_STORE) {
        oauth2Client.setCredentials({
          access_token: token.access_token,
        });

        try {
          // Attempt to list files with the current access token
          const drive = google.drive({ version: "v3", auth: oauth2Client });

          const response = await drive.files.list({
            pageSize: 1000,
            fields: "files(id, name, size, mimeType, parents)",
            orderBy: "folder,name",
          });

          if (response.status === 200) {
            files.push({
              email: token.email,
              drive: response.data.files,
            });
          }
        } catch (error) {
          // Check if the error is due to invalid/expired credentials
          if (error.response?.status === 401 || error.message.includes("Invalid Credentials") || TOKEN_STORE?.access_token == null) {

            // Fetch a new access token using your refresh logic
            const newAccessToken = await refreshAccessToken(token.email);

            const existingUserIndex = TOKEN_STORE.findIndex(
              (entry) => entry.email === token.email
            );

            if (existingUserIndex !== -1) {
              // Update the token in the store
              TOKEN_STORE[existingUserIndex].access_token = newAccessToken;
            } else {
              // Add new entry if not found
              TOKEN_STORE.push({
                email: token.email,
                access_token: newAccessToken,
              });
            }

            // Retry with the new access token
            oauth2Client.setCredentials({
              access_token: newAccessToken,
            });

            const drive = google.drive({ version: "v3", auth: oauth2Client });

            const response = await drive.files.list({
              pageSize: 1000,
              fields: "files(id, name, size, mimeType, parents)",
              orderBy: "folder,name",
            });

            files.push({
              email: token.email,
              drive: response.data.files,
            });
          } else {
            console.error(`Unhandled error for email: ${token.email}`, error);
            throw error; // Re-throw if it's an unhandled error
          } 
        }
      }

      res.json(files);
    } else {
      console.error("No Accounts found.");
      res.status(500).send("No Accounts found.");
    }
  } catch (error) {
    console.error("Error fetching Drive files:", error);
    res.status(500).send("Error fetching Drive files");
  }
};
