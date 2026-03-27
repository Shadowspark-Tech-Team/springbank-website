# Setting Up SpringBank Demo as Separate Repository

This guide will help you create a separate GitHub repository for the SpringBank Demo and deploy it to Vercel.

## 🎯 Overview

The SpringBank Demo is currently in a subfolder of the main springbank-website repository. This guide helps you extract it into its own repository for independent deployment.

## 📋 Prerequisites

- Git installed on your system
- GitHub account
- Vercel account (free tier works fine)
- Terminal/Command line access

## 🚀 Step-by-Step Setup

### Step 1: Create New GitHub Repository

1. Go to https://github.com/new
2. Fill in the repository details:
   - **Repository name**: `springbank-demo`
   - **Description**: "Premium digital banking demo showcasing modern financial services - Built by Shadowspark Technologies"
   - **Visibility**: Public (or Private if you prefer)
   - **Initialize**: Do NOT check "Add a README file" (we already have one)
3. Click "Create repository"
4. Copy the repository URL (e.g., `https://github.com/Shadow7user/springbank-demo.git`)

### Step 2: Extract SpringBank Demo to Separate Repository

Open your terminal and run these commands:

```bash
# Navigate to your workspace
cd ~

# Create a new directory for the separate repo
mkdir springbank-demo-repo
cd springbank-demo-repo

# Copy all files from the springbank-demo folder
# Replace the path below with the actual path to your springbank-website repo
cp -r /path/to/springbank-website/springbank-demo/* .
cp -r /path/to/springbank-website/springbank-demo/.* . 2>/dev/null || true

# Initialize new git repository
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit: SpringBank Premium Banking Demo

Created by: Stephen Chijioke Okoronkwo
Company: Shadowspark Technologies
Features: Investment dashboard, portfolio tracking, money transfer, security center"

# Add remote origin (replace with your new repo URL)
git remote add origin https://github.com/Shadow7user/springbank-demo.git

# Push to GitHub
git branch -M main
git push -u origin main
```

### Step 3: Verify Repository Structure

After pushing, verify your new repository has this structure:

```
springbank-demo/
├── index.html                  # Main HTML file
├── vercel.json                 # Vercel deployment config
├── README.md                   # Project documentation
├── DEPLOYMENT.md              # Deployment guide
├── SETUP_SEPARATE_REPO.md     # This file
├── .gitignore                 # Git ignore rules
└── assets/
    ├── css/
    │   ├── main.css           # Core styles
    │   ├── components.css     # Component styles
    │   └── animations.css     # Animations
    └── js/
        ├── main.js            # Core functionality
        ├── charts.js          # Chart.js integrations
        └── ui.js              # UI interactions
```

### Step 4: Deploy to Vercel

#### Option A: Vercel Dashboard (Recommended for First Time)

1. Go to https://vercel.com
2. Sign in with GitHub
3. Click "Add New Project"
4. Click "Import Git Repository"
5. Search for and select `springbank-demo`
6. Configure project:
   - **Framework Preset**: Other
   - **Root Directory**: `./` (current directory)
   - **Build Command**: Leave empty
   - **Output Directory**: Leave empty
   - **Install Command**: Leave empty
7. Click "Deploy"
8. Wait for deployment (usually 30-60 seconds)
9. Your site will be live at: `https://springbank-demo-[hash].vercel.app`

#### Option B: Vercel CLI (For Command Line Users)

```bash
# Install Vercel CLI globally
npm install -g vercel

# Navigate to your repo
cd ~/springbank-demo-repo

# Login to Vercel
vercel login

# Deploy to production
vercel --prod

# Follow the prompts:
# - Set up and deploy: Y
# - Which scope: Select your account
# - Link to existing project: N
# - Project name: springbank-demo
# - Directory: ./
# - Want to override settings: N
```

### Step 5: Configure Custom Domain (Optional)

#### On Vercel:
1. Go to your project settings
2. Click "Domains"
3. Add your domain: `springbank-demo.vercel.app` or custom domain
4. Follow DNS configuration instructions
5. Wait for DNS propagation (up to 48 hours)

### Step 6: Set Up Continuous Deployment

Vercel automatically sets up continuous deployment. Every push to `main` branch will trigger a new deployment.

To deploy a different branch:
```bash
git checkout -b feature-branch
# Make changes
git add .
git commit -m "Add new feature"
git push origin feature-branch

# Deploy preview
vercel
```

## 🔧 Configuration

### Environment Variables (if needed in future)

If you need to add environment variables:

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add variables like:
   - `API_KEY`
   - `DATABASE_URL`
   - etc.

### Security Headers

The `vercel.json` file includes security headers:
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- X-XSS-Protection: 1; mode=block
- Referrer-Policy: strict-origin-when-cross-origin

These are automatically applied on deployment.

## ✅ Post-Deployment Checklist

After deployment, verify:
- [ ] Site loads correctly at Vercel URL
- [ ] All sections display properly
- [ ] Navigation works on mobile and desktop
- [ ] Theme toggle functions
- [ ] Charts render correctly
- [ ] Interactive elements respond
- [ ] Stock ticker animates
- [ ] Calculator works
- [ ] No console errors
- [ ] All links work
- [ ] Images load properly
- [ ] Performance is good (run Lighthouse)

## 🐛 Troubleshooting

### Issue: Charts not displaying
**Solution**: Chart.js loads from CDN. Check:
- Browser console for errors
- Network tab for failed requests
- Try different browser
- Check if CDN is accessible: https://cdn.jsdelivr.net/npm/chart.js

### Issue: Deployment fails
**Solution**:
- Check `vercel.json` syntax
- Ensure all files are committed
- Check Vercel build logs
- Verify repository is public or Vercel has access

### Issue: Styles not loading
**Solution**:
- Check file paths in HTML
- Verify CSS files are in `assets/css/` folder
- Check browser console for 404 errors
- Clear browser cache

### Issue: Site is slow
**Solution**:
- Run Lighthouse audit
- Optimize images (convert to WebP)
- Enable caching headers (already in vercel.json)
- Consider CDN for assets

## 📊 Monitoring

Set up monitoring:
1. **Vercel Analytics**: Enable in project settings
2. **Google Analytics**: Add tracking code to index.html
3. **Uptime Monitoring**: Use UptimeRobot or similar
4. **Error Tracking**: Consider Sentry for production

## 🔄 Updating the Site

To make updates:

```bash
# Make changes to files
# ...

# Commit and push
git add .
git commit -m "Update: Description of changes"
git push origin main

# Vercel will automatically deploy
```

## 📞 Support

For issues or questions:
- **Email**: wonderstevie702@gmail.com
- **Company**: https://shadowspark-tech.org
- **GitHub**: @Shadow7user
- **Phone**: +234 904 577 0572

## 📝 Next Steps

After successful deployment:

1. **Share the URL**: Share your deployed site with clients
2. **Add Custom Domain**: If needed, configure your own domain
3. **Set Up Analytics**: Track visitor metrics
4. **Enable HTTPS**: Vercel provides automatic HTTPS
5. **Test Performance**: Run Lighthouse and optimize
6. **Monitor Uptime**: Set up monitoring alerts

## 🎉 Congratulations!

You now have a separate repository for SpringBank Demo deployed to Vercel!

**Live URL**: Your site is accessible at the Vercel URL provided after deployment.

---

**Built with ❤️ by Stephen Chijioke Okoronkwo | Shadowspark Technologies**

© 2024 Shadowspark Technologies. All rights reserved.
