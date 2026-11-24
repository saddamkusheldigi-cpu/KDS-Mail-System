# 🚀 InboxMailer: Production Bulk Email System

Enterprise-grade Cold Email & Bulk Outreach dispatch engine hosted on AWS Serverless infrastructure (`mailer.yourdomain.com`), capable of sending **40,000 emails/month (~1,350/day)** with **90–95%+ Primary Inbox deliverability**, automated human pacing (30–45s jitter), zero-cost SQLite database, and real-time spam prediction.

---

## 🌟 Key Features

1. **₹0 Cloud Database Cost (SQLite + WAL Mode):**
   * High-performance local SQLite database (`inbox_mailer.db`) using Node.js native `node:sqlite`.
   * Concurrent multi-process safe with Write-Ahead Logging (`PRAGMA journal_mode = WAL`).
2. **AWS SQS Buffered Queue & Throttled Worker:**
   * Batches recipient jobs to AWS SQS (`ap-south-1`).
   * Background worker dispatches 1 email every 30–45 seconds with natural jitter delay to mimic human sending and bypass Gmail/Outlook bulk spam filters.
3. **No-Code Dynamic Visual Email Designer:**
   * WYSIWYG click-and-type editor for non-coders (bold, italic, alignments, lists).
   * 1-Click pre-made high-converting templates (B2B Outreach, Product Hero Banner, Promo Discount, Minimalist Personal).
   * Visual block inserters for CTA buttons, images, and highlight cards.
   * Pure Plain-Text mode with live auto-sync.
4. **Strict 1 MB Size Hard Limit:**
   * Automatic payload meter in UI and backend API enforcement preventing any email from exceeding 1 MB (protects against ISP clipping and penalties).
5. **Real-Time Spam Risk & Placement Predictor (0–100 Score):**
   * Scans copy for 20+ spam trigger words, ALL CAPS, link shorteners, and missing plain text fallbacks.
   * 1-Click Instant Seed Test Send box to physically check inbox placement on your own phone.
6. **Multi-Domain & Multi-SMTP Management:**
   * Round-robin account rotation pool across Google Workspace, Outlook, Amazon SES, and Custom Webmail.
7. **RFC 8058 One-Click Unsubscribe & Compliance:**
   * Cryptographic HMAC SHA-256 tokens and Amazon SES automated bounce/complaint suppression.

---

## 📁 Repository Structure

```
Inbox-Mailer/
├── DEPLOYMENT.md              # 📖 Complete step-by-step production deployment guide
├── test-all.mjs               # 🧪 Automated regression test suite (33 tests)
├── sample-contacts.csv        # 📋 Sample leads CSV template
├── infra/
│   ├── clear-db.js            # Database reset & VACUUM script
│   └── setup-tables.js        # SQLite table schema verification script
├── packages/
│   └── email-worker/          # Background worker service
│       ├── src/
│       │   ├── index.js       # Main SQS message processor & dispatcher
│       │   ├── local-runner.js# Standalone daemon for server & local
│       │   ├── sender-manager.js # Round-robin inbox rotation engine
│       │   ├── warm-up-guard.js  # Atomic daily cap enforcer
│       │   ├── suppression-checker.js
│       │   └── template-renderer.js
│       └── package.json
└── src/
    ├── app/
    │   ├── (dashboard)/       # Next.js 14 App Router UI pages
    │   │   ├── page.jsx       # Deliverability & quota dashboard
    │   │   ├── campaigns/     # Campaign management & creation wizard
    │   │   ├── senders/       # Multi-SMTP inboxes & DNS checker
    │   │   ├── suppression/   # Blocklist & bounce management
    │   │   └── settings/      # Warm-up tiers & configurations
    │   └── api/               # Serverless API routes
    ├── components/
    │   └── EmailVisualBuilder.jsx # No-code drag/click visual designer
    └── lib/
        ├── db/sqlite.js       # Native SQLite database layer
        ├── email-templates.js # Pre-made pro outreach templates
        ├── spam-analyzer.js   # 0-100 deliverability predictor
        └── template-renderer.js
```

---

