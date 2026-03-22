import dotenv from 'dotenv';
import { readFileSync } from 'fs';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',

  kalshi: {
    baseUrl: process.env.KALSHI_BASE_URL || 'https://api.elections.kalshi.com/trade-api/v2',
    apiKey: process.env.KALSHI_API_KEY || '',
    getPrivateKey(): string {
      if (process.env.KALSHI_PRIVATE_KEY_BASE64) {
        return Buffer.from(process.env.KALSHI_PRIVATE_KEY_BASE64, 'base64').toString('utf-8');
      }
      if (process.env.KALSHI_PRIVATE_KEY_PATH) {
        try {
          return readFileSync(process.env.KALSHI_PRIVATE_KEY_PATH, 'utf-8');
        } catch {
          return '';
        }
      }
      return '';
    },
  },

  polymarket: {
    clobBaseUrl: process.env.POLYMARKET_CLOB_URL || 'https://clob.polymarket.com',
    gammaBaseUrl: process.env.POLYMARKET_GAMMA_URL || 'https://gamma-api.polymarket.com',
    privateKey: process.env.POLYMARKET_PRIVATE_KEY || '',
    apiKey: process.env.POLYMARKET_API_KEY || '',
    secret: process.env.POLYMARKET_SECRET || '',
    passphrase: process.env.POLYMARKET_PASSPHRASE || '',
  },
};
