import DOMPurify from 'dompurify';

/**
 * Sanitize HTML content to prevent XSS attacks
 */
export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'span', 'div', 'p'],
    ALLOWED_ATTR: ['class'],
  });
}

/**
 * Escape HTML special characters for plain text display
 */
export function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Validate URL to prevent SSRF attacks
 */
export function isValidUrl(url: string, allowedDomains: string[]): boolean {
  try {
    const urlObj = new URL(url);
    return allowedDomains.some(domain =>
      urlObj.hostname === domain || urlObj.hostname.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}

/**
 * Validate PBX host format
 */
export function isValidPbxHost(host: string): boolean {
  // Should be a valid domain or IP
  const domainRegex = /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i;
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
  return domainRegex.test(host) || ipRegex.test(host);
}

/**
 * Sanitize configuration object
 */
export function sanitizeConfig(config: any) {
  return {
    proxyUrl: escapeHtml(config.proxyUrl?.trim() || ''),
    pbxHost: escapeHtml(config.pbxHost?.trim() || ''),
    clientId: escapeHtml(config.clientId?.trim() || ''),
  };
}
