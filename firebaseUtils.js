// firebaseUtils.js
const admin = require('firebase-admin');
require('dotenv').config();


//const serviceAccountKey = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
const serviceAccount = require('./serviceAccountKey.json');

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Function to get user secrets from Firestore based on UID
async function getUserSecrets(uid) {
  const userDoc = await db.collection('users').doc(uid).get();
  if (!userDoc.exists) {
    throw new Error('User document not found');
  }
  return userDoc.data();
}

// Function to update user secrets in Firestore based on UID
async function updateUserSecrets(uid, newSecrets) {
  const userRef = db.collection('users').doc(uid);
  await userRef.update(newSecrets);
}

const { v4: uuidv4 } = require('uuid');

// Function to add a new user to Firestore if not already present
async function addNewUser(userData) {
  const uid = uuidv4(); // Generate a random UUID for the user
  const userRef = db.collection('users').doc(uid);
  const userDoc = await userRef.get();

  if (!userDoc.exists) {
    await userRef.set({ ...userData, uid }); // Include the generated uid in the user data
  }
}


// Function to fetch environment variables dynamically
function getEnvVars() {
  return {
    redirectUri: process.env.REDIRECT_URI
    // Add more variables here as needed
  };
}

module.exports = {
  getUserSecrets,
  updateUserSecrets,
  addNewUser,
  getEnvVars,
};
