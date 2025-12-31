# Yeastar PBX Dashboard v2.0

A modern, secure, and feature-rich dashboard for managing Yeastar P-Series PBX systems. Built with React, TypeScript, and Tailwind CSS.

## ✨ Features

- 🔐 **Secure Authentication** - OAuth2 authentication with access token management
- 📊 **Real-time Statistics** - View today's call statistics by extension
- 📞 **Call History** - Browse recent calls with pagination
- 🔀 **Quick Route Override** - Instantly change inbound call destinations
- 🎨 **Modern UI** - Beautiful animations with Framer Motion
- 🌓 **Dark Mode** - Automatic theme detection with manual toggle
- 🔒 **Security Hardened** - XSS protection, input sanitization, CORS proxy with domain whitelist
- ⚡ **Performance Optimized** - API caching, lazy loading, and efficient rendering
- 📱 **Responsive Design** - Works seamlessly on desktop, tablet, and mobile

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- A Yeastar P-Series PBX with API access
- A deployed CORS proxy (see Deployment section)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/inspiretelapps/inspiretelapps.github.io.git
cd inspiretelapps.github.io
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open http://localhost:3000 in your browser

### Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## 🔧 Configuration

### CORS Proxy Setup

The application requires a CORS proxy to communicate with your PBX. Update `api/proxy.js` with your allowed domains:

```javascript
const ALLOWED_DOMAINS = [
  'pbx.yeastarcloud.com',
  'your-custom-pbx.com',
];
```

### Deployment Options

**Option 1: Vercel (Recommended)**
```bash
npm install -g vercel
vercel
```

**Option 2: Railway**
- Connect your GitHub repository to Railway
- Deploy automatically on push

**Option 3: Netlify**
- Build command: `npm run build`
- Publish directory: `dist`

## 🛡️ Security Improvements

This version includes major security enhancements:

- ✅ HTML sanitization with DOMPurify
- ✅ XSS attack prevention
- ✅ CORS proxy with domain whitelist
- ✅ Rate limiting (100 requests/minute)
- ✅ Request timeout protection
- ✅ Input validation and escaping
- ✅ No client-side secret storage (removed from localStorage)

## 📚 Technology Stack

- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling with Poppins font
- **Framer Motion** - Animations
- **Zustand** - State management
- **DOMPurify** - XSS protection
- **React Hot Toast** - Notifications
- **Lucide React** - Icons

## 🎨 UI/UX Features

- Smooth page transitions
- Hover effects and micro-interactions
- Loading states and skeletons
- Toast notifications for user feedback
- Gradient backgrounds
- Card-based layout
- Responsive grid system

## 📖 API Documentation

The dashboard uses the Yeastar OpenAPI v1.0. Key endpoints:

- `GET /extension/list` - Fetch extensions
- `GET /call_report/list` - Fetch call statistics
- `GET /cdr/list` - Fetch call detail records
- `GET /inbound_route/list` - Fetch inbound routes
- `POST /inbound_route/update` - Update route configuration

## 🐛 Troubleshooting

**Issue: "Failed to connect to PBX"**
- Verify your proxy URL is correct and accessible
- Ensure your proxy IP is whitelisted in PBX API settings
- Check client ID and secret are correct

**Issue: "Domain not authorized"**
- Add your PBX domain to the ALLOWED_DOMAINS in `api/proxy.js`
- Redeploy your proxy

**Issue: "CORS errors"**
- Ensure you're using the proxy, not direct API calls
- Check proxy is properly configured and deployed

## 📝 License

MIT License - feel free to use this for your projects!

## 🙏 Acknowledgments

- Yeastar for their PBX system and API
- The React and TypeScript communities
- All contributors and users

## 📞 Support

For issues, questions, or contributions, please open an issue on GitHub.

---

**Previous Version**: The old vanilla JS version is backed up as `index.old-backup.html`
