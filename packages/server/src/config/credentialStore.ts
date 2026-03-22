import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import type { PlatformCredentials } from '@sports-betting/shared';

const STORE_PATH = join(process.cwd(), '.credentials.json');

interface StoredCredentials {
  [platform: string]: PlatformCredentials;
}

function read(): StoredCredentials {
  try {
    return JSON.parse(readFileSync(STORE_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

function write(data: StoredCredentials): void {
  try {
    mkdirSync(dirname(STORE_PATH), { recursive: true });
    writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), { mode: 0o600 });
  } catch (err) {
    console.error('[CredentialStore] Failed to write credentials:', err);
  }
}

export function saveCredentials(credentials: PlatformCredentials): void {
  const store = read();
  store[credentials.platform] = credentials;
  write(store);
}

export function loadAllCredentials(): PlatformCredentials[] {
  const store = read();
  return Object.values(store);
}

export function clearCredentials(platform: string): void {
  const store = read();
  delete store[platform];
  write(store);
}
