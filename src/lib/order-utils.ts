/**
 * Utility functions for order ID formatting and display
 */

const invoiceDateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

export function formatInvoiceDate(value: string | Date | null | undefined): string {
  if (!value) {
    return 'N/A';
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return typeof value === 'string' ? value : 'N/A';
  }

  return invoiceDateFormatter.format(date);
}

/**
 * Converts a UUID order ID to a short, human-readable order number
 * Format: TB + 8 characters of entropy (reduced collision risk)
 */
export function formatOrderNumber(orderId: string): string {
  if (!orderId || typeof orderId !== 'string') {
    return 'TB00000000';
  }

  // Remove hyphens, convert to uppercase
  const cleanId = orderId.replace(/-/g, '').toUpperCase();
  // Take first 8 characters for increased entropy ($4.2$ billion combinations)
  const shortCode = cleanId.slice(0, 8);
  
  return `TB${shortCode}`;
}

/**
 * Converts a UUID order ID to a medium-length order number
 * Format: TB + 8 alphanumeric characters
 */
export function formatOrderNumberMedium(orderId: string): string {
  if (!orderId || typeof orderId !== 'string') {
    return 'TB000000';
  }

  // Remove hyphens and take first 8 characters, convert to uppercase
  const cleanId = orderId.replace(/-/g, '').toUpperCase();
  const shortCode = cleanId.slice(0, 8);
  
  return `TB${shortCode}`;
}

/**
 * Legacy function for backward compatibility - formats to 8-character display
 */
export function formatOrderId(orderId: string): string {
  if (!orderId || typeof orderId !== 'string') {
    return '00000000';
  }
  
  return orderId.slice(0, 8).toUpperCase();
}

/**
 * Get a human-readable order display text
 */
export function getOrderDisplayText(orderId: string): string {
  return `Order #${formatOrderNumber(orderId)}`;
}