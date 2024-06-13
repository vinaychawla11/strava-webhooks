# Strava API Integration with Express.js

This application integrates with the Strava API using Express.js to handle OAuth authorization, token management, and webhook events. The application supports periodic token refreshing using a cron job and updates activity privacy based on specific criteria.

## Features

- OAuth authorization with Strava
- Token management and refreshing
- Handling Strava webhook events
- Updating activity privacy based on distance and type
- Secure credential management with Firebase Firestore

## Prerequisites

- Node.js (>=12.x)
- npm (>=6.x)
- A Strava Developer account
- A registered Strava application
- Firebase project with Firestore enabled
- Service account key for Firebase Admin SDK

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

### 3. Configure Firebase Firestore

1. Create a Firebase project at [Firebase Console](https://console.firebase.google.com/).
2. Enable Firestore in the project.
3. Generate a service account key:
    - Go to Project Settings -> Service accounts.
    - Generate a new private key and download the JSON file.
    - Save the JSON file in your project directory (e.g., `serviceAccountKey.json`).
4. Add your Strava API credentials to Firestore:
    - Go to Firestore Database in Firebase Console.
    - Create a collection named `secrets`.
    - Add a document with ID `strava-api-credentials` and fields `clientId`, `clientSecret`, `redirectUri`, and `port`.

### 4. Create Environment Variables File

Create a `.env` file in the root of the project with the following content:

```plaintext
PORT=your_server_port
```

### 5. Run the Application

```bash
node app.js
```

The server will start listening on the specified port (default is 80).

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
2. **Security Enhancements**: Use `helmet` for securing HTTP headers and `express-rate-limit` for rate limiting requests.
3. **Testing**: Add unit and integration tests to ensure the application works as expected.
4. **CI/CD**: Set up continuous integration and deployment pipelines using tools like GitHub Actions, Travis CI, or Jenkins.
5. **Documentation**: Expand the README to include more detailed setup instructions, examples, and API documentation.
6. **Monitoring**: Integrate monitoring tools like Prometheus and Grafana to track the application's performance and health.

By incorporating these additional improvements, you can enhance the security, reliability, and maintainability of your project.