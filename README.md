# Strava API Integration with Express.js

This repository provides an Express.js service to handle Strava OAuth2 authorization, manage user tokens, and process Strava webhook events. It includes automatic token refreshing and activity updates based on specific criteria.

## Features

This service provides an integration with the Strava API to:

    Authorize users via OAuth2.
    Handle OAuth2 callback and token exchange.
    Manage user access and refresh tokens.
    Process Strava webhook events to update activities based on criteria.
    Automatically refresh access tokens.

## Prerequisites

- Node.js (>=12.x)
- npm (>=6.x)
- A Strava Developer account
- A registered Strava application


## Setup

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/strava-api-integration.git
cd strava-api-integration
```

### 2. Install Dependencies

```bash
npm install
```
### 3. Create Environment Variables File

Create a `.env` file in the root of the project with the following content:

```plaintext
STRAVA_CLIENT_ID=your_strava_client_id
STRAVA_CLIENT_SECRET=your_strava_client_secret
REDIRECT_URI=your_redirect_uri
SESSION_SECRET=your_generated_secret
PORT=your_desired_port (optional, default is 80)
```


### 4. Run the Application

```bash
node index.js
```

The server will start listening on the specified port (default is 80).

## Environment Variables

    STRAVA_CLIENT_ID: Your Strava API client ID.
    STRAVA_CLIENT_SECRET: Your Strava API client secret.
    REDIRECT_URI: The URI Strava redirects to after authorization.
    SESSION_SECRET: A secure secret for session handling.
    PORT: Port to run the server (default: 80).

## Endpoints

### Authorization

`GET /authorize`: Redirects the user to the Strava authorization URL.

### Callback

`GET /callback`: Handles the OAuth callback from Strava, exchanges the authorization code for access and refresh tokens, and stores them.

### Webhook

- `GET /webhook`: Verifies the webhook subscription with Strava.
- `POST /webhook`: Receives and processes webhook events from Strava, updates activity privacy based on criteria.

### Root

`GET /`: Provides a link to start the authorization process.

## Token Management

A cron job is scheduled to run every hour to check the token expiration and refresh it if necessary. Tokens and their expiration time are securely managed using Firebase Firestore.

## Webhook Event Handling

The application processes create and update events from Strava to fetch activity details. If an activity is a "Ride" and its distance is less than 5 km, the privacy is updated.

## Example Usage

1. **Start the Authorization Process**: Navigate to `http://your-server-url/` and click the "Authorize with Strava" link.
2. **Complete Authorization**: Authorize the application on Strava, which will redirect you back to your server.
3. **Webhook Events**: Configure your Strava application to send webhook events to `http://your-server-url/webhook`.

## License

This project is licensed under the MIT License.
```

### Additional Improvements and Addons

1. **Error Handling**: Improve error handling and logging using libraries like `winston` for better insight into the application's behavior.
2. **Testing**: Add unit and integration tests to ensure the application works as expected.
3. **CI/CD**: Set up continuous integration and deployment pipelines using tools like GitHub Actions, Travis CI, or Jenkins.
4. **Documentation**: Expand the README to include more detailed setup instructions, examples, and API documentation.
5. **Monitoring**: Integrate monitoring tools like Prometheus and Grafana to track the application's performance and health.

By incorporating these additional improvements, you can enhance the security, reliability, and maintainability of your project.