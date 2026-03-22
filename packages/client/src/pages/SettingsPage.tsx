import { useState } from 'react';
import { api } from '@/api/client';
import type { Platform } from '@sports-betting/shared';

interface PlatformConfig {
  platform: Platform;
  name: string;
  fields: { key: string; label: string; type: string; placeholder: string }[];
}

const platformConfigs: PlatformConfig[] = [
  {
    platform: 'kalshi',
    name: 'Kalshi',
    fields: [
      { key: 'apiKey', label: 'API Key', type: 'text', placeholder: 'Your Kalshi API key' },
      {
        key: 'privateKey',
        label: 'RSA Private Key (PEM)',
        type: 'textarea',
        placeholder: '-----BEGIN RSA PRIVATE KEY-----\n...',
      },
    ],
  },
  {
    platform: 'polymarket',
    name: 'Polymarket',
    fields: [
      { key: 'apiKey', label: 'API Key', type: 'text', placeholder: 'Your Polymarket API key' },
      {
        key: 'privateKey',
        label: 'Credentials (apiKey:secret:passphrase)',
        type: 'text',
        placeholder: 'apiKey:secret:passphrase',
      },
    ],
  },
];

export function SettingsPage() {
  const [credentials, setCredentials] = useState<Record<string, Record<string, string>>>({});
  const [statuses, setStatuses] = useState<Record<string, 'idle' | 'loading' | 'success' | 'error'>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (platform: string, field: string, value: string) => {
    setCredentials((prev) => ({
      ...prev,
      [platform]: { ...prev[platform], [field]: value },
    }));
  };

  const handleConnect = async (config: PlatformConfig) => {
    setStatuses((prev) => ({ ...prev, [config.platform]: 'loading' }));
    setErrors((prev) => ({ ...prev, [config.platform]: '' }));

    try {
      await api.post('/auth/connect', {
        platform: config.platform,
        apiKey: credentials[config.platform]?.apiKey || '',
        privateKey: credentials[config.platform]?.privateKey || '',
      });
      setStatuses((prev) => ({ ...prev, [config.platform]: 'success' }));
    } catch (err) {
      setStatuses((prev) => ({ ...prev, [config.platform]: 'error' }));
      setErrors((prev) => ({
        ...prev,
        [config.platform]: (err as Error).message,
      }));
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Settings</h1>
      <p className="text-sm text-gray-500 mb-8">
        Configure your platform API credentials to enable trading.
      </p>

      <div className="space-y-6 max-w-2xl">
        {platformConfigs.map((config) => (
          <div key={config.platform} className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{config.name}</h2>
              {statuses[config.platform] === 'success' && (
                <span className="text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full">
                  Connected
                </span>
              )}
            </div>

            <div className="space-y-4">
              {config.fields.map((field) => (
                <div key={field.key}>
                  <label className="text-xs text-gray-500 mb-1 block">{field.label}</label>
                  {field.type === 'textarea' ? (
                    <textarea
                      rows={4}
                      placeholder={field.placeholder}
                      value={credentials[config.platform]?.[field.key] || ''}
                      onChange={(e) => handleChange(config.platform, field.key, e.target.value)}
                      className="input w-full font-mono text-xs resize-none"
                    />
                  ) : (
                    <input
                      type={field.key.includes('Key') || field.key.includes('private') ? 'password' : 'text'}
                      placeholder={field.placeholder}
                      value={credentials[config.platform]?.[field.key] || ''}
                      onChange={(e) => handleChange(config.platform, field.key, e.target.value)}
                      className="input w-full"
                    />
                  )}
                </div>
              ))}
            </div>

            {errors[config.platform] && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mt-4">
                <p className="text-sm text-red-400">{errors[config.platform]}</p>
              </div>
            )}

            <button
              onClick={() => handleConnect(config)}
              disabled={statuses[config.platform] === 'loading'}
              className="btn-primary mt-4 w-full"
            >
              {statuses[config.platform] === 'loading'
                ? 'Connecting...'
                : `Connect to ${config.name}`}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