## 🚀 Quick Start (Local Development)

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment (`.env.local`)
Create `.env.local` in project root:
```env
NEXT_PUBLIC_APP_URL="http://localhost:3000"
AWS_REGION="ap-south-1"
AWS_ACCESS_KEY_ID="your_aws_key"
AWS_SECRET_ACCESS_KEY="your_aws_secret"
SQS_DISPATCH_QUEUE_URL="https://sqs.ap-south-1.amazonaws.com/your-account/email-dispatch-queue"
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-google-app-password"
```

### 3. Run Automated Tests
```bash
npm test
```

### 4. Start Next.js Web App
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Start Background Dispatch Worker (In separate terminal)
```bash
npm run worker:dev
```
The runner polls AWS SQS when `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and
`SQS_DISPATCH_QUEUE_URL` are configured; otherwise it polls `.local-queue.json`.
Stop it with Ctrl+C. Deferred or failed local messages are returned to the queue.

GitHub Actions runs tests and a build on pushes and pull requests targeting
`main`. A successful push to `main` also builds and deploys a Docker container
on the local RHEL 9 machine using a self-hosted runner. Pull requests never
deploy.

### Deploy to a local RHEL 9 machine

The RHEL 9 machine must be x86_64 and have outbound HTTPS access to GitHub. It
does not need to be reachable from the public internet; the self-hosted runner
connects outward to GitHub and deploys locally.

1. Install Docker Engine, the Compose plugin, Git, rsync, and curl:

   ```bash
   sudo dnf install -y dnf-plugins-core git rsync curl
   sudo dnf config-manager --add-repo https://download.docker.com/linux/rhel/docker-ce.repo
   sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
   sudo systemctl enable --now docker
   ```

   The workflow can install missing Docker packages and start the daemon if the
   runner has non-interactive `sudo` access. Otherwise, run these commands
   manually as an administrator.

2. Use the same Linux account that runs the self-hosted runner. The runner
   service account needs write access to the app directory and Docker access:

   ```bash
   RUNNER_USER="$(id -un)"
   sudo mkdir -p /var/www/inbox-mailer
   sudo chown -R "$RUNNER_USER:$RUNNER_USER" /var/www/inbox-mailer
   sudo usermod -aG docker "$RUNNER_USER"
   ```

3. In the GitHub repository, open **Settings → Actions → Runners → New
   self-hosted runner**. Follow GitHub's displayed Linux x64 download steps on
   the RHEL machine as the runner service account. Use the short-lived token
   shown there to configure the runner with the additional label `rhel9`, then
   install and start its service as that same account. Restart the runner
   service after adding the Docker group so it receives the new permission.
   The workflow requires labels `self-hosted`, `linux`, `x64`, and `rhel9`.

4. Create `/var/www/inbox-mailer/.env.local` on the RHEL machine. Add the real
   app URL, unsubscribe secret, SES/SQS or SMTP settings there, then restrict
   access:

   ```bash
   sudo chown "$(id -un):$(id -gn)" /var/www/inbox-mailer/.env.local
   sudo chmod 600 /var/www/inbox-mailer/.env.local
   ```

   Never commit `.env.local` or put production credentials in GitHub variables.
   The workflow preserves this file, SQLite data, the local queue, uploaded
   images, and the Next.js cache in host folders.

5. Add the repository Actions variable `NEXT_PUBLIC_APP_URL` with the app's
   public URL. Put the same value in the machine's `.env.local`. No EC2 SSH
   secrets are needed.

6. On successful pushes to `main`, Actions syncs the code into
   `/var/www/inbox-mailer`, builds the image on the RHEL machine, and starts the
   app and email worker together in a Docker container. SQLite data, uploaded
   images, and cache are stored outside the container so they survive rebuilds.
   If Docker packages are missing or the daemon is stopped, the workflow tries
   to install/start them with non-interactive `sudo`. After a successful push
   deployment, it creates a unique timestamp tag such as `v20261124.3`.

Manual redeploys are available via **Actions → CI and Docker deploy to RHEL →
Run workflow** on `main`. Back up `inbox_mailer.db` before deploying updates.
The dashboard and APIs currently have no login; keep the service on a trusted
network or add authentication before exposing it publicly.

---

The older Ubuntu/VPS deployment runbook is available in
[DEPLOYMENT.md](./DEPLOYMENT.md).
