'use strict';

const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const cron = require('node-cron');
const path = require('path');
const cookieParser = require('cookie-parser');
require('dotenv').config();
const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

const clientId = process.env.STRAVA_CLIENT_ID;
const clientSecret = process.env.STRAVA_CLIENT_SECRET;
const redirectUri = process.env.REDIRECT_URI;

app.use(express.static(path.join(__dirname, '../public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

app.get('/authorize', async (req, res) => {
  try {
    const authorizationUrl = `https://www.strava.com/oauth/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&scope=read_all,activity:read_all,activity:write&approval_prompt=auto`;
    res.redirect(authorizationUrl);
  } catch (error) {
    console.error('Error getting user secrets:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/callback', async (req, res) => {
  const authorizationCode = req.query.code;
  try {
    const response = await axios.post('https://www.strava.com/oauth/token', {
      client_id: clientId,
      client_secret: clientSecret,
      code: authorizationCode,
      grant_type: 'authorization_code',
    });

    // Set tokens in HttpOnly cookies
    res.cookie('access_token', response.data.access_token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
    res.cookie('refresh_token', response.data.refresh_token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
    res.cookie('expires_at', response.data.expires_at, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });

    console.log('New Access Token:', response.data.access_token);
    console.log('New Refresh Token:', response.data.refresh_token);
    console.log('Expires At:', response.data.expires_at);

    res.send('Authorization successful! You can now close this window.');
  } catch (error) {
    console.error('Error exchanging authorization code:', error);
    res.status(500).send('Internal Server Error');
  }
});

async function refreshAccessToken(req, res) {
  try {
    const refreshToken = req.cookies.refresh_token;

    const response = await axios.post('https://www.strava.com/oauth/token', {
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });

    // Update cookies with new tokens
    res.cookie('access_token', response.data.access_token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
    res.cookie('refresh_token', response.data.refresh_token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
    res.cookie('expires_at', response.data.expires_at, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });

    console.log('New Access Token:', response.data.access_token);
    console.log('New Refresh Token:', response.data.refresh_token);
    console.log('Expires At:', response.data.expires_at);

    return {
      access_token: response.data.access_token,
      refresh_token: response.data.refresh_token,
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
  if (req.cookies.expires_at && currentTime >= req.cookies.expires_at - 300) { // Refresh 5 minutes before expiration
    await refreshAccessToken(req, res);
  }
});

app.post('/webhook', async (req, res) => {
  const aspectType = req.body.aspect_type;
  const objectId = req.body.object_id;
  console.log("Webhook event received!", req.query, req.body);

  if (aspectType === 'create' || aspectType === 'update') {
    try {
      const access_token = req.cookies.access_token;

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

const port = process.env.PORT || 80;
app.listen(port, () => console.log(`Webhook is listening on port ${port}`));

app.get('/', (req, res) => {
  res.send('<a href="/authorize">Authorize with Strava</a>');
});
