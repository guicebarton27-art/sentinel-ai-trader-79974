# Deployment Guide

## Quick Deploy Options

### 1. Netlify (Recommended)

#### Via Netlify UI
1. Go to [Netlify](https://app.netlify.com/)
2. Click "Add new site" → "Import an existing project"
3. Connect to GitHub and select `sentinel-ai-trader-79974`
4. Configure build settings:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
5. Add environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `VITE_SUPABASE_PROJECT_ID`
6. Deploy!

#### Via Netlify CLI
```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login
netlify login

# Initialize
netlify init

# Deploy
netlify deploy --prod
```

### 2. Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel

# Set environment variables
vercel env add VITE_SUPABASE_URL
vercel env add VITE_SUPABASE_PUBLISHABLE_KEY
vercel env add VITE_SUPABASE_PROJECT_ID

# Deploy to production
vercel --prod
```

### 3. GitHub Pages

```bash
# Install gh-pages
npm install -D gh-pages

# Add to package.json scripts:
# "deploy": "npm run build && gh-pages -d dist"

# Deploy
npm run deploy
```

### 4. Docker

```dockerfile
# Dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

Build and run:
```bash
docker build -t sentinel-trader .
docker run -p 8080:80 sentinel-trader
```

### 5. AWS S3 + CloudFront

```bash
# Build
npm run build

# Upload to S3
aws s3 sync dist/ s3://your-bucket-name --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id YOUR_DIST_ID \
  --paths "/*"
```

## Environment Variables

All deployment platforms require these environment variables:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_publishable_anon_key
VITE_SUPABASE_PROJECT_ID=your_project_id
```

## Post-Deployment Checklist

- [ ] Verify environment variables are set
- [ ] Test authentication flow
- [ ] Check API connectivity
- [ ] Verify real-time data updates
- [ ] Test bot controls (paper mode first!)
- [ ] Configure custom domain (optional)
- [ ] Set up SSL certificate
- [ ] Configure CDN/caching
- [ ] Set up monitoring (Sentry, LogRocket, etc.)
- [ ] Enable error tracking

## Custom Domain Setup

### Netlify
1. Go to Site settings → Domain management
2. Add custom domain
3. Configure DNS:
   ```
   A Record: @ → 75.2.60.5
   CNAME: www → your-site.netlify.app
   ```

### Vercel
1. Go to Project settings → Domains
2. Add domain
3. Configure DNS as instructed

## SSL/HTTPS

All recommended platforms (Netlify, Vercel) provide automatic SSL certificates via Let's Encrypt.

## Performance Optimization

1. **Enable Gzip/Brotli compression**
2. **Set cache headers** for static assets
3. **Use CDN** for global distribution
4. **Enable HTTP/2**
5. **Optimize images** (already handled by Vite)

## Monitoring & Analytics

### Recommended Tools
- **Sentry**: Error tracking
- **LogRocket**: Session replay
- **Google Analytics**: Usage analytics
- **UptimeRobot**: Uptime monitoring

### Setup Example (Sentry)

```bash
npm install @sentry/react @sentry/tracing
```

```typescript
// Add to main.tsx
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: "your_sentry_dsn",
  integrations: [new Sentry.BrowserTracing()],
  tracesSampleRate: 1.0,
});
```

## Rollback Strategy

### Netlify
- View deployments in dashboard
- Click "Publish deploy" on previous version

### Vercel
```bash
vercel rollback
```

### Git-based
```bash
git revert HEAD
git push origin main
```

## CI/CD Pipeline

### GitHub Actions Example

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm ci
      - run: npm run build
      - name: Deploy to Netlify
        uses: netlify/actions/cli@master
        with:
          args: deploy --prod
        env:
          NETLIFY_SITE_ID: ${{ secrets.NETLIFY_SITE_ID }}
          NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}
```

## Troubleshooting

### Build Fails
- Check Node.js version (18+ required)
- Clear node_modules: `rm -rf node_modules && npm install`
- Check environment variables are set

### Blank Page After Deploy
- Check browser console for errors
- Verify environment variables
- Check routing configuration (SPA mode)

### API Connection Issues
- Verify Supabase URL and keys
- Check CORS settings in Supabase
- Ensure row-level security policies are correct

## Security Considerations

1. **Never commit `.env` file**
2. **Use environment variables** for all secrets
3. **Enable RLS** in Supabase
4. **Set up rate limiting**
5. **Use HTTPS only**
6. **Implement CSP headers**
7. **Regular dependency updates**

## Support

For deployment issues:
1. Check build logs
2. Review [Netlify docs](https://docs.netlify.com/)
3. Open GitHub issue
4. Contact support

---

**Happy deploying! 🚀**
