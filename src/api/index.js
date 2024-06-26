'use strict';

const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const cron = require('node-cron');
const path = require('path');
const admin = require('firebase-admin');
require('dotenv').config();

const app = express();

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

// Initialize Firebase Admin SDK with the service account and database URL
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL
});

// Access Firestore
const db = admin.firestore();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const clientId = process.env.STRAVA_CLIENT_ID;
const clientSecret = process.env.STRAVA_CLIENT_SECRET;
const redirectUri = process.env.REDIRECT_URI;

// Function to save tokens in Firebase Firestore
async function saveTokens(ownerId, tokens) {
  const docRef = db.collection('secrets').doc(ownerId);
  await docRef.set(tokens);
}

// Function to get tokens from Firebase Firestore
async function getTokens(ownerId) {
  const docRef = db.collection('secrets').doc(ownerId);
  const doc = await docRef.get();
  if (!doc.exists) {
    console.error('No such document!');
    return null;
  } else {
    return doc.data();
  }
}

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// Serve the index.html file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

// Step 1: Redirect to Strava authorization URL
app.get('/authorize', async (req, res) => {
  try {
    const authorizationUrl = `https://www.strava.com/oauth/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&scope=read_all,activity:read_all,activity:write&approval_prompt=auto`;
    res.redirect(authorizationUrl);
  } catch (error) {
    console.error('Error redirecting to Strava:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Step 2: Handle callback from Strava OAuth
app.get('/callback', async (req, res) => {
  const authorizationCode = req.query.code;
  try {
    const response = await axios.post('https://www.strava.com/oauth/token', {
      client_id: clientId,
      client_secret: clientSecret,
      code: authorizationCode,
      grant_type: 'authorization_code',
    });

    const ownerId = response.data.athlete.id;

    // Save tokens to Firestore
    await saveTokens(ownerId, {
      access_token: response.data.access_token,
      refresh_token: response.data.refresh_token,
      expires_at: response.data.expires_at,
    });

    console.log('New Access Token:', response.data.access_token);
    console.log('New Refresh Token:', response.data.refresh_token);
    console.log('Expires At:', response.data.expires_at);

    res.json({
      access_token: response.data.access_token,
      expires_at: response.data.expires_at,
      owner_id: ownerId
    });
  } catch (error) {
    console.error('Error exchanging authorization code:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Function to refresh access token
async function refreshAccessToken(ownerId) {
  try {
    const tokens = await getTokens(ownerId);
    if (!tokens) {
      throw new Error('Tokens not found');
    }

    const response = await axios.post('https://www.strava.com/oauth/token', {
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: tokens.refresh_token,
    });

    await saveTokens(ownerId, {
      access_token: response.data.access_token,
      refresh_token: response.data.refresh_token,
      expires_at: response.data.expires_at,
    });

    console.log('New Access Token:', response.data.access_token);
    console.log('New Refresh Token:', response.data.refresh_token);
    console.log('Expires At:', response.data.expires_at);

    return {
      access_token: response.data.access_token,
      refresh_token: response.data.refresh_token,
      expires_at: response.data.expires_at,
    };
  } catch (error) {
    console.error('Error refreshing access token:', error);
    throw error;
  }
}

// Cron job to refresh tokens
cron.schedule('0 * * * *', async () => {
  const currentTime = Math.floor(Date.now() / 1000);
  const secretsSnapshot = await db.collection('secrets').get();
  const ownerIds = secretsSnapshot.docs.map(doc => doc.id);
  for (const ownerId of ownerIds) {
    const tokens = await getTokens(ownerId);
    if (tokens && currentTime >= tokens.expires_at - 300) {
      await refreshAccessToken(ownerId);
    }
  }
});

// Handle incoming Strava webhook events
app.post('/webhook', async (req, res) => {
  const aspectType = req.body.aspect_type;
  const objectId = req.body.object_id;
  const ownerId = req.body.owner_id;

  console.log("Webhook event received:", req.body);

  // Handle only 'create' and 'update' events
  if (aspectType === 'create' || aspectType === 'update') {
    try {
      const tokens = await getTokens(ownerId);
      if (!tokens) {
        throw new Error('Tokens not found');
      }

      const access_token = tokens.access_token;

      // Example: Fetch activity details and update privacy if conditions met
      const response = await axios.get(`https://www.strava.com/api/v3/activities/${objectId}`, {
        headers: {
          'Authorization': `Bearer ${access_token}`
        }
      });

      const { distance, type } = response.data;

      if (distance < 5000 && type === 'Ride') {
        await axios.put(`https://www.strava.com/api/v3/activities/${objectId}`,
          { hide_from_home: true },
          {
            headers: {
              'Authorization': `Bearer ${access_token}`
            }
          }
        );
        console.log('Privacy updated successfully');
      } else {
        console.log("Privacy not updated");
      }

      res.status(200).send('Event processed');
    } catch (error) {
      console.error('Error processing webhook event:', error);
      res.status(500).send('Internal Server Error');
    }
  } else {
    res.status(200).send('Event type not handled');
  }
});


const port = process.env.PORT || 80;
app.listen(port, () => console.log(`Webhook is listening on port ${port}`));

/*app.get('/', (req, res) => {
    res.send('<a href="/authorize">Authorize with Strava</a>');
});*/
