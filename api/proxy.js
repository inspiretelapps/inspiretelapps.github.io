export default async function handler(req, res) {
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
    // Extract the target URL from the request path
    const targetPath = req.url.replace('/api/proxy/', '');
    
    // Build the target URL
    const targetUrl = `https://${targetPath}`;
    
    console.log(`Proxying request to: ${targetUrl}`);
    
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
