
# 🚀 Deploy Your Own Yeastar Proxy Service

This guide will help you deploy a secure, private proxy service to bypass CORS issues.

## 🎯 **Why Deploy Your Own Proxy?**

- ✅ **Secure** - Only your app can use it
- ✅ **Reliable** - No dependency on third-party services  
- ✅ **Fast** - Deploy globally with edge functions
- ✅ **Free** - Both Vercel and Netlify offer generous free tiers
- ✅ **Customizable** - Add logging, rate limiting, authentication

## 🚀 **Option 1: Deploy to Vercel (Recommended)**

### **Step 1: Install Vercel CLI**
```bash
npm install -g vercel
```

### **Step 2: Login to Vercel**
```bash
vercel login
```

### **Step 3: Deploy**
```bash
vercel --prod
```

**Follow the prompts:**
- Project name: `yeastar-proxy` (or your preferred name)
- Directory: `.` (current directory)
- Override settings: `N` (use defaults)

### **Step 4: Get Your Proxy URL**
After deployment, Vercel will give you a URL like:
```
https://your-project-name.vercel.app
```

**Your proxy endpoint will be:**
```
https://your-project-name.vercel.app/api/proxy/
```

## 🌐 **Option 2: Deploy to Netlify**

### **Step 1: Install Netlify CLI**
```bash
npm install -g netlify-cli
```

### **Step 2: Login to Netlify**
```bash
netlify login
```

### **Step 3: Deploy**
```bash
netlify deploy --prod
```

**Follow the prompts:**
- Publish directory: `.` (current directory)
- Functions directory: `api`
- Deploy to production: `Y`

### **Step 4: Get Your Proxy URL**
After deployment, Netlify will give you a URL like:
```
https://your-project-name.netlify.app
```

**Your proxy endpoint will be:**
```
https://your-project-name.netlify.app/api/proxy/
```

## 🔧 **Update Your Dashboard**

Once deployed, update your dashboard's proxy URL:

1. **Open your dashboard**
2. **Go to API Configuration**
3. **Replace the proxy URL** with your new endpoint
4. **Remove the trailing slash** (e.g., `https://your-project.vercel.app/api/proxy`)

## 🛡️ **Security Features Built-In**

- **Domain Whitelisting** - Only allows Yeastar/PBX domains
- **CORS Protection** - Only allows your GitHub Pages domain
- **Request Validation** - Prevents malicious requests
- **Error Logging** - Tracks issues for debugging

## 📊 **Performance Benefits**

- **Edge Functions** - Deploy globally for low latency
- **No Rate Limits** - Unlike public proxies
- **Reliable Uptime** - 99.9%+ availability
- **Fast Response** - Optimized for API calls

## 🔍 **Testing Your Proxy**

Test your proxy with a simple request:

```bash
curl "https://your-project.vercel.app/api/proxy/pbx.yeastarcloud.com/openapi/v1.0/get_token" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test"}'
```

## 🚨 **Troubleshooting**

### **Common Issues:**

1. **CORS Errors** - Check that your proxy URL is correct
2. **403 Unauthorized** - Verify the target domain contains 'yeastar' or 'pbx'
3. **500 Server Error** - Check the proxy logs in Vercel/Netlify dashboard

### **Check Logs:**
- **Vercel**: Go to your project dashboard → Functions → View logs
- **Netlify**: Go to your site dashboard → Functions → View logs

## 💰 **Costs**

- **Vercel**: Free tier includes 100GB bandwidth/month
- **Netlify**: Free tier includes 125K function invocations/month
- **Both**: More than enough for personal/small business use

## 🔄 **Updating Your Proxy**

To update your proxy:
1. Make changes to `api/proxy.js`
2. Run `vercel --prod` or `netlify deploy --prod`
3. Changes deploy instantly

---

**🎉 Congratulations!** You now have a secure, private proxy service that's much better than any public CORS proxy.
