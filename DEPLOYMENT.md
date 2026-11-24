# 🚀 InboxMailer: Production Deployment Runbook

Complete step-by-step deployment guide for hosting **InboxMailer** on an **Ubuntu 22.04/24.04 LTS Server (AWS EC2, DigitalOcean, or Hetzner VPS)** with custom domain mapping (`mailer.yourdomain.com`), PM2 process orchestration, Nginx reverse proxy, and free SSL.

---

## 🏗️ System Architecture

```mermaid
flowchart TD
    User["User Browser / Admin"] -->|HTTPS :443| Domain["mailer.yourdomain.com"]
    Domain -->|SSL Termination| Nginx["Nginx Reverse Proxy"]
    Nginx -->|Proxy Pass :3000| NextApp["Next.js 14 App (PM2)"]
    
    subgraph Server["Production VPS / AWS EC2 Server"]
        NextApp -->|Reads / Writes| SQLite[("inbox_mailer.db (WAL Mode)")]
        Worker["Email Dispatch Worker (PM2)"] -->|Reads / Updates| SQLite
        Worker -->|Long Polling :ReceiveMessage| SQS["AWS SQS Queue"]
    end
    
    NextApp -->|Batch Enqueue| SQS
    Worker -->|SMTP / SES API| AmazonSES["Amazon SES / Google SMTP"]
    AmazonSES -->|Deliver 1,350/day (Pacing 35s)| Recipient["Lead Primary Inbox (Gmail/Outlook)"]
```

---

## 📋 Recommended Server Specifications

* **Operating System:** Ubuntu 22.04 LTS or Ubuntu 24.04 LTS
* **Hardware:** 2 vCPU, 2 GB RAM minimum (e.g. AWS `t3.small` / `t4g.small` or $6/mo VPS)
* **Storage:** 25 GB+ SSD / NVMe
* **Open Firewall Ports:** `22` (SSH), `80` (HTTP), `443` (HTTPS)

---

## 1️⃣ Step 1: Push Project to GitHub

Run these commands in your local project terminal (`C:\KDS\SL\Inbox-Mailer`):

```bash
# 1. Initialize git repository (if not already initialized)
git init

# 2. Add all files (excluding .env.local, .db, node_modules via .gitignore)
git add .

# 3. Create your first commit
git commit -m "feat: complete production-ready InboxMailer with no-code builder, 1MB limit & sqlite"

# 4. Set default branch to main
git branch -M main

# 5. Link your GitHub remote repository (Replace with your actual GitHub repo URL)
git remote add origin https://github.com/your-username/inbox-mailer.git

# 6. Push code to GitHub
git push -u origin main
```

> [!IMPORTANT]
> Verify that `.env.local` and `inbox_mailer.db` are **NOT** pushed to GitHub. They are already listed in `.gitignore` to keep your AWS credentials and database completely private.

---

## 2️⃣ Step 2: Server Initial Setup & Firewall

SSH into your Ubuntu server:

```bash
ssh -i /path/to/your-key.pem ubuntu@your-server-ip
```

Update system packages and enable firewall:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git ufw build-essential

# Configure Firewall (UFW)
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
```

---

## 3️⃣ Step 3: Install Node.js 24 & PM2

InboxMailer utilizes native `node:sqlite` introduced in modern Node.js, so **Node.js 24 LTS** is recommended:

```bash
# Install Node.js 24 from NodeSource
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node -v   # Should show v24.x
npm -v

# Install PM2 Process Manager globally
sudo npm install -g pm2
```

---

## 4️⃣ Step 4: Clone Repository & Setup Environment

```bash
# Create application directory
sudo mkdir -p /var/www/inbox-mailer
sudo chown -R $USER:$USER /var/www/inbox-mailer

# Clone your GitHub repository
cd /var/www/inbox-mailer
git clone https://github.com/your-username/inbox-mailer.git .

# Install dependencies
npm ci
```

### Create Production `.env.local`
Create the production environment file:

```bash
nano .env.local
```

Paste your live production configuration:

```env
# Application URLs
NEXT_PUBLIC_APP_URL="https://mailer.yourdomain.com"
APP_BASE_URL="https://mailer.yourdomain.com"

# AWS Serverless Infrastructure
AWS_REGION="ap-south-1"
AWS_ACCESS_KEY_ID="YOUR_AWS_ACCESS_KEY_ID"
AWS_SECRET_ACCESS_KEY="YOUR_AWS_SECRET_ACCESS_KEY"
SQS_DISPATCH_QUEUE_URL="https://sqs.ap-south-1.amazonaws.com/YOUR_ACCOUNT_ID/YOUR_QUEUE_NAME"

