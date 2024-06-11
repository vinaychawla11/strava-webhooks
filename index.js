'use strict';

const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const cron = require('node-cron');
require('dotenv').config();

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const clientId = process.env.CLIENT_ID;
const clientSecret = process.env.CLIENT_SECRET;
const redirectUri = process.env.REDIRECT_URI;
let accessToken;
let refreshToken;
let expiresAt;

// Step 1: When a https request is made to the /authorize endpoint, it redirects the user to the strava authorization URL. Refer bottom of this page where the default URL is being routed to the /Authorize endpoint.
app.get('/authorize', (req, res) => {
  const authorizationUrl = `https://www.strava.com/oauth/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&scope=read_all,activity:read_all,activity:write&approval_prompt=auto`;
  res.redirect(authorizationUrl);
});

// Step 2: Handle the redirect Uri callback from Strava -  https://developers.strava.com/docs/authentication/
app.get('/callback', async (req, res) => {
  const authorizationCode = req.query.code; // Store the code obtained from the strava GET request

  try {
    const response = await axios.post('https://www.strava.com/oauth/token', {
      client_id: clientId,
      client_secret: clientSecret,
      code: authorizationCode,
      grant_type: 'authorization_code',
    });

    accessToken = response.data.access_token;
    refreshToken = response.data.refresh_token;
    expiresAt = response.data.expires_at;

    console.log('Access Token:', accessToken);
    console.log('Refresh Token:', refreshToken);
    console.log('Expires At:', expiresAt);

    res.send('Authorization successful! You can now close this window.');

  } catch (error) {
    console.error('Error exchanging authorization code:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Function to refresh the access token 
async function refreshAccessToken() {
  try {
    const response = await axios.post('https://www.strava.com/oauth/token', {
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });

    accessToken = response.data.access_token;
    refreshToken = response.data.refresh_token;
    expiresAt = response.data.expires_at;

    console.log('New Access Token:', accessToken);
    console.log('New Refresh Token:', refreshToken);
    console.log('Expires At:', expiresAt);

    return {
      accessToken: accessToken,
      refreshToken: refreshToken,
      expiresAt: expiresAt,
    };
  } catch (error) {
    console.error('Error refreshing access token:', error);
    throw error;
  }
}

// Function to update .env file with new tokens
function updateEnvFile() {
  const fs = require('fs');
  const envData = `
CLIENT_ID=${clientId}
CLIENT_SECRET=${clientSecret}
REDIRECT_URI=${redirectUri}
ACCESS_TOKEN=${accessToken}
REFRESH_TOKEN=${refreshToken}
EXPIRES_AT=${expiresAt}
`;

  fs.writeFileSync('.env', envData);
}

// Schedule token refresh to run before expiration every hour 
cron.schedule('0 * * * *', async () => {
  const currentTime = Math.floor(Date.now() / 1000);
  if (currentTime >= expiresAt - 300) { // Refresh 5 minutes before expiration
    await refreshAccessToken();
  }
});

// Endpoint to handle the initial activity creation event and modify the activity if it meets the criteria - this is in reference to the strava webhook events API - https://developers.strava.com/docs/webhooks/
app.post('/webhook', async (req, res) => {
  const aspectType = req.body.aspect_type;
  const objectId = req.body.object_id;
  console.log("webhook event received!", req.query, req.body);

  if (aspectType == 'create' || aspectType == 'update') {
    try {
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
      }
      else{
        console.log("Nothing to update here")
      }

      return res.status(200).send('EVENT_RECEIVED');
    } catch (error) {
      console.error('Error:', error);
      return res.status(500).send('Internal Server Error');
    }
  }

 
});

// Endpoint for verifying webhook - Strava sends a request to this domain to see if the server is responsive before sending an event.
app.get('/webhook', (req, res) => {
  const VERIFY_TOKEN = "STRAVA";
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token && mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('WEBHOOK_VERIFIED');
    return res.status(200).json({ "hub.challenge": challenge });
  }

  return res.status(403).send('Forbidden');
});

// Sets server port and logs message on success
const port = process.env.PORT || 80;
app.listen(port, () => console.log(`Webhook is listening on port ${port}`));

// Manually invoke the authorization URL
app.get('/', (req, res) => {
  res.send('<a href="/authorize">Authorize with Strava</a>');
});
