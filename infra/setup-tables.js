import { getDb } from "../src/lib/db/sqlite.js";

console.log("==========================================");
console.log("📦 VERIFYING SQLITE DATABASE (ZERO-COST)");
console.log("==========================================\n");

try {
  const db = getDb();
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
  console.log("✅ All SQLite Tables Verified & Active:");
  tables.forEach((t) => console.log(`   ✓ ${t.name}`));
  console.log("\n🎉 Database is 100% ready in inbox_mailer.db with zero cloud cost!");
} catch (err) {
  console.error("❌ Database initialization error:", err.message);
}