# Primary Sending Mailbox (SMTP)
SMTP_USER="YOUR_SMTP_USERNAME"
SMTP_PASS="YOUR_SMTP_PASSWORD"

# Delivery Throttling & Human Pacing (30 to 45 seconds between sends)
MIN_DELAY_MS="30000"
MAX_DELAY_MS="45000"
DAILY_SEND_LIMIT="1350"

# Cryptographic Token Secret (Change to any random secure string)
UNSUBSCRIBE_HMAC_SECRET="REPLACE_WITH_A_RANDOM_SECRET"
```

Save with `Ctrl+O`, Enter, then exit with `Ctrl+X`.

---

## 5️⃣ Step 5: Build Next.js & Verify SQLite Tables

```bash
# Verify SQLite Tables
npm run setup:tables

# Run internal test suite to verify 100% health
npm test

# Build optimized production bundle
npm run build
```

---

## 6️⃣ Step 6: Configure PM2 Dual-Process Orchestration

InboxMailer runs two concurrent processes:
1. **Next.js Web Server** (UI Dashboard & API endpoints on `localhost:3000`)
2. **Email Background Worker** (Listens to AWS SQS & handles 30–45s paced email dispatch)

Create a PM2 ecosystem file:

```bash
nano ecosystem.config.cjs
```

Paste the following configuration:

```javascript
module.exports = {
  apps: [
    {
      name: "inbox-mailer-web",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      cwd: "/var/www/inbox-mailer",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "800M",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
    {
      name: "inbox-mailer-worker",
      script: "packages/email-worker/src/local-runner.js",
      cwd: "/var/www/inbox-mailer",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
```

Start the processes and enable startup on server reboot:

```bash
# Start both applications
pm2 start ecosystem.config.cjs

# Check live status
pm2 status

# Save current PM2 processes to auto-start on server reboot
pm2 save
sudo pm2 startup systemd -u $USER --hp $HOME
```

---

## 7️⃣ Step 7: Configure Nginx Reverse Proxy

Install Nginx:

```bash
sudo apt install -y nginx
```

Create a new Nginx server configuration for your domain:

```bash
sudo nano /etc/nginx/sites-available/inbox-mailer
```

Paste the following Nginx block:

```nginx
server {
    listen 80;
    server_name mailer.yourdomain.com;

    # Allow up to 10 MB for email image uploads
    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Static assets caching
    location /_next/static {
        proxy_pass http://127.0.0.1:3000;
        proxy_cache_valid 200 365d;
        access_log off;
    }
}
```

Enable the site and restart Nginx:

```bash
sudo ln -s /etc/nginx/sites-available/inbox-mailer /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## 8️⃣ Step 8: Free SSL Certificate (Certbot Let's Encrypt)

> [!NOTE]
> Before running Certbot, make sure you have added an **A Record** in your DNS (GoDaddy, Cloudflare, Namecheap) pointing `mailer.yourdomain.com` to your server's public IP address.

Install Certbot and request the SSL certificate:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d mailer.yourdomain.com
```

Select option to automatically redirect all HTTP traffic to HTTPS. Certbot automatically configures auto-renewal!

---

## 9️⃣ Step 9: Corporate DNS Deliverability Records (95%+ Primary Inbox)

To guarantee that your emails land in the **Primary Inbox** rather than Spam or Promotions, add these 4 DNS records in your domain's DNS manager:

| Type | Name / Host | Value / Target | Purpose |
| :--- | :--- | :--- | :--- |
| **TXT** | `@` | `v=spf1 include:amazonses.com include:_spf.google.com ~all` | **SPF Record:** Authorizes SES and Google to send on your behalf. |
| **CNAME** | `* (from AWS SES)` | `feedback-smtp.ap-south-1.amazonses.com` (DKIM tokens from SES) | **DKIM:** Cryptographically signs each dispatched email. |
| **TXT** | `_dmarc` | `v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@yourdomain.com; pct=100; adkim=r; aspf=r` | **DMARC:** Protects domain from spoofing and enables Gmail blue checks. |
| **MX** | `@` | `10 inbound-smtp.ap-south-1.amazonaws.com` | **MX Record:** Allows server to handle bounce notifications. |

---

## 🔟 Step 10: Helpful Production Commands

```bash
# View live logs of both web app and email worker
pm2 logs

# View worker logs only (dispatches, delays, SQS messages)
pm2 logs inbox-mailer-worker

# Restart the application after code updates
git pull
npm run build
pm2 restart all

# Check SQLite Database Health
npm run setup:tables
```

🎉 **Congratulations!** Your enterprise bulk email platform is now live at `https://mailer.yourdomain.com`!
