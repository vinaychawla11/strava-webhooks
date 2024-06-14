'use strict';

const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const cron = require('node-cron');
const { getUserSecrets, updateUserSecrets, addNewUser, getEnvVars } = require('./firebaseUtils.js');
const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Middleware to authenticate requests using Firebase Authentication
const authenticateUser = async (req, res, next) => {
  try {
    const idToken = req.headers.authorization.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Error authenticating user:', error);
    res.status(401).send('Unauthorized');
  }
};

// Step 1: When a https request is made to the /authorize endpoint, it redirects the user to the Strava authorization URL.
app.get('/authorize', authenticateUser, async (req, res) => {
  const userId = req.user.uid; // Get the user's UID from the authentication context
  // Retrieve user secrets from Firestore
  try {
    const { clientId, clientSecret } = await getUserSecrets(userId);
    const redirectUri= await getEnvVars();
    const userDoc = await db.collection('users').doc(userId).get();
    if (userDoc.exists) {
      await updateUserSecrets(userId,userDoc);
    }
    else {
      await addNewUser(userId, userDoc);
    }
    const authorizationUrl = `https://www.strava.com/oauth/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&scope=read_all,activity:read_all,activity:write&approval_prompt=auto`;
    res.redirect(authorizationUrl);
  } catch (error) {
    console.error('Error getting user secrets:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Step 2: Handle the redirect Uri callback from Strava
app.get('/callback', authenticateUser, async (req, res) => {
  const userId = req.user.uid; // Get the user's UID from the authentication context
  const authorizationCode = req.query.code; // Store the code obtained from the strava GET request

  try {
    const { clientId, clientSecret } = await getUserSecrets(userId);

    const response = await axios.post('https://www.strava.com/oauth/token', {
      client_id: clientId,
      client_secret: clientSecret,
      code: authorizationCode,
      grant_type: 'authorization_code',
    });

    // Update user secrets in Firestore with new tokens
    await updateUserSecrets(userId, {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresAt: response.data.expires_at,
    });

    res.send('Authorization successful! You can now close this window.');
  } catch (error) {
    console.error('Error exchanging authorization code:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Function to refresh the access token
async function refreshAccessToken(uid) {
  try {
    const { clientId, clientSecret, refreshToken } = await getUserSecrets(uid);

    const response = await axios.post('https://www.strava.com/oauth/token', {
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });

    // Update user secrets in Firestore with new tokens
    await updateUserSecrets(uid, {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresAt: response.data.expires_at,
    });

    console.log('New Access Token:', response.data.access_token);
    console.log('New Refresh Token:', response.data.refresh_token);
    console.log('Expires At:', response.data.expires_at);

    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresAt: response.data.expires_at,
    };
  } catch (error) {
    console.error('Error refreshing access token:', error);
    throw error;
  }
}

// Schedule token refresh to run before expiration every hour
cron.schedule('0 * * * *', async () => {
  const currentTime = Math.floor(Date.now() / 1000);
  if (currentTime >= expiresAt - 300) { // Refresh 5 minutes before expiration
    await refreshAccessToken();
  }
});
// Endpoint to handle the initial activity creation event and modify the activity if it meets the criteria - this is in reference to the Strava webhook events API
app.post('/webhook', async (req, res) => {
  const aspectType = req.body.aspect_type;
  const objectId = req.body.object_id;
  console.log("Webhook event received!", req.query, req.body);

  if (aspectType == 'create' || aspectType == 'update') {
    try {
      const { accessToken } = await getUserSecrets(userId); // Assuming you have a function to get access token for the user
      const response = await axios.get(`https://www.strava.com/api/v3/activities/${objectId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      const { distance, type } = response.data;
      console.log('On my way to update the privacy if needed:', distance);
      if (distance < 5000 && type === 'Ride') {
        await axios.put(`https://www.strava.com/api/v3/activities/${objectId}`, 
          { hide_from_home: true }, 
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`
            }
          }
        );
        console.log('Privacy updated successfully');
      } else {
        console.log("Nothing to update here");
      }

      return res.status(200).send('EVENT_RECEIVED');
    } catch (error) {
      console.error('Error:', error);
      return res.status(500).send('Internal Server Error');
    }
  } else {
    return res.status(200).send('Event type not handled');
  }
});

// Sets server port and logs message on success
const port = process.env.PORT || 80;
app.listen(port, () => console.log(`Webhook is listening on port ${port}`));

// Manually invoke the authorization URL
app.get('/', (req, res) => {
  res.send('<a href="/authorize">Authorize with Strava</a>');
});
