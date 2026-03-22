/**
 * Format cents (1-99) to a dollar string like "$0.55"
 */
export function centsToDollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Format cents to a percentage like "55%"
 */
export function centsToPercent(cents: number): string {
  return `${cents}%`;
}

/**
 * Format dollar amount with commas
 */
export function formatDollars(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

/**
 * Format large numbers with K/M suffixes
 */
export function formatVolume(volume: number): string {
  if (volume >= 1_000_000) return `$${(volume / 1_000_000).toFixed(1)}M`;
  if (volume >= 1_000) return `$${(volume / 1_000).toFixed(1)}K`;
  return `$${volume.toFixed(0)}`;
}

/**
 * Format a date string to a readable format
 */
export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Format a date string to include time
 */
export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
