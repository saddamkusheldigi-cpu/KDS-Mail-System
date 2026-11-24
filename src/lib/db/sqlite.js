import { DatabaseSync } from "node:sqlite";
import path from "path";
import fs from "fs";

const DB_DIR = process.env.DATA_DIR || process.cwd();
const DB_FILE = path.join(DB_DIR, "inbox_mailer.db");

// Singleton connection instance
let dbInstance = null;

export function getDb() {
  if (dbInstance) return dbInstance;

  fs.mkdirSync(DB_DIR, { recursive: true });
  const isNew = !fs.existsSync(DB_FILE);
  dbInstance = new DatabaseSync(DB_FILE);

  // Enable WAL (Write-Ahead Logging) mode for concurrent Next.js & Worker read/write
  dbInstance.exec("PRAGMA journal_mode = WAL;");
  dbInstance.exec("PRAGMA synchronous = NORMAL;");

  // 1. Campaigns Table
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS campaigns (
      campaignId TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      subject TEXT NOT NULL,
      fromAddress TEXT NOT NULL,
      fromName TEXT,
      replyTo TEXT,
      senderStrategy TEXT DEFAULT 'SINGLE',
      senderAccountId TEXT,
      senderAccountPool TEXT,
      htmlBody TEXT NOT NULL,
      plainTextBody TEXT,
      status TEXT DEFAULT 'QUEUED',
      totalRecipients INTEGER DEFAULT 0,
      sentCount INTEGER DEFAULT 0,
      openedCount INTEGER DEFAULT 0,
      failedCount INTEGER DEFAULT 0,
      pendingCount INTEGER DEFAULT 0,
      bouncedCount INTEGER DEFAULT 0,
      unsubscribedCount INTEGER DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
  `);

  // 2. Recipients Table
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS recipients (
      campaignId TEXT NOT NULL,
      email TEXT NOT NULL,
      name TEXT,
      company TEXT,
      customVariables TEXT,
      status TEXT DEFAULT 'PENDING',
      errorMessage TEXT,
      messageId TEXT,
      senderInbox TEXT,
      retryCount INTEGER DEFAULT 0,
      sentAt TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      PRIMARY KEY (campaignId, email)
    );
    CREATE INDEX IF NOT EXISTS idx_recipients_email ON recipients(email);
    CREATE INDEX IF NOT EXISTS idx_recipients_campaign_status ON recipients(campaignId, status);
  `);

  // 3. Sender Accounts Table (Multi-SMTP & Inboxes)
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS sender_accounts (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      fromName TEXT,
      replyTo TEXT,
      domain TEXT,
      provider TEXT DEFAULT 'custom',
      smtpHost TEXT,
      smtpPort INTEGER DEFAULT 587,
      smtpSecure INTEGER DEFAULT 0,
      smtpUser TEXT,
      smtpPass TEXT,
      dailyLimit INTEGER DEFAULT 50,
      sentToday INTEGER DEFAULT 0,
      lastSentDate TEXT,
      lastDispatchedAt TEXT,
      status TEXT DEFAULT 'ACTIVE',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
  `);

  // 4. Suppression List Table
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS suppression_list (
      email TEXT PRIMARY KEY,
      reason TEXT NOT NULL,
      source TEXT,
      details TEXT,
      createdAt TEXT NOT NULL
    );
  `);

  // 5. Daily Stats Table (Warm-Up Guard)
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS daily_stats (
      date TEXT PRIMARY KEY,
      sentCount INTEGER DEFAULT 0,
      dailyLimit INTEGER DEFAULT 1350,
      lastDispatchedAt TEXT,
      lastUpdated TEXT
    );
  `);

  // Auto-migrate from .local-db.json if initial run
  if (isNew) {
    try {
      const localJson = path.join(process.cwd(), ".local-db.json");
      if (fs.existsSync(localJson)) {
        const raw = JSON.parse(fs.readFileSync(localJson, "utf-8"));
        // Migrate campaigns
        if (raw.campaigns) {
          const insertCamp = dbInstance.prepare(`
            INSERT OR REPLACE INTO campaigns (
              campaignId, name, subject, fromAddress, fromName, replyTo,
              senderStrategy, senderAccountId, senderAccountPool, htmlBody,
              plainTextBody, status, totalRecipients, sentCount, openedCount,
              failedCount, pendingCount, bouncedCount, unsubscribedCount, createdAt, updatedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          for (const c of Object.values(raw.campaigns)) {
            insertCamp.run(
              c.campaignId,
              c.name || "Campaign",
              c.subject || "",
              c.fromAddress || "",
              c.fromName || "",
              c.replyTo || "",
              c.senderStrategy || "SINGLE",
              c.senderAccountId || null,
              JSON.stringify(c.senderAccountPool || []),
              c.htmlBody || "",
              c.plainTextBody || "",
              c.status || "COMPLETED",
              Number(c.totalRecipients || 0),
              Number(c.sentCount || 0),
              Number(c.openedCount || 0),
              Number(c.failedCount || 0),
              Number(c.pendingCount || 0),
              Number(c.bouncedCount || 0),
              Number(c.unsubscribedCount || 0),
              c.createdAt || new Date().toISOString(),
              c.updatedAt || new Date().toISOString()
            );
          }
        }

        // Migrate recipients
        if (raw.recipients) {
          const insertRec = dbInstance.prepare(`
            INSERT OR REPLACE INTO recipients (
              campaignId, email, name, company, customVariables, status,
              errorMessage, messageId, senderInbox, retryCount, sentAt, createdAt, updatedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          for (const r of Object.values(raw.recipients)) {
            insertRec.run(
              r.campaignId,
              r.email.toLowerCase(),
              r.name || "",
              r.company || "",
              JSON.stringify(r.customVariables || {}),
              r.status || "PENDING",
              r.errorMessage || null,
              r.messageId || null,
              r.senderInbox || null,
              Number(r.retryCount || 0),
              r.sentAt || null,
              r.createdAt || new Date().toISOString(),
              r.updatedAt || new Date().toISOString()
            );
          }
        }

        // Migrate senders
        if (raw.senderAccounts) {
          const insertSender = dbInstance.prepare(`
            INSERT OR REPLACE INTO sender_accounts (
              id, email, fromName, replyTo, domain, provider, smtpHost, smtpPort,
              smtpSecure, smtpUser, smtpPass, dailyLimit, sentToday, lastSentDate,
              lastDispatchedAt, status, createdAt, updatedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          for (const s of Object.values(raw.senderAccounts)) {
            insertSender.run(
              s.id,
              s.email.toLowerCase(),
              s.fromName || "",
              s.replyTo || "",
              s.domain || "",
              s.provider || "custom",
              s.smtpHost || "",
              Number(s.smtpPort || 587),
              s.smtpSecure ? 1 : 0,
              s.smtpUser || s.email,
              s.smtpPass || "",
              Number(s.dailyLimit || 50),
              Number(s.sentToday || 0),
              s.lastSentDate || null,
              s.lastDispatchedAt || null,
              s.status || "ACTIVE",
              s.createdAt || new Date().toISOString(),
              s.updatedAt || new Date().toISOString()
            );
          }
        }
      }
    } catch (migErr) {
      console.warn("Could not auto-seed from .local-db.json:", migErr.message);
    }
  }

  return dbInstance;
}

export function getTodayDateString() {
  const d = new Date();
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// ==========================================
// CAMPAIGNS HELPERS
// ==========================================

export async function createCampaign(campaign) {
  const db = getDb();
  const now = new Date().toISOString();
  const total = Number(campaign.totalRecipients || 0);

  const item = {
    ...campaign,
    status: campaign.status || "QUEUED",
    totalRecipients: total,
    sentCount: 0,
    openedCount: 0,
    failedCount: 0,
    pendingCount: total,
    bouncedCount: 0,
    unsubscribedCount: Number(campaign.unsubscribedCount || 0),
    createdAt: now,
    updatedAt: now,
  };

  const poolStr = Array.isArray(campaign.senderAccountPool)
    ? JSON.stringify(campaign.senderAccountPool)
    : "[]";

  const stmt = db.prepare(`
    INSERT INTO campaigns (
      campaignId, name, subject, fromAddress, fromName, replyTo,
      senderStrategy, senderAccountId, senderAccountPool, htmlBody,
      plainTextBody, status, totalRecipients, sentCount, openedCount,
      failedCount, pendingCount, bouncedCount, unsubscribedCount, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    item.campaignId,
    item.name.trim(),
    item.subject.trim(),
    item.fromAddress.trim(),
    item.fromName || "Team",
    item.replyTo || item.fromAddress.trim(),
    item.senderStrategy || "SINGLE",
    item.senderAccountId || null,
    poolStr,
    item.htmlBody,
    item.plainTextBody || "",
    item.status,
    item.totalRecipients,
    item.sentCount,
    item.openedCount,
    item.failedCount,
    item.pendingCount,
    item.bouncedCount,
    item.unsubscribedCount,
    item.createdAt,
    item.updatedAt
  );

  return item;
}

export async function getCampaign(campaignId) {
  const db = getDb();
  const row = db.prepare("SELECT * FROM campaigns WHERE campaignId = ?").get(campaignId);
  if (!row) return null;

  try {
    row.senderAccountPool = JSON.parse(row.senderAccountPool || "[]");
  } catch {
    row.senderAccountPool = [];
  }
  return row;
}

export async function listCampaigns(limit = 100) {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM campaigns ORDER BY createdAt DESC LIMIT ?").all(limit);
  return rows.map((r) => {
    try {
      r.senderAccountPool = JSON.parse(r.senderAccountPool || "[]");
    } catch {
      r.senderAccountPool = [];
    }
    return r;
  });
}

export async function updateCampaignStatus(campaignId, status) {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare("UPDATE campaigns SET status = ?, updatedAt = ? WHERE campaignId = ?").run(
    status,
    now,
    campaignId
  );
  return getCampaign(campaignId);
}

export async function incrementCampaignStats(campaignId, fieldName, incrementBy = 1) {
  const db = getDb();
  const now = new Date().toISOString();

  // Whitelisted fields to prevent SQL injection
  const allowed = [
    "sentCount",
    "openedCount",
    "failedCount",
    "bouncedCount",
    "unsubscribedCount",
  ];
  if (!allowed.includes(fieldName)) return null;

  if (fieldName === "sentCount" || fieldName === "failedCount") {
    db.prepare(`
      UPDATE campaigns 
      SET ${fieldName} = ${fieldName} + ?,
          pendingCount = MAX(0, pendingCount - ?),
          status = CASE WHEN (pendingCount - ?) <= 0 THEN 'COMPLETED' ELSE 'PROCESSING' END,
          updatedAt = ?
      WHERE campaignId = ?
    `).run(incrementBy, incrementBy, incrementBy, now, campaignId);
  } else {
    db.prepare(`
      UPDATE campaigns 
      SET ${fieldName} = ${fieldName} + ?,
          updatedAt = ?
      WHERE campaignId = ?
    `).run(incrementBy, now, campaignId);
  }

  return getCampaign(campaignId);
}

// ==========================================
// RECIPIENTS HELPERS
// ==========================================

export async function batchSaveRecipients(campaignId, recipients = []) {
  if (recipients.length === 0) return;
  const db = getDb();
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO recipients (
      campaignId, email, name, company, customVariables, status,
      errorMessage, messageId, senderInbox, retryCount, sentAt, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  db.exec("BEGIN TRANSACTION;");
  try {
    for (const r of recipients) {
      stmt.run(
        campaignId,
        r.email.trim().toLowerCase(),
        r.name || "",
        r.company || "",
        JSON.stringify(r.customVariables || {}),
        r.status || "PENDING",
        r.errorMessage || null,
        r.messageId || null,
        r.senderInbox || null,
        Number(r.retryCount || 0),
        r.sentAt || null,
        now,
        now
      );
    }
    db.exec("COMMIT;");
  } catch (err) {
    db.exec("ROLLBACK;");
    throw err;
  }
}

export async function getRecipientsByCampaign(campaignId, statusFilter = null, limit = 200) {
  const db = getDb();
  let rows;

  if (statusFilter && statusFilter !== "ALL") {
    rows = db
      .prepare(
        "SELECT * FROM recipients WHERE campaignId = ? AND status = ? ORDER BY createdAt ASC LIMIT ?"
      )
      .all(campaignId, statusFilter, limit);
  } else {
    rows = db
      .prepare("SELECT * FROM recipients WHERE campaignId = ? ORDER BY createdAt ASC LIMIT ?")
      .all(campaignId, limit);
  }

  return rows.map((r) => {
    try {
      r.customVariables = JSON.parse(r.customVariables || "{}");
    } catch {
      r.customVariables = {};
    }
    return r;
  });
}

export async function updateRecipientStatus(
  campaignId,
  email,
  { status, messageId, errorMessage, senderInbox }
) {
  const db = getDb();
  const now = new Date().toISOString();
  const normalizedEmail = email.trim().toLowerCase();

  const existing = db
    .prepare("SELECT * FROM recipients WHERE campaignId = ? AND email = ?")
    .get(campaignId, normalizedEmail);

  if (!existing) {
    // Insert if doesn't exist yet
    db.prepare(`
      INSERT INTO recipients (
        campaignId, email, status, messageId, errorMessage, senderInbox, sentAt, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      campaignId,
      normalizedEmail,
      status,
      messageId || null,
      errorMessage || null,
      senderInbox || null,
      messageId ? now : null,
      now,
      now
    );
  } else {
    const finalMsgId = messageId || existing.messageId;
    const finalErr = errorMessage || existing.errorMessage;
    const finalInbox = senderInbox || existing.senderInbox;
    const finalSentAt = messageId ? now : existing.sentAt;

    db.prepare(`
      UPDATE recipients 
      SET status = ?, messageId = ?, errorMessage = ?, senderInbox = ?, sentAt = ?, updatedAt = ?
      WHERE campaignId = ? AND email = ?
    `).run(status, finalMsgId, finalErr, finalInbox, finalSentAt, now, campaignId, normalizedEmail);
  }

  return db
    .prepare("SELECT * FROM recipients WHERE campaignId = ? AND email = ?")
    .get(campaignId, normalizedEmail);
}

export async function findRecipientByEmail(email) {
  const db = getDb();
  return db
    .prepare("SELECT * FROM recipients WHERE email = ? LIMIT 20")
    .all(email.trim().toLowerCase());
}

// ==========================================
// SUPPRESSION LIST HELPERS
// ==========================================

export async function addToSuppressionList(emailOrObj, reasonArg, sourceArg, detailsArg) {
  let email, reason, source, details;
  if (typeof emailOrObj === "object" && emailOrObj !== null) {
    ({ email, reason, source, details } = emailOrObj);
  } else {
    email = emailOrObj;
    reason = reasonArg;
    source = sourceArg;
    details = detailsArg;
  }

  const db = getDb();
  const now = new Date().toISOString();
  const normalized = (email || "").trim().toLowerCase();

  db.prepare(`
    INSERT OR REPLACE INTO suppression_list (email, reason, source, details, createdAt)
    VALUES (?, ?, ?, ?, ?)
  `).run(normalized, reason, source || "manual", details || null, now);

  return { email: normalized, reason, source, details, createdAt: now };
}

export async function isSuppressed(email) {
  const db = getDb();
  const row = db
    .prepare("SELECT email FROM suppression_list WHERE email = ?")
    .get(email.trim().toLowerCase());
  return Boolean(row);
}

export async function getSuppressionList(limit = 200) {
  const db = getDb();
  return db.prepare("SELECT * FROM suppression_list ORDER BY createdAt DESC LIMIT ?").all(limit);
}

export const listSuppression = getSuppressionList;

export async function removeFromSuppressionList(email) {
  const db = getDb();
  db.prepare("DELETE FROM suppression_list WHERE email = ?").run(email.trim().toLowerCase());
  return true;
}

// ==========================================
// DAILY STATS HELPERS (WARM-UP GUARD)
// ==========================================

export async function getDailyStats(dateStr = getTodayDateString()) {
  const db = getDb();
  let row = db.prepare("SELECT * FROM daily_stats WHERE date = ?").get(dateStr);
  if (!row) {
    const defaultLimit = 1350;
    db.prepare("INSERT INTO daily_stats (date, sentCount, dailyLimit, lastUpdated) VALUES (?, 0, ?, ?)")
      .run(dateStr, defaultLimit, new Date().toISOString());
    row = { date: dateStr, sentCount: 0, dailyLimit: defaultLimit };
  }
  return row;
}

export async function setDailyLimit(dateStr = getTodayDateString(), limit = 1350) {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO daily_stats (date, sentCount, dailyLimit, lastUpdated)
    VALUES (?, 0, ?, ?)
    ON CONFLICT(date) DO UPDATE SET dailyLimit = excluded.dailyLimit, lastUpdated = excluded.lastUpdated
  `).run(dateStr, Number(limit), now);

  return getDailyStats(dateStr);
}

export async function tryIncrementDailySentCount(
  dateStr = getTodayDateString(),
  fallbackLimit = 1350
) {
  const db = getDb();
  const now = new Date().toISOString();

  let row = db.prepare("SELECT * FROM daily_stats WHERE date = ?").get(dateStr);
  if (!row) {
    db.prepare("INSERT INTO daily_stats (date, sentCount, dailyLimit, lastUpdated) VALUES (?, 0, ?, ?)")
      .run(dateStr, fallbackLimit, now);
    row = { date: dateStr, sentCount: 0, dailyLimit: fallbackLimit };
  }

  const limit = row.dailyLimit || fallbackLimit;
  if (row.sentCount >= limit) {
    return { success: false, currentCount: row.sentCount, dailyLimit: limit };
  }

  db.prepare(`
    UPDATE daily_stats 
    SET sentCount = sentCount + 1, lastDispatchedAt = ?, lastUpdated = ?
    WHERE date = ?
  `).run(now, now, dateStr);

  return { success: true, currentCount: row.sentCount + 1, dailyLimit: limit };
}

// ==========================================
// SENDER ACCOUNTS (MULTI-SMTP & INBOXES)
// ==========================================

export async function createSenderAccount(sender) {
  const db = getDb();
  const today = getTodayDateString();
  const now = new Date().toISOString();

  const id = sender.id || `sender_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const email = sender.email.trim().toLowerCase();

  db.prepare(`
    INSERT INTO sender_accounts (
      id, email, fromName, replyTo, domain, provider, smtpHost, smtpPort,
      smtpSecure, smtpUser, smtpPass, dailyLimit, sentToday, lastSentDate,
      status, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    email,
    sender.fromName || "",
    sender.replyTo || email,
    sender.domain || email.split("@")[1] || "",
    sender.provider || "custom",
    sender.smtpHost || "",
    Number(sender.smtpPort || 587),
    sender.smtpSecure ? 1 : 0,
    sender.smtpUser || email,
    sender.smtpPass || "",
    Number(sender.dailyLimit || 50),
    0,
    today,
    sender.status || "ACTIVE",
    now,
    now
  );

  return getSenderAccount(id);
}

export async function listSenderAccounts() {
  const db = getDb();
  const today = getTodayDateString();

  // Auto-reset daily limits if new day
  db.prepare("UPDATE sender_accounts SET sentToday = 0, lastSentDate = ? WHERE lastSentDate != ?").run(
    today,
    today
  );

  const rows = db.prepare("SELECT * FROM sender_accounts ORDER BY createdAt DESC").all();
  return rows.map((r) => ({
    ...r,
    smtpSecure: Boolean(r.smtpSecure),
  }));
}

export async function getSenderAccount(id) {
  const db = getDb();
  const row = db.prepare("SELECT * FROM sender_accounts WHERE id = ?").get(id);
  if (!row) return null;
  return {
    ...row,
    smtpSecure: Boolean(row.smtpSecure),
  };
}

export async function updateSenderAccount(id, updates = {}) {
  const db = getDb();
  const now = new Date().toISOString();

  const keys = Object.keys(updates);
  if (keys.length === 0) return getSenderAccount(id);

  const setClauses = keys.map((k) => `${k} = ?`).join(", ");
  const values = keys.map((k) => (k === "smtpSecure" ? (updates[k] ? 1 : 0) : updates[k]));

  db.prepare(`UPDATE sender_accounts SET ${setClauses}, updatedAt = ? WHERE id = ?`).run(
    ...values,
    now,
    id
  );

  return getSenderAccount(id);
}

export async function deleteSenderAccount(id) {
  const db = getDb();
  db.prepare("DELETE FROM sender_accounts WHERE id = ?").run(id);
  return true;
}

export async function incrementSenderSentCount(id) {
  const db = getDb();
  const today = getTodayDateString();
  const now = new Date().toISOString();

  const account = getSenderAccount(id);
  if (!account) return { success: false, reason: "Account not found" };

  if (account.lastSentDate !== today) {
    db.prepare("UPDATE sender_accounts SET sentToday = 0, lastSentDate = ? WHERE id = ?").run(
      today,
      id
    );
    account.sentToday = 0;
  }

  if (account.sentToday >= account.dailyLimit) {
    return { success: false, reason: "Daily limit exceeded", item: account };
  }

  db.prepare(`
    UPDATE sender_accounts 
    SET sentToday = sentToday + 1, lastDispatchedAt = ?, lastSentDate = ?, updatedAt = ?
    WHERE id = ?
  `).run(now, today, now, id);

  return { success: true, item: await getSenderAccount(id) };
}
