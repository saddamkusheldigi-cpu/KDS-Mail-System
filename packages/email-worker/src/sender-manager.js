import { getWorkerDb } from "./db.js";

function getTodayKey() {
  const d = new Date();
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Fetch a single sender account by ID from SQLite
 */
export async function getSenderById(id) {
  if (!id) return null;
  const db = getWorkerDb();
  const row = db.prepare("SELECT * FROM sender_accounts WHERE id = ?").get(id);
  if (!row) return null;
  return {
    ...row,
    smtpSecure: Boolean(row.smtpSecure),
  };
}

let poolRotationIndex = 0;

/**
 * Select the next available sender from an inbox pool using round-robin and daily limit checks
 */
export async function getAvailableSenderFromPool(poolIds = []) {
  if (!Array.isArray(poolIds) || poolIds.length === 0) return null;

  const today = getTodayKey();
  const db = getWorkerDb();
  const senders = [];

  for (const id of poolIds) {
    const s = await getSenderById(id);
    if (s && s.status === "ACTIVE") {
      if (s.lastSentDate !== today) {
        db.prepare("UPDATE sender_accounts SET sentToday = 0, lastSentDate = ? WHERE id = ?").run(
          today,
          id
        );
        s.sentToday = 0;
        s.lastSentDate = today;
      }
      senders.push(s);
    }
  }

  if (senders.length === 0) return null;

  const availableSenders = senders.filter((s) => (s.sentToday || 0) < (s.dailyLimit || 50));
  if (availableSenders.length === 0) {
    console.warn("⚠️ All inboxes in the pool have reached their daily sending limit for today!");
    return null;
  }

  const selected = availableSenders[poolRotationIndex % availableSenders.length];
  poolRotationIndex = (poolRotationIndex + 1) % availableSenders.length;

  return selected;
}

/**
 * Increment sent count for a specific inbox in SQLite
 */
export async function incrementSenderSent(id) {
  if (!id) return false;
  const today = getTodayKey();
  const now = new Date().toISOString();
  const db = getWorkerDb();

  db.prepare(`
    UPDATE sender_accounts 
    SET sentToday = sentToday + 1, lastDispatchedAt = ?, lastSentDate = ?, updatedAt = ?
    WHERE id = ?
  `).run(now, today, now, id);

  const s = await getSenderById(id);
  if (s) {
    console.log(`📈 [INBOX TRACKER] ${s.email}: ${s.sentToday}/${s.dailyLimit} sent today.`);
  }
  return true;
}
