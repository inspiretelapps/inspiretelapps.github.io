# Yeastar P-Series Dashboard

This is a simple, single-file web application for monitoring and managing a Yeastar P-Series PBX, designed to be hosted on a static site provider like GitHub Pages.

## CORS Proxy Requirement

Because of browser security policies (CORS), a web page cannot make API requests to a different domain (e.g., from `yourname.github.io` to `your-pbx-domain.com`). To solve this, a CORS proxy is required.

The public `cors-anywhere` proxy is unreliable. The recommended solution is to deploy your own free instance to a cloud provider.

### How to Deploy Your Own Free CORS Proxy (Heroku Example)

Deploying your own proxy is fast, free, and gives you a stable endpoint. Here’s the easiest way using Heroku:

1.  **Get a Heroku Account**: If you don't have one, sign up for a free account at [heroku.com](https://heroku.com).

2.  **Deploy with One Click**: Click the button below to automatically deploy the `cors-anywhere` proxy to your Heroku account.

    [![Deploy to Heroku](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/Rob--W/cors-anywhere)

3.  **Name Your App**: When prompted, give your application a unique name (e.g., `my-yeastar-proxy`).

4.  **Get Your URL**: After deployment, Heroku will give you the URL for your new proxy, which will be something like `https://my-yeastar-proxy.herokuapp.com/`.

### Application Setup

1.  **Enter Your Proxy URL**: In the Yeastar Dashboard's "API Configuration" section, paste your new Heroku URL into the "Proxy URL" field.
2.  **Enter PBX Details**: Fill in your PBX Host, Client ID, and Client Secret.
3.  **Whitelist the Proxy IP**: **Crucially**, you must whitelist the IP address of your proxy server in your Yeastar PBX's API settings, not your own IP.
4.  **Connect**: Click "Connect & Fetch Data".

By using your own proxy, you ensure a stable and reliable connection to your PBX.
