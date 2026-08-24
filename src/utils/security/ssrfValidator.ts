import dns from 'dns';
import { promisify } from 'util';

const dnsLookup = promisify(dns.lookup);

/**
 * Checks if a given IP address belongs to a private, loopback, or link-local range.
 */
export async function isPrivateIp(ip: string): Promise<boolean> {
  // Loopback check
  if (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') {
    return true;
  }

  // IPv4 Private Ranges:
  // - 10.0.0.0/8
  // - 172.16.0.0/12
  // - 192.168.0.0/16
  // - 169.254.0.0/16 (AWS/Cloud link-local metadata)
  const ipv4Pattern = /^(10\.\d+|172\.(1[6-9]|2\d|3[01])|192\.168|169\.254)\.\d+\.\d+$/;
  if (ipv4Pattern.test(ip)) {
    return true;
  }

  // IPv6 Private & Local Ranges (Unique Local: fc00::/7, Link-Local: fe80::/10)
  const ipv6Pattern = /^(fc00|fd00|fe80)/i;
  if (ipv6Pattern.test(ip)) {
    return true;
  }

  return false;
}

/**
 * Validates a URL to prevent Server-Side Request Forgery (SSRF) attacks.
 * Verifies that the URL is valid, uses http/https, and does not point to internal resources.
 */
export async function validateUrlForSsrf(urlString: string): Promise<void> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(urlString);
  } catch {
    throw new Error('Invalid URL format');
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new Error('Only HTTP and HTTPS protocols are supported');
  }

  const { hostname } = parsedUrl;
  if (!hostname) {
    throw new Error('URL hostname is empty');
  }

  // Direct check for loopback/private hostname string
  if (await isPrivateIp(hostname)) {
    throw new Error('Access to private or local networks is forbidden');
  }

  // Resolve hostname and check IP address to prevent DNS rebinding SSRF
  try {
    const { address } = await dnsLookup(hostname);
    if (await isPrivateIp(address)) {
      throw new Error('URL resolves to a forbidden private or local network address');
    }
  } catch (err: any) {
    if (err.code === 'ENOTFOUND') {
      throw new Error(`Hostname could not be resolved: ${hostname}`);
    }
    throw err;
  }
}
