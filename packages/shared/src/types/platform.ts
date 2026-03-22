export type Platform = 'kalshi' | 'polymarket';

export interface PlatformCredentials {
  platform: Platform;
  apiKey: string;
  privateKey: string; // RSA PEM for Kalshi, Ethereum private key for Polymarket
}

export interface PlatformStatus {
  platform: Platform;
  connected: boolean;
  authenticated: boolean;
  displayName: string;
}
