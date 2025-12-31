// Security: Whitelist allowed PBX domains
const ALLOWED_DOMAINS = [
  'pbx.yeastarcloud.com',
  'yeastarcloud.com',
  // Add your custom PBX domains here
];

// Rate limiting: Simple in-memory store
const requestCounts = new Map();
const RATE_LIMIT = 100; // requests per minute
const RATE_WINDOW = 60000; // 1 minute

function checkRateLimit(ip) {
  const now = Date.now();
  const userRequests = requestCounts.get(ip) || [];

  // Remove old requests outside the window
  const recentRequests = userRequests.filter(time => now - time < RATE_WINDOW);

  if (recentRequests.length >= RATE_LIMIT) {
    return false;
  }

  recentRequests.push(now);
  requestCounts.set(ip, recentRequests);
  return true;
}

function isValidUrl(url, allowedDomains) {
  try {
    const urlObj = new URL(url);
    return allowedDomains.some(domain =>
      urlObj.hostname === domain || urlObj.hostname.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}

// Vercel function export
export default async function handler(req, res) {
  return await proxyHandler(req, res);
}

// Railway function export
export async function proxyHandler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, User-Agent, X-Requested-With');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // Rate limiting
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    if (!checkRateLimit(clientIp)) {
      console.warn(`Rate limit exceeded for IP: ${clientIp}`);
      res.status(429).json({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.',
      });
      return;
    }

    // Extract the target URL from the request path
    const targetPath = req.url.replace('/api/proxy/', '');

    // Build the target URL
    const targetUrl = `https://${targetPath}`;

    // Validate the target URL against whitelist
    if (!isValidUrl(targetUrl, ALLOWED_DOMAINS)) {
      console.error(`Blocked request to unauthorized domain: ${targetUrl}`);
      res.status(403).json({
        error: 'Forbidden',
        message: 'Target domain is not authorized',
      });
      return;
    }

    console.log(`Proxying request to: ${targetUrl}`);

    // Forward the request with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
      const response = await fetch(targetUrl, {
        method: req.method,
        headers: {
          'Content-Type': req.headers['content-type'] || 'application/json',
          'User-Agent': req.headers['user-agent'] || 'YeastarDashboardProxy/2.0',
          'X-Requested-With': req.headers['x-requested-with'] || 'XMLHttpRequest'
        },
        body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      // Get response data
      const data = await response.text();

      // Try to parse as JSON, fallback to text
      let jsonData;
      try {
        jsonData = JSON.parse(data);
      } catch {
        jsonData = { rawResponse: data };
      }

      // Forward the response
      res.status(response.status).json(jsonData);
    } catch (fetchError) {
      clearTimeout(timeout);

      if (fetchError.name === 'AbortError') {
        console.error('Request timeout');
        res.status(504).json({
          error: 'Gateway Timeout',
          message: 'Request to PBX timed out',
        });
      } else {
        throw fetchError;
      }
    }

  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({
      error: 'Proxy error',
      message: error.message || 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
}
