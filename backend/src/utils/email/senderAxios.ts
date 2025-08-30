// backend/src/utils/senderAxios.ts
import axios from 'axios';

const SENDER_API_KEY = process.env.SENDER_API_KEY;

if (!SENDER_API_KEY) {
  throw new Error('SENDER_API_KEY environment variable is required');
}

export const senderAxios = axios.create({
  baseURL: 'https://api.sender.net/v2',
  timeout: 10000,
  headers: {
    Authorization: `Bearer ${SENDER_API_KEY}`,
    'Content-Type': 'application/json',
  },
});
