# Yeastar Dashboard Proxy Setup Guide

## Why Do You Need a Proxy?

The Yeastar PBX API doesn't support CORS for browser-based applications. A proxy server acts as a bridge between your browser app and the PBX API.

## Quick Start: Deploy to Vercel

### Step 1: Install Vercel CLI (if not already installed)
```bash
npm install -g vercel
```

### Step 2: Deploy the Proxy
```bash
# Make sure you're in the project root
cd /path/to/inspiretelapps.github.io

# Login to Vercel (if first time)
vercel login

# Deploy the proxy
vercel --prod
```

### Step 3: Get Your Proxy URL
After deployment, Vercel will give you a URL like:
```
https://your-project-name.vercel.app
```

### Step 4: Configure Your PBX Domain
Edit `api/proxy.js` and add your PBX domain to the whitelist:

```javascript
const ALLOWED_DOMAINS = [
  'pbx.yeastarcloud.com',
  'yeastarcloud.com',
  'your-pbx-domain.com',  // Add your domain here
];
```

Then redeploy:
```bash
vercel --prod
```

### Step 5: Test the Proxy
Open in your browser:
```
https://your-project-name.vercel.app/api/health
```

You should see:
```json
{
  "status": "ok",
  "timestamp": "...",
  "service": "yeastar-proxy",
  "version": "2.0"
}
```

### Step 6: Use in Dashboard
Enter your proxy URL in the login form:
```
Proxy URL: https://your-project-name.vercel.app
```

## Alternative: Deploy to Railway

### Step 1: Install Railway CLI
```bash
npm install -g @railway/cli
```

### Step 2: Create railway.json
```json
{
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "node server.js",
    "restartPolicyType": "ON_FAILURE"
  }
}
```

### Step 3: Create server.js
```javascript
const express = require('express');
const { proxyHandler } = require('./api/proxy.js');

const app = express();
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'yeastar-proxy' });
});

// Proxy all /api/* requests
app.all('/api/*', proxyHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Proxy server running on port ${PORT}`);
});
```

### Step 4: Deploy
```bash
railway login
railway init
railway up
```

## Local Testing (Development Only)

### Option 1: Using Node.js
```bash
npm install express
node server.js
```

Then use: `http://localhost:3000`

### Option 2: Using Python
```bash
cd api
python3 -m http.server 8000
```

Then use: `http://localhost:8000`

## Troubleshooting

### Error: "Cannot reach proxy"
1. **Check proxy is deployed**: Visit `https://your-proxy-url/api/health`
2. **Check URL format**: Must include `https://`
3. **No trailing slash**: ❌ `https://proxy.com/` ✅ `https://proxy.com`

### Error: "Forbidden" or "403"
1. Add your PBX domain to `ALLOWED_DOMAINS` in `api/proxy.js`
2. Redeploy the proxy

### Error: "Failed to fetch"
1. Check browser console for CORS errors
2. Verify proxy has CORS headers (already included in `api/proxy.js`)
3. Try in incognito mode (disable extensions)

### Error: "Auth failed: Error 10005"
1. Your proxy's IP isn't whitelisted in Yeastar PBX
2. Go to PBX: **Advanced → API Settings → IP Whitelist**
3. Add your proxy server's IP address

To find your proxy's IP:
- **Vercel**: Contact support or check deployment logs
- **Railway**: Check deployment settings
- **Local**: Use `curl ifconfig.me`

## Security Considerations

1. **Whitelist PBX Domains**: Only add trusted PBX domains to `ALLOWED_DOMAINS`
2. **Rate Limiting**: Built-in (100 requests/minute per IP)
3. **IP Whitelisting**: Configure in Yeastar PBX API settings
4. **HTTPS Only**: Always use HTTPS in production
5. **No Secrets**: Never commit API credentials to git

## Environment Variables (Optional)

Create `.env` file for sensitive config:
```bash
ALLOWED_DOMAINS=pbx.yeastarcloud.com,your-domain.com
RATE_LIMIT=100
```

Update `api/proxy.js`:
```javascript
const ALLOWED_DOMAINS = (process.env.ALLOWED_DOMAINS || 'pbx.yeastarcloud.com').split(',');
```

## Next Steps

After proxy is working:
1. ✅ Test health endpoint
2. ✅ Configure PBX API settings
3. ✅ Whitelist proxy IP in PBX
4. ✅ Create API user in PBX
5. ✅ Login to dashboard with credentials

## Need Help?

Check browser console (F12) for detailed error messages. The app logs:
- Proxy connection test results
- Authentication request URLs
- Response status and errors
- Common error codes explained
