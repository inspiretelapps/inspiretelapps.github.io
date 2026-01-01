const express = require('express');
const { proxyHandler } = require('./api/proxy.js');

const app = express();
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'yeastar-proxy',
    version: '2.0'
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'yeastar-proxy',
    version: '2.0'
  });
});

// Proxy all /api/* requests
app.all('/api/proxy/*', proxyHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Yeastar proxy server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/api/health`);
});
