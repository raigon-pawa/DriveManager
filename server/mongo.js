import { MongoClient } from 'mongodb';
import { error } from 'node:console';
import { google }  from 'googleapis';
import 'dotenv/config';

const { CLIENT_ID, CLIENT_SECRET, REDIRECT_URI, MONGO_URI, DATABASE_NAME, COLLECTION_NAME } = process.env;

const client = new MongoClient(MONGO_URI);

export const fetchAccountsFromDB = async () => {
  try {
    const collection = client.db(DATABASE_NAME).collection(COLLECTION_NAME);
    const accounts = await collection.find({}, { projection: { email: 1, id: 1, _id: 0 } }).toArray();
    return accounts; // Return the data for use elsewhere
  } catch (err) {
    throw new Error(`Failed to fetch accounts from DB: ${err.message}`);
  }
};

// This handles API requests
export const getAccountsFromDB = async (req, res) => {
  try {
    const accounts = await fetchAccountsFromDB();
    res.json(accounts); // Respond with accounts
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export async function refreshAccessToken(email) {
  try {
    const oauth2Client = new google.auth.OAuth2(
      CLIENT_ID,
      CLIENT_SECRET,
      REDIRECT_URI
    );

    const projection = { refresh_token: 1 }

    const collection = client.db(DATABASE_NAME).collection(COLLECTION_NAME);
    const data = await collection.findOne({ email }, { projection });

    oauth2Client.setCredentials({
      refresh_token: data.refresh_token,
    });

    const { token } = await oauth2Client.getAccessToken();

    return token;
  } catch (error) {
    console.error(error);
  }
};

export async function saveAccount(account) {

  try {
    const collection = client.db(DATABASE_NAME).collection(COLLECTION_NAME);

    const query = { email: account.email };
    const update = {
      $set: account,
    };
    const options = { upsert: true };
    const result = await collection.updateOne(query, update, options);

    return result
  } catch (e) {
    console.error("Error Saving Account:", e);
    return error
  }
  
}

export const deletesAccountFromDB =  async (req, res) => {
  try {
    const email = req.body.email;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const collection = client.db(DATABASE_NAME).collection(COLLECTION_NAME);
    const result = await collection.deleteOne({ email: email });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }

    res.json({ message: 'Account deleted successfully' });
  } catch (err) {
    console.error('Error deleting account:', err);
    res.status(500).json({ error: err.message });
  }
}

export async function initiateMongoDB() {
  try {
    await client.connect();
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error)
  }
}