const https = require('https');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();

/**
 * Script to ping the backend URL to keep it from sleeping on Render.
 * Render free tier spins down after 15 minutes of inactivity.
 */

const BACKEND_URL = process.env.BACKEND_URL || 'https://ukmkemasan-erp-backend.onrender.com';

console.log(`Starting keep-alive ping to: ${BACKEND_URL}`);

let isAlive = false;

https.get(BACKEND_URL, (res) => {
  const { statusCode } = res;
  console.log(`Ping Status Code: ${statusCode}`);
  
  if (statusCode === 200) {
    console.log('Backend is alive!');
    isAlive = true;
  } else {
    console.warn(`Backend returned unexpected status: ${statusCode}`);
  }
}).on('error', (err) => {
  console.error(`Error pinging backend: ${err.message}`);
  if (!isAlive) {
    process.exit(1);
  }
});
