# SpringBank Demo - Deployment Guide

## Quick Start

This standalone banking demo is ready for deployment. Follow these steps to deploy to Vercel.

## Prerequisites

- Git installed on your system
- GitHub account
- Vercel account (free tier works)

## Deployment Steps

### Option 1: Deploy via Vercel Dashboard (Easiest)

1. **Push to GitHub (if not already done)**
   ```bash
   cd /path/to/springbank-website
   git checkout copilot/create-banking-demo-website
   git push origin copilot/create-banking-demo-website
   ```

2. **Go to Vercel Dashboard**
   - Visit https://vercel.com
   - Sign in with your GitHub account
   - Click "Add New Project"

3. **Import Repository**
   - Select "Import Git Repository"
   - Choose: `Shadow7user/springbank-website`
   - Select branch: `copilot/create-banking-demo-website`

4. **Configure Project**
   - Framework Preset: Other
   - Root Directory: `springbank-demo`
   - Build Command: (leave empty)
   - Output Directory: `springbank-demo`
   - Install Command: (leave empty)

5. **Deploy**
   - Click "Deploy"
   - Wait for deployment to complete
   - Your site will be live at: `https://springbank-website-[unique-id].vercel.app`

6. **Custom Domain (Optional)**
   - Go to Project Settings → Domains
   - Add: `springbank-demo.vercel.app` or your custom domain
   - Follow Vercel's DNS configuration instructions

### Option 2: Deploy via Vercel CLI

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel**
   ```bash
   vercel login
   ```

3. **Deploy**
   ```bash
   cd springbank-demo
   vercel --prod
   ```

4. **Follow Prompts**
   - Setup and deploy: Yes
   - Scope: Your account
   - Link to existing project: No
   - Project name: springbank-demo
   - Directory: ./
   - Override settings: No

5. **Done!**
   - Your site will be live
   - URL will be shown in terminal

### Option 3: Deploy to Netlify

1. **Go to Netlify Dashboard**
   - Visit https://app.netlify.com
   - Click "Add new site" → "Import an existing project"

2. **Connect to GitHub**
   - Choose GitHub
   - Select: `Shadow7user/springbank-website`
   - Select branch: `copilot/create-banking-demo-website`

3. **Configure Build Settings**
   - Base directory: `springbank-demo`
   - Build command: (leave empty)
   - Publish directory: `springbank-demo`

4. **Deploy**
   - Click "Deploy site"
   - Wait for deployment
   - Your site will be live at: `https://[unique-name].netlify.app`

## Configuration Files

The project includes:
- `vercel.json` - Vercel deployment configuration with security headers
- `README.md` - Complete documentation

## Post-Deployment Checklist

After deployment, verify:
- [ ] Site loads correctly
- [ ] All images display properly
- [ ] Navigation works on mobile and desktop
- [ ] Theme toggle functions
- [ ] Interactive elements respond
- [ ] Charts display (Chart.js loads from CDN)
- [ ] No console errors
- [ ] All links work
- [ ] Performance is acceptable (< 3s load time)

## Troubleshooting

### Charts not displaying
**Problem:** Chart.js not loading from CDN
**Solution:** 
- Check browser console for errors
- Verify CDN is accessible: https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js
- If CDN blocked, download Chart.js and serve locally

### Fonts not loading
**Problem:** Google Fonts blocked
**Solution:**
- Download Plus Jakarta Sans from Google Fonts
- Add font files to `assets/fonts/`
- Update CSS to use local fonts

### Images not displaying
**Problem:** Missing image files
**Solution:**
- Add placeholder images to `assets/images/`
- Update image references in HTML

### Mobile menu not working
**Problem:** JavaScript not executing
**Solution:**
- Check browser console for JavaScript errors
- Verify all JS files are loaded correctly
- Clear browser cache

## Custom Domain Setup

### Vercel
1. Go to Project Settings → Domains
2. Add your domain
3. Update DNS records as instructed
4. Wait for DNS propagation (up to 48 hours)

### Netlify
1. Go to Site Settings → Domain Management
2. Add custom domain
3. Configure DNS
4. Enable HTTPS (automatic)

## Performance Optimization

### Before going live:
1. **Optimize images**
   - Convert to WebP format
   - Compress with tools like TinyPNG
   - Add lazy loading

2. **Minify assets**
   - Minify CSS files
   - Minify JavaScript files
   - Use build tools if needed

3. **Enable CDN**
   - Vercel/Netlify automatically use CDN
   - Verify CDN headers in network inspector

4. **Test performance**
   - Run Lighthouse audit
   - Target: 90+ performance score
   - Check Core Web Vitals

## Security

The project includes security headers in `vercel.json`:
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- X-XSS-Protection: 1; mode=block
- Referrer-Policy: strict-origin-when-cross-origin

These are automatically applied on Vercel deployments.

## Monitoring

After deployment:
1. **Set up analytics**
   - Add Google Analytics
   - Or use Vercel Analytics
   - Or use Netlify Analytics

2. **Monitor uptime**
   - Use UptimeRobot or similar
   - Set up alerts

3. **Check errors**
   - Monitor browser console errors
   - Use Sentry or similar for error tracking

## Support

For issues or questions:
- Email: wonderstevie702@gmail.com
- Company: https://shadowspark-tech.org
- GitHub: @Shadow7user

## License

© 2024 Shadowspark Technologies. All rights reserved.

---

**Built by Stephen Chijioke Okoronkwo | Shadowspark Technologies**
