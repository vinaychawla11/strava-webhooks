# Strava API Integration with Express.js

This application integrates with the Strava API using Express.js to handle OAuth authorization, token management, and webhook events. The application supports periodic token refreshing using a cron job and updates activity privacy based on specific criteria.
Features

    OAuth authorization with Strava
    Token management and refreshing
    Handling Strava webhook events
    Updating activity privacy based on distance and type
    Environmental variable management with .env file

## Prerequisites

    Node.js (>=12.x)
    npm (>=6.x)
    A Strava Developer account
    A registered Strava application

## Setup
1. Clone the Repository

        git clone https://github.com/yourusername/strava-api-integration.git

        cd strava-api-integration

2. Install Dependencies



        npm install

3. Configure Environment Variables

**Create a .env file in the root of the project and add your Strava API credentials and other configuration details:**

        CLIENT_ID=your_strava_client_id

        CLIENT_SECRET=your_strava_client_secret

        REDIRECT_URI=your_redirect_uri

        PORT=your_server_port

4. Run the Application

        node app.js

The server will start listening on the specified port (default is 80).

# Endpoints
## Authorization

    GET /authorize: Redirects the user to the Strava authorization URL.

## Callback

    GET /callback: Handles the OAuth callback from Strava, exchanges the authorization code for access and refresh tokens, and stores them.

## Webhook

    GET /webhook: Verifies the webhook subscription with Strava.
    POST /webhook: Receives and processes webhook events from Strava, updates activity privacy based on criteria.

## Root

    GET /: Provides a link to start the authorization process.

## Token Management

A cron job is scheduled to run every hour to check the token expiration and refresh it if necessary. Tokens and their expiration time are stored in the .env file.
Webhook Event Handling

The application processes create and update events from Strava to fetch activity details. If an activity is a "Ride" and its distance is less than 5 km, the privacy is updated.

## Example Usage

    Start the Authorization Process: Navigate to http://your-server-url/ and click the "Authorize with Strava" link.

    Complete Authorization: Authorize the application on Strava, which will redirect you back to your server.

    Webhook Events: Configure your Strava application to send webhook events to http://your-server-url/webhook.
## License

This project is licensed under the MIT License.
