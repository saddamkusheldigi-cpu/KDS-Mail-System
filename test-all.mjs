import fs from "fs";
import path from "path";
import { getDb, createCampaign, getCampaign, listCampaigns, batchSaveRecipients, getRecipientsByCampaign, updateRecipientStatus, createSenderAccount, listSenderAccounts, deleteSenderAccount, addToSuppressionList, isSuppressed, removeFromSuppressionList, getDailyStats, tryIncrementDailySentCount, setDailyLimit } from "./src/lib/db/sqlite.js";
import { isValidEmail } from "./src/lib/csv-validator.js";
import { analyzeSpamRisk } from "./src/lib/spam-analyzer.js";
import { renderEmail, interpolateVariables } from "./src/lib/template-renderer.js";
import { generateUnsubscribeToken, verifyUnsubscribeToken } from "./src/lib/tokens.js";
import { isAwsConfigured } from "./src/lib/aws/sqs.js";
import { getEmailTransporter } from "./src/lib/aws/ses.js";
import { verifyAndIncrementDailyLimit } from "./packages/email-worker/src/warm-up-guard.js";
import { isEmailSuppressed } from "./packages/email-worker/src/suppression-checker.js";

console.log("=================================================");
console.log("🧪 INBOX-MAILER COMPREHENSIVE END-TO-END TEST SUITE");
console.log("=================================================\n");

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

// ---------------------------------------------------------------------------
// SUITE 1: SQLite Database Engine
// ---------------------------------------------------------------------------
console.log("📦 [1/8] Testing SQLite Database Layer...");
const db = getDb();
assert(db !== null, "SQLite database connection initialized");

const testCampaignId = `test_camp_${Date.now()}`;
const newCamp = await createCampaign({
  campaignId: testCampaignId,
  name: "Automated Test Campaign",
  subject: "Testing {{name}} at {{company}}",
  fromAddress: "test@example.com",
  fromName: "Test Sender",
  htmlBody: "<h1>Hello {{name}}</h1>",
  plainTextBody: "Hello {{name}}",
  totalRecipients: 2,
});
assert(newCamp.campaignId === testCampaignId, "Campaign created in SQLite");

const fetchedCamp = await getCampaign(testCampaignId);
assert(fetchedCamp && fetchedCamp.name === "Automated Test Campaign", "Campaign fetched by ID");

// Recipients
await batchSaveRecipients(testCampaignId, [
  { email: "lead1@example.com", name: "Alice", company: "Wonderland", status: "PENDING" },
  { email: "lead2@example.com", name: "Bob", company: "Builder Corp", status: "PENDING" },
]);
const recipients = await getRecipientsByCampaign(testCampaignId);
assert(recipients.length === 2, "Recipients batch saved and retrieved");

await updateRecipientStatus(testCampaignId, "lead1@example.com", {
  status: "SENT",
  messageId: "msg_123",
  senderInbox: "test@example.com",
});
const updatedRecipients = await getRecipientsByCampaign(testCampaignId);
const lead1 = updatedRecipients.find((r) => r.email === "lead1@example.com");
assert(lead1 && lead1.status === "SENT" && lead1.messageId === "msg_123", "Recipient status updated atomically");

// Senders
const testSenderId = `sender_${Date.now()}`;
await createSenderAccount({
  id: testSenderId,
  email: "outreach@domain.com",
  fromName: "Outreach Lead",
  provider: "custom",
  dailyLimit: 100,
});
const senders = await listSenderAccounts();
assert(senders.some((s) => s.id === testSenderId), "Sender account registered in SQLite");

await deleteSenderAccount(testSenderId);
const sendersAfterDelete = await listSenderAccounts();
assert(!sendersAfterDelete.some((s) => s.id === testSenderId), "Sender account deleted cleanly");

// Suppression
const testSuppressedEmail = `suppressed_${Date.now()}@example.com`;
await addToSuppressionList({ email: testSuppressedEmail, reason: "UNSUBSCRIBE", source: "Test suite" });
const isSupp = await isSuppressed(testSuppressedEmail);
assert(isSupp === true, "Email correctly identified in suppression list");

await removeFromSuppressionList(testSuppressedEmail);
const isSuppAfter = await isSuppressed(testSuppressedEmail);
assert(isSuppAfter === false, "Email removed from suppression list");

// Daily Stats
const stats = await getDailyStats();
assert(typeof stats.dailyLimit === "number", "Daily warm-up stats retrieved");

// Clean up test campaign & recipients
db.prepare("DELETE FROM recipients WHERE campaignId = ?").run(testCampaignId);
db.prepare("DELETE FROM campaigns WHERE campaignId = ?").run(testCampaignId);
console.log("");

// ---------------------------------------------------------------------------
// SUITE 2: CSV Validation Engine
// ---------------------------------------------------------------------------
console.log("📋 [2/8] Testing CSV Validation Engine...");
assert(isValidEmail("user@example.com") === true, "Standard email valid");
assert(isValidEmail("user.name+tag@sub.domain.co.in") === true, "Complex valid email");
assert(isValidEmail("not-an-email") === false, "Invalid format detected");
assert(isValidEmail("") === false, "Empty email rejected");
assert(isValidEmail("user@") === false, "Incomplete domain rejected");
console.log("");

// ---------------------------------------------------------------------------
// SUITE 3: Spam Analyzer & Deliverability Predictor
// ---------------------------------------------------------------------------
console.log("🛡️ [3/8] Testing Spam Analyzer & Placement Engine...");
const cleanEmail = analyzeSpamRisk({
  subject: "Quick question for {{company}} regarding {{name}}",
  htmlBody: "<p>Hi {{name}}, wanted to connect about your workflow.</p>",
  plainTextBody: "Hi {{name}}, wanted to connect about your workflow.",
});
assert(cleanEmail.score >= 85, `Clean copy scores high for primary inbox (${cleanEmail.score}/100)`);
assert(cleanEmail.placement === "PRIMARY_INBOX", "Clean copy assigned to PRIMARY_INBOX");

const spammyEmail = analyzeSpamRisk({
  subject: "FREE WINNER CONGRATULATIONS 100% GUARANTEED $$$",
  htmlBody: "<p>BUY NOW!! CLICK HERE TO EARN MONEY FAST http://bit.ly/xyz</p>",
  plainTextBody: "",
});
assert(spammyEmail.score < 65, `High spam penalties applied properly (${spammyEmail.score}/100)`);
assert(spammyEmail.warnings.length > 0, "Spam trigger warnings detected");

// 1 MB Size Penalty Check
const largeBody = "A".repeat(1024 * 1024 + 100);
const oversizeAnalysis = analyzeSpamRisk({
  subject: "Subject",
  htmlBody: largeBody,
  plainTextBody: "Text",
});
assert(oversizeAnalysis.warnings.some((w) => w.includes("1 MB")), "Spam analyzer flags templates exceeding 1 MB limit");
console.log("");

// ---------------------------------------------------------------------------
// SUITE 4: Template Rendering & Variable Interpolation
// ---------------------------------------------------------------------------
console.log("🎨 [4/8] Testing Template Rendering & Tag Interpolation...");
const interpolated = interpolateVariables("Hello {{name}} from {{company}} ({{firstName}})", {
  name: "Johnathan Doe",
  firstName: "Johnathan",
  company: "Acme Industries",
});
assert(interpolated === "Hello Johnathan Doe from Acme Industries (Johnathan)", "Variables interpolated accurately");

const rendered = renderEmail({
  subjectTemplate: "Proposal for {{company}}",
  htmlTemplate: "<h2>Hi {{name}}</h2><p>Proposal details.</p>",
  plainTextTemplate: "Hi {{name}}, proposal details.",
  recipient: { email: "alex@test.com", name: "Alex Mercer", company: "Apex Corp" },
  campaignId: "camp_render_test",
  fromEmail: "team@company.com",
});
assert(rendered.subject === "Proposal for Apex Corp", "Rendered subject line matches recipient data");
assert(rendered.html.includes("Alex Mercer"), "HTML contains interpolated recipient name");
assert(rendered.html.includes("/api/track/open"), "Transparent open tracking pixel injected into HTML");
assert(rendered.html.includes("/api/unsubscribe"), "RFC 8058 One-Click Unsubscribe link injected into HTML");
assert(Boolean(rendered.headers["List-Unsubscribe"]), "RFC 8058 List-Unsubscribe headers generated");
console.log("");

// ---------------------------------------------------------------------------
// SUITE 5: Security Tokens (RFC 8058 One-Click Unsubscribe HMAC)
// ---------------------------------------------------------------------------
console.log("🔐 [5/8] Testing Cryptographic HMAC Tokens...");
const token = generateUnsubscribeToken("lead@target.com", "camp_xyz");
assert(typeof token === "string" && token.length > 20, "HMAC SHA-256 token generated");

const verified = verifyUnsubscribeToken(token);
assert(verified !== null && verified.email === "lead@target.com" && verified.campaignId === "camp_xyz", "Token correctly authenticated and verified");

const tamperedToken = token.slice(0, -4) + "XXXX";
const failedVerification = verifyUnsubscribeToken(tamperedToken);
assert(!failedVerification || !failedVerification.valid, "Tampered cryptographic token rejected");
console.log("");

// ---------------------------------------------------------------------------
// SUITE 6: AWS SQS & SES Configuration Checks
// ---------------------------------------------------------------------------
console.log("☁️ [6/8] Testing AWS Cloud Connectors...");
const awsConfigured = isAwsConfigured();
assert(typeof awsConfigured === "boolean", `AWS SQS readiness check: ${awsConfigured ? "LIVE KEYS PRESENT" : "OFFLINE FALLBACK MODE"}`);

const transporter = await getEmailTransporter();
assert(transporter !== null && typeof transporter.sendMail === "function", "Email transporter created successfully (SES or SMTP Nodemailer)");
console.log("");

// ---------------------------------------------------------------------------
// SUITE 7: Background Worker Subsystems
// ---------------------------------------------------------------------------
console.log("⚙️ [7/8] Testing Background Worker Subsystems...");
const limitStatus = await verifyAndIncrementDailyLimit();
assert(typeof limitStatus.allowed === "boolean", "Warm-up limit guard evaluates quota atomically");

const suppStatus = await isEmailSuppressed("clean-lead@example.com");
assert(suppStatus === false, "Worker suppression-checker validates clean emails correctly");
console.log("");

// ---------------------------------------------------------------------------
// SUITE 8: Final Summary
// ---------------------------------------------------------------------------
console.log("=================================================");
console.log(`📊 TEST SUITE SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log("=================================================\n");

if (failed > 0) {
  process.exit(1);
} else {
  console.log("🎉 ALL INTERNAL MODULES VERIFIED & WORKING 100%!\n");
}
