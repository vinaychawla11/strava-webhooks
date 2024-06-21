'use strict';

const serverless = require('serverless-http');
const app = require('../src/api/index.js'); // Adjust the path to your Express app

module.exports.handler = serverless(app);
