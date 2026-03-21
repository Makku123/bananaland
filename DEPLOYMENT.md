# Deployment Guide for Monopoly Game

## Local Development

### Quick Start
```bash
cd backend
npm install
npm start
```
Then open `http://localhost:3000` in your browser.

## Deploy to Heroku (Free)

### Prerequisites
- Heroku CLI installed
- Git initialized in the project
- GitHub account (optional, but recommended)

### Steps

1. **Install Heroku CLI** (if not already installed):
   ```bash
   npm install -g heroku
   ```

2. **Login to Heroku**:
   ```bash
   heroku login
   ```

3. **Create a Procfile** (already created in the project root):
   ```
   web: cd backend && node server.js
   ```

4. **Create a Heroku app**:
   ```bash
   heroku create your-monopoly-game
   ```

5. **Deploy**:
   ```bash
   git push heroku main
   ```

6. **View logs** (if needed):
   ```bash
   heroku logs --tail
   ```

Your game will be available at `https://your-monopoly-game.herokuapp.com`

## Deploy to Render (Recommended - Free)

### Steps

1. **Push to GitHub first**:
   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. **Go to https://render.com and sign up**

3. **Create new Web Service**:
   - Connect your GitHub repo
   - Set build command: `cd backend && npm install`
   - Set start command: `cd backend && npm start`
   - Set environment: `Node`

4. **Deploy**:
   - Click "Create Web Service"
   - Render will automatically deploy when you push to GitHub

## Deploy to Railway (Recommended - Free tier available)

### Steps

1. **Go to https://railway.app and sign up**

2. **Connect your GitHub repository**

3. **Create a new project**

4. **Add the following environment variables**:
   - `PORT`: 3000 (optional, Railway assigns automatically)

5. **Add `Procfile`** to root:
   ```
   web: cd backend && node server.js
   ```

6. **Deploy**: Railway will auto-deploy when you push to GitHub

## Deploy to AWS EC2

### Steps

1. **Launch EC2 Instance**:
   - Choose Ubuntu 20.04 LTS
   - Open ports 80, 443, 3000

2. **Connect and set up**:
   ```bash
   ssh -i your-key.pem ubuntu@your-instance-ip
   
   # Install Node.js
   curl -sL https://deb.nodesource.com/setup_16.x | sudo -E bash -
   sudo apt-get install -y nodejs
   
   # Clone your repo
   git clone your-repo-url
   cd monopoly/backend
   
   # Install dependencies
   npm install
   
   # Start with PM2 for persistence
   npm install -g pm2
   pm2 start server.js
   pm2 startup
   pm2 save
   ```

## Deploy to DigitalOcean

### Steps

1. **Create a Droplet** (Ubuntu 20.04)

2. **SSH into your droplet**:
   ```bash
   ssh root@your-droplet-ip
   ```

3. **Set up Node.js**:
   ```bash
   curl -sL https://deb.nodesource.com/setup_16.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

4. **Clone and start the app**:
   ```bash
   git clone your-repo-url
   cd monopoly/backend
   npm install
   npm start
   ```

5. **Set up Nginx as reverse proxy** (optional but recommended):
   ```bash
   sudo apt install nginx
   ```

   Create `/etc/nginx/sites-available/monopoly`:
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "upgrade";
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```

   Enable it:
   ```bash
   sudo ln -s /etc/nginx/sites-available/monopoly /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

## Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Use environment variables for configuration
- [ ] Enable HTTPS/SSL certificate (Let's Encrypt)
- [ ] Set up database for persistence (optional)
- [ ] Configure monitoring and logging
- [ ] Set up backups
- [ ] Use a process manager (PM2, systemd)
- [ ] Configure rate limiting
- [ ] Set up error tracking (Sentry)

## Environment Variables

Create a `.env` file in the backend directory:
```
PORT=3000
NODE_ENV=production
ALLOWED_ORIGINS=https://yourdomain.com
```

Then update `server.js` to read from `.env`:
```javascript
require('dotenv').config();
const PORT = process.env.PORT || 3000;
```

Install dotenv:
```bash
npm install dotenv
```

## Continuous Deployment

### GitHub Actions

Create `.github/workflows/deploy.yml`:
```yaml
name: Deploy to Heroku

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Deploy to Heroku
        run: |
          git remote add heroku https://git.heroku.com/${{ secrets.HEROKU_APP_NAME }}.git
          git push heroku main
        env:
          HEROKU_API_KEY: ${{ secrets.HEROKU_API_KEY }}
```

## Custom Domain

### For Heroku
```bash
heroku domains:add your-domain.com
# Then update your DNS records with the provided CNAME
```

### For other platforms
Update your DNS provider with the appropriate CNAME or A record pointing to your deployment.

## Performance Optimization

- Enable gzip compression
- Use CDN for static files
- Implement caching headers
- Use a load balancer for multiple instances
- Monitor WebSocket connections specifically

## Troubleshooting Deployment

### Port Issues
- Ensure PORT environment variable is set
- Check firewall rules
- Verify no other service is using the port

### WebSocket Connection Failed
- Ensure WebSocket upgrade is allowed through proxies
- Check CORS configuration
- Verify HTTPS if using SSL

### Database Connection Issues (if using database)
- Check connection string
- Verify firewall allows database access
- Ensure database is running

For more help, refer to the main README.md
