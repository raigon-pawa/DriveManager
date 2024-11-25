import express from 'express';
import session from 'express-session';
import bodyParser from 'body-parser';
import cors from 'cors';
import 'dotenv/config'

import { googleAuthRoute, oauthCallbackRoute, getDriveFiles, initializeTokenStore } from './auth.js';
import { getAccountsFromDB, deletesAccountFromDB, initiateMongoDB } from './mongo.js';

const app = express();
const PORT = 8080;

app.use(bodyParser.json());
app.use(cors());

app.use(session({
  secret: process.env.SESSION_SECRET, // Replace with a strong secret
  resave: false,
  saveUninitialized: false,
}));


// Routes
app.get('/', googleAuthRoute); // Redirect to Google Auth
app.get('/oauth2callback', oauthCallbackRoute); // OAuth2 callback
app.get('/drive-files', getDriveFiles); // Fetch Google Drive files

app.get('/accounts', getAccountsFromDB);
app.delete('/accounts/delete', deletesAccountFromDB);

app.listen(PORT, async () => {
  await initiateMongoDB();
  await initializeTokenStore();
  try {
    console.log(`Server running on http://localhost:${PORT}`)
  } catch (error) {
    console.error('Failed to start backend:', error);
  }
});
