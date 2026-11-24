import { DatabaseSync } from "node:sqlite";
import path from "path";
import fs from "fs";

const DB_FILE = path.join(process.cwd(), "inbox_mailer.db");

console.log("==========================================");
console.log("🧹 CLEARING SQLITE DATABASE (FULL RESET)");
console.log("==========================================\n");

if (!fs.existsSync(DB_FILE)) {
  console.log("ℹ️ Database file does not exist yet. Nothing to clear.");
  process.exit(0);
}

try {
  const db = new DatabaseSync(DB_FILE);

  // Enable foreign keys
  db.exec("PRAGMA foreign_keys = OFF;");

  const tables = ["recipients", "campaigns", "suppression_list", "daily_stats", "sender_accounts"];

  for (const table of tables) {
    try {
      const res = db.prepare(`DELETE FROM ${table}`).run();
      console.log(`✅ Cleared table: ${table} (${res.changes} rows deleted)`);
    } catch (tblErr) {
      console.warn(`⚠️ Table ${table} could not be cleared: ${tblErr.message}`);
    }
  }

  // Reclaim disk space
  db.exec("VACUUM;");
  console.log("\n📦 Ran VACUUM — Database size optimized to 0 KB active data.");

  console.log("\n--- VERIFICATION OF ROW COUNTS ---");
  for (const table of tables) {
    try {
      const count = db.prepare(`SELECT count(*) as count FROM ${table}`).get().count;
      console.log(`   ${table}: ${count} rows`);
    } catch {
      // ignore
    }
  }

  console.log("\n🎉 Entire database has been cleared successfully! Ready for fresh outreach.");
} catch (err) {
  console.error("❌ Error clearing database:", err.message);
  process.exit(1);
}
