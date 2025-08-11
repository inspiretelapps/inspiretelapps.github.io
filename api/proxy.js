// Netlify function wrapper
exports.handler = async function(event, context) {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': 'https://inspiretelapps.github.io',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, User-Agent, X-Requested-With',
    'Access-Control-Max-Age': '86400'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    // Extract the target URL from the request path
    const targetPath = event.path.replace('/api/proxy/', '');
    
    // Security: Only allow requests to Yeastar domains
    if (!targetPath.includes('yeastar') && !targetPath.includes('pbx')) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'Unauthorized domain' })
      };
    }

    // Build the target URL
    const targetUrl = `https://${targetPath}`;
    
    // Parse request body
    let body;
    if (event.body) {
      try {
        body = JSON.parse(event.body);
      } catch {
        body = event.body;
      }
    }
    
    // Forward the request
    const response = await fetch(targetUrl, {
      method: event.httpMethod,
      headers: {
        'Content-Type': event.headers['content-type'] || 'application/json',
        'User-Agent': event.headers['user-agent'] || 'YeastarDashboardProxy',
        'X-Requested-With': event.headers['x-requested-with'] || 'XMLHttpRequest'
      },
      body: event.httpMethod !== 'GET' ? JSON.stringify(body) : undefined
    });

    // Get response data
    const data = await response.text();
    
    // Try to parse as JSON, fallback to text
    let jsonData;
    try {
      jsonData = JSON.parse(data);
    } catch {
      jsonData = { rawResponse: data };
    }

    // Return the response
    return {
      statusCode: response.status,
      headers,
      body: JSON.stringify(jsonData)
    };

  } catch (error) {
    console.error('Proxy error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Proxy error', 
        message: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
};

// Vercel function export (for compatibility)
export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', 'https://inspiretelapps.github.io');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, User-Agent, X-Requested-With');
  res.setHeader('Access-Control-Max-Age', '86400');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // Extract the target URL from the request path
    const targetPath = req.url.replace('/api/proxy/', '');
    
    // Security: Only allow requests to Yeastar domains
    if (!targetPath.includes('yeastar') && !targetPath.includes('pbx')) {
      return res.status(403).json({ error: 'Unauthorized domain' });
    }

    // Build the target URL
    const targetUrl = `https://${targetPath}`;
    
    // Forward the request
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        'Content-Type': req.headers['content-type'] || 'application/json',
        'User-Agent': req.headers['user-agent'] || 'YeastarDashboardProxy',
        'X-Requested-With': req.headers['x-requested-with'] || 'XMLHttpRequest'
      },
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined
    });

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

  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ 
      error: 'Proxy error', 
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}
