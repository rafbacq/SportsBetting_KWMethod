import { createKalshiHeaders } from './auth.js';

export class KalshiClient {
  private baseUrl: string;
  private apiKey: string;
  private privateKey: string;

  constructor(baseUrl: string, apiKey: string, privateKey: string) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    this.privateKey = privateKey;
  }

  get isConfigured(): boolean {
    return !!(this.apiKey && this.privateKey);
  }

  private getHeaders(method: string, path: string): Record<string, string> {
    if (!this.isConfigured) {
      return { 'Content-Type': 'application/json' };
    }
    return createKalshiHeaders(this.apiKey, this.privateKey, method, path);
  }

  async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(this.baseUrl + path);
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== '') url.searchParams.set(k, v);
      });
    }

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: this.getHeaders('GET', path),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Kalshi GET ${path} failed (${res.status}): ${body}`);
    }
    return res.json() as Promise<T>;
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(this.baseUrl + path, {
      method: 'POST',
      headers: this.getHeaders('POST', path),
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Kalshi POST ${path} failed (${res.status}): ${text}`);
    }
    return res.json() as Promise<T>;
  }

  async delete<T>(path: string): Promise<T> {
    const res = await fetch(this.baseUrl + path, {
      method: 'DELETE',
      headers: this.getHeaders('DELETE', path),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Kalshi DELETE ${path} failed (${res.status}): ${text}`);
    }
    return res.json() as Promise<T>;
  }
}
