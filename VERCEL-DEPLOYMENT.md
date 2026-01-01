# Using Vercel as Both App and Proxy

When you deploy to Vercel, both your React app AND the proxy server are hosted on the same domain. This is the **recommended setup** for simplicity.

## How It Works

```
Your Vercel Deployment:
├── React App (/)           → https://your-app.vercel.app
├── API Proxy (/api/proxy/*) → https://your-app.vercel.app/api/proxy/*
└── Health Check (/api/health) → https://your-app.vercel.app/api/health
```

## Deployment Steps

### 1. Make Sure You Have the Latest Code
```bash
git pull origin claude/cloudpbx-dashboard-features-TiLGV
```

### 2. Deploy to Vercel
```bash
# If not logged in
vercel login

# Deploy
vercel --prod
```

You'll get a URL like: `https://inspiretelapps.vercel.app`

### 3. Test the Proxy
Open in your browser:
```
https://your-app.vercel.app/api/health
```

Should return:
```json
{
  "status": "ok",
  "timestamp": "2026-01-01T...",
  "service": "yeastar-proxy",
  "version": "2.0"
}
```

### 4. Configure Your PBX Domain
Edit `api/proxy.js` and add your PBX domain:

```javascript
const ALLOWED_DOMAINS = [
  'pbx.yeastarcloud.com',
  'yeastarcloud.com',
  'your-custom-pbx.com',  // ← Add your domain here
];
```

Then redeploy:
```bash
vercel --prod
```

### 5. Login to Dashboard

**IMPORTANT:** Use the **SAME URL** for both the app and proxy!

```
Open: https://your-app.vercel.app

Then login with:
├── Proxy URL: https://your-app.vercel.app  ← Same URL!
├── PBX Host: pbx.yeastarcloud.com
├── Client ID: your-api-username
└── Client Secret: your-api-password
```

## Why Same URL?

When the proxy is part of the same Vercel deployment:
- ✅ No CORS issues
- ✅ Simpler configuration
- ✅ Single deployment to manage
- ✅ Better performance (no extra round trip)

## Troubleshooting

### Error: "Cannot reach proxy"
**Solution:** Make sure you're using the **same Vercel URL** for both:
- App URL: `https://your-app.vercel.app`
- Proxy URL: `https://your-app.vercel.app` ← Same!

### Error: "404 Not Found"
**Cause:** Old Vercel configuration

**Solution:**
1. Make sure `vercel.json` is updated (already done ✅)
2. Redeploy:
   ```bash
   vercel --prod
   ```
3. Test health endpoint: `https://your-app.vercel.app/api/health`

### Error: "Forbidden" (403)
**Cause:** Your PBX domain isn't whitelisted

**Solution:**
1. Add your domain to `ALLOWED_DOMAINS` in `api/proxy.js`
2. Redeploy:
   ```bash
   vercel --prod
   ```

### Error: "Auth failed: Error 10005"
**Cause:** Proxy IP not whitelisted in PBX

**Solution:**
1. Go to your Yeastar PBX: **Advanced → API Settings**
2. Add Vercel's IP range to whitelist
3. Or use `0.0.0.0/0` for testing (less secure)

## Environment Variables (Optional)

For sensitive configuration, use Vercel environment variables:

1. In Vercel dashboard → Settings → Environment Variables
2. Add:
   - `ALLOWED_DOMAINS=pbx.yeastarcloud.com,your-domain.com`
   - `RATE_LIMIT=100`

3. Update `api/proxy.js`:
   ```javascript
   const ALLOWED_DOMAINS = (process.env.ALLOWED_DOMAINS || 'pbx.yeastarcloud.com').split(',');
   ```

4. Redeploy

## Checking Vercel Logs

If issues persist, check Vercel logs:

1. Go to Vercel dashboard
2. Select your project
3. Click "Deployments"
4. Click on latest deployment
5. Click "Functions" tab
6. Check logs for errors

## Example: Complete Login

```
1. Open app: https://inspiretelapps.vercel.app
2. Login form:
   ┌─────────────────────────────────────────────────┐
   │ Proxy URL: https://inspiretelapps.vercel.app   │
   │ PBX Host: pbx.yeastarcloud.com                 │
   │ Client ID: api_user                             │
   │ Client Secret: ••••••••                         │
   └─────────────────────────────────────────────────┘
3. Click "Connect & Fetch Data"
4. Console should show:
   ✓ Testing proxy connection...
   ✓ Proxy is accessible
   ✓ Authenticating with PBX...
   ✓ Authentication successful
```

## Next Steps

After successful login, you'll see:
- Live Dashboard Widgets
- Extension Status Monitor
- Queue Monitor
- Active Call Controls
- Route Switching Presets
- Analytics
- And more!
