const { PayOS } = require('@payos/node');
const path = require('path');

// Keep merchant credentials in an ignored backend-only file for local development.
require('dotenv').config({ path: path.resolve(__dirname, '../../.env.payos') });

let client;

function getPayOS() {
  const required = ['PAYOS_CLIENT_ID', 'PAYOS_API_KEY', 'PAYOS_CHECKSUM_KEY'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(`Missing PayOS configuration: ${missing.join(', ')}`);
  }

  if (!client) {
    client = new PayOS({
      clientId: process.env.PAYOS_CLIENT_ID,
      apiKey: process.env.PAYOS_API_KEY,
      checksumKey: process.env.PAYOS_CHECKSUM_KEY,
    });
  }
  return client;
}

module.exports = { getPayOS };
