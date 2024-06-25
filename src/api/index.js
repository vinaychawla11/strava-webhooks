'use strict';

const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const cron = require('node-cron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
require('dotenv').config();

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const clientId = process.env.STRAVA_CLIENT_ID;
const clientSecret = process.env.STRAVA_CLIENT_SECRET;
const redirectUri = process.env.REDIRECT_URI;

// Encryption key and algorithm
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const algorithm = 'aes-256-cbc';

// Ensure tokens directory exists
const tokensDir = './tokens';
if (!fs.existsSync(tokensDir)){
    fs.mkdirSync(tokensDir);
}

// Function to encrypt data
function encryptData(data) {
    const cipher = crypto.createCipher(algorithm, ENCRYPTION_KEY);
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
}

// Function to decrypt data
function decryptData(encryptedData) {
    const decipher = crypto.createDecipher(algorithm, ENCRYPTION_KEY);
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted);
}

// Function to save tokens
function saveTokens(ownerId, tokens) {
    const encryptedTokens = encryptData(tokens);
    fs.writeFileSync(`${tokensDir}/${ownerId}.enc`, encryptedTokens);
}

// Function to get tokens
function getTokens(ownerId) {
    try {
        const encryptedTokens = fs.readFileSync(`${tokensDir}/${ownerId}.enc`, 'utf8');
        return decryptData(encryptedTokens);
    } catch (error) {
        console.error('Error reading tokens:', error);
        return null;
    }
}

// Function to get all owner IDs
function getAllOwnerIds() {
    return fs.readdirSync(tokensDir)
        .filter(file => file.endsWith('.enc'))
        .map(file => file.replace('.enc', ''));
}


// Function to get all owner IDs
function getAllOwnerIds() {
    return fs.readdirSync(tokensDir)
        .filter(file => file.endsWith('.enc'))
        .map(file => file.replace('.enc', ''));
}

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

        const ownerId = response.data.athlete.id;

        saveTokens(ownerId, {
            access_token: response.data.access_token,
            refresh_token: response.data.refresh_token,
            expires_at: response.data.expires_at,
        });

        console.log('New Access Token:', response.data.access_token);
        console.log('New Refresh Token:', response.data.refresh_token);
        console.log('Expires At:', response.data.expires_at);

        res.send('Authorization successful! You can now close this window.');
    } catch (error) {
        console.error('Error exchanging authorization code:', error);
        res.status(500).send('Internal Server Error');
    }
});

async function refreshAccessToken(ownerId) {
    try {
        const tokens = getTokens(ownerId);
        if (!tokens) {
            throw new Error('Tokens not found');
        }

        const response = await axios.post('https://www.strava.com/oauth/token', {
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: 'refresh_token',
            refresh_token: tokens.refresh_token,
        });

        saveTokens(ownerId, {
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
            expiresAt: response.data.expires_at,
        };
    } catch (error) {
        console.error('Error refreshing access token:', error);
        throw error;
    }
}

cron.schedule('0 * * * *', async () => {
    const currentTime = Math.floor(Date.now() / 1000);
    const ownerIds = getAllOwnerIds();
    for (const ownerId of ownerIds) {
        const tokens = getTokens(ownerId);
        if (tokens && currentTime >= tokens.expires_at - 300) {
            await refreshAccessToken(ownerId);
        }
    }
});

app.post('/webhook', async (req, res) => {
    const aspectType = req.body.aspect_type;
    const objectId = req.body.object_id;
    const ownerId = req.body.owner_id;
    console.log("Webhook event received!", req.query, req.body);

    if (aspectType === 'create' || aspectType === 'update') {
        try {
            const tokens = getTokens(ownerId);
            if (!tokens) {
                throw new Error('Tokens not found');
            }

            const access_token = tokens.access_token;
            console.log("access token", access_token);

            const response = await axios.get(`https://www.strava.com/api/v3/activities/${objectId}`, {
                headers: {
                    'Authorization': `Bearer ${access_token}`
                }
            });

            const { distance, type } = response.data;
            console.log('On my way to update the privacy if needed:', distance);
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
