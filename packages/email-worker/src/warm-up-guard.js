import { getWorkerDb } from "./db.js";

export function getTodayDateKey() {
  const d = new Date();
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function verifyAndIncrementDailyLimit(defaultLimit = 1350) {
  const dateKey = getTodayDateKey();
  const now = new Date().toISOString();
  const db = getWorkerDb();

  let row = db.prepare("SELECT * FROM daily_stats WHERE date = ?").get(dateKey);
  if (!row) {
    db.prepare("INSERT INTO daily_stats (date, sentCount, dailyLimit, lastUpdated) VALUES (?, 0, ?, ?)")
      .run(dateKey, defaultLimit, now);
    row = { date: dateKey, sentCount: 0, dailyLimit: defaultLimit };
  }

  const limit = row.dailyLimit || defaultLimit;
  if (row.sentCount >= limit) {
    return {
      allowed: false,
      currentCount: row.sentCount,
      dailyLimit: limit,
      date: dateKey,
    };
  }

  db.prepare(`
    UPDATE daily_stats 
    SET sentCount = sentCount + 1, lastDispatchedAt = ?, lastUpdated = ?
    WHERE date = ?
  `).run(now, now, dateKey);

  return {
    allowed: true,
    currentCount: row.sentCount + 1,
    dailyLimit: limit,
    date: dateKey,
  };
}
