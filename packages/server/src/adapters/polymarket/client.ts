import crypto from 'crypto';

export class PolymarketClient {
  private gammaBaseUrl: string;
  private clobBaseUrl: string;
  private apiKey: string;
  private secret: string;
  private passphrase: string;

  constructor(
    gammaBaseUrl: string,
    clobBaseUrl: string,
    apiKey: string,
    secret: string,
    passphrase: string,
  ) {
    this.gammaBaseUrl = gammaBaseUrl;
    this.clobBaseUrl = clobBaseUrl;
    this.apiKey = apiKey;
    this.secret = secret;
    this.passphrase = passphrase;
  }

  get isConfigured(): boolean {
    return !!(this.apiKey && this.secret && this.passphrase);
  }

  private createL2Headers(method: string, path: string, body?: string): Record<string, string> {
    if (!this.isConfigured) return { 'Content-Type': 'application/json' };

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const message = timestamp + method.toUpperCase() + path + (body || '');
    const signature = crypto
      .createHmac('sha256', Buffer.from(this.secret, 'base64'))
      .update(message)
      .digest('base64');

    return {
      'Content-Type': 'application/json',
      'POLY-ADDRESS': '',
      'POLY-SIGNATURE': signature,
      'POLY-TIMESTAMP': timestamp,
      'POLY-API-KEY': this.apiKey,
      'POLY-PASSPHRASE': this.passphrase,
    };
  }

  // Public Gamma API (no auth needed)
  async getGamma<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(this.gammaBaseUrl + path);
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== '') url.searchParams.set(k, v);
      });
    }

    const res = await fetch(url.toString(), {
      headers: { 'Content-Type': 'application/json' },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Polymarket Gamma GET ${path} failed (${res.status}): ${text}`);
    }
    return res.json() as Promise<T>;
  }

  // Public CLOB API
  async getCLOB<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(this.clobBaseUrl + path);
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== '') url.searchParams.set(k, v);
      });
    }

    const res = await fetch(url.toString(), {
      headers: { 'Content-Type': 'application/json' },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Polymarket CLOB GET ${path} failed (${res.status}): ${text}`);
    }
    return res.json() as Promise<T>;
  }

  // Authenticated CLOB API
  async postCLOB<T>(path: string, body?: unknown): Promise<T> {
    const bodyStr = body ? JSON.stringify(body) : '';
    const res = await fetch(this.clobBaseUrl + path, {
      method: 'POST',
      headers: this.createL2Headers('POST', path, bodyStr),
      body: bodyStr || undefined,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Polymarket CLOB POST ${path} failed (${res.status}): ${text}`);
    }
    return res.json() as Promise<T>;
  }

  async deleteCLOB<T>(path: string): Promise<T> {
    const res = await fetch(this.clobBaseUrl + path, {
      method: 'DELETE',
      headers: this.createL2Headers('DELETE', path),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Polymarket CLOB DELETE ${path} failed (${res.status}): ${text}`);
    }
    return res.json() as Promise<T>;
  }
}
