import crypto from 'crypto';

/**
 * Generate Kalshi RSA-PSS authentication headers.
 * Kalshi requires signing: timestamp + method + path
 */
export function createKalshiHeaders(
  apiKey: string,
  privateKeyPem: string,
  method: string,
  path: string,
): Record<string, string> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const message = timestamp + method.toUpperCase() + '/trade-api/v2' + path;

  const signature = crypto.sign('sha256', Buffer.from(message), {
    key: privateKeyPem,
    padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
    saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
  });

  return {
    'KALSHI-ACCESS-KEY': apiKey,
    'KALSHI-ACCESS-SIGNATURE': signature.toString('base64'),
    'KALSHI-ACCESS-TIMESTAMP': timestamp,
    'Content-Type': 'application/json',
  };
}
