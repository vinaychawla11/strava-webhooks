const express = require('express');
const serverless = require('serverless-http');
const app = require('../src/api/index.js');

const router = express.Router();
router.use('/', app);

module.exports = {
  handler: serverless(router),
};