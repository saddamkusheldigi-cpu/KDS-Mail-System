import { getWorkerDb } from "./db.js";

/**
 * Check if email is in the SQLite suppression list
 */
export async function isEmailSuppressed(email) {
  if (!email) return false;
  try {
    const db = getWorkerDb();
    const row = db
      .prepare("SELECT email FROM suppression_list WHERE email = ?")
      .get(email.trim().toLowerCase());
    return Boolean(row);
  } catch (err) {
    console.error("Error checking suppression status:", err.message);
    return false;
  }
}
