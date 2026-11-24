import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../../../");
const LOCAL_QUEUE_FILE = path.join(
  process.env.DATA_DIR || rootDir,
  ".local-queue.json"
);

// Helper to load env files in standalone worker script
function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

// Automatically load .env.local and .env
loadEnvFile(path.join(rootDir, ".env.local"));
loadEnvFile(path.join(rootDir, ".env"));

// Dynamic import after env vars are populated
const { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } = await import("@aws-sdk/client-sqs");
const { handler } = await import("./index.js");

const region = process.env.AWS_REGION || "ap-south-1";
const queueUrl = process.env.SQS_DISPATCH_QUEUE_URL;
const hasAwsKeys = Boolean(
  process.env.AWS_ACCESS_KEY_ID?.trim() &&
  process.env.AWS_SECRET_ACCESS_KEY?.trim() &&
  process.env.AWS_ACCESS_KEY_ID !== "your_aws_access_key_id"
);

console.log("==================================================");
console.log("🚀 INBOX-MAILER: LOCAL WORKER DAEMON STARTED");
console.log(`🌍 AWS Region:    ${region}`);
console.log(`📬 Dispatch Mode:  ${hasAwsKeys && queueUrl ? "AWS SQS Live" : "Local File Queue (.local-queue.json)"}`);
console.log(`🧪 Mock SES Mode: ${process.env.MOCK_SES === "true" ? "ENABLED (Ethereal Preview)" : "DISABLED (Live SES)"}`);
console.log("==================================================\n");

let isRunning = true;
function stopWorker() {
  if (!isRunning) return;
  console.log("\n🛑 Stopping worker after the current message...");
  isRunning = false;
}

process.on("SIGINT", stopWorker);
process.on("SIGTERM", stopWorker);

// Helper for local JSON queue polling
function popFromLocalQueue() {
  if (!fs.existsSync(LOCAL_QUEUE_FILE)) return null;
  const content = fs.readFileSync(LOCAL_QUEUE_FILE, "utf-8");
  const msgs = JSON.parse(content);
  if (!Array.isArray(msgs)) {
    throw new Error(`Local queue must contain a JSON array: ${LOCAL_QUEUE_FILE}`);
  }
  if (msgs.length === 0) return null;

  const nextMsg = msgs.shift();
  fs.writeFileSync(LOCAL_QUEUE_FILE, JSON.stringify(msgs, null, 2));
  return nextMsg;
}

function requeueLocalMessage(item) {
  const msgs = fs.existsSync(LOCAL_QUEUE_FILE)
    ? JSON.parse(fs.readFileSync(LOCAL_QUEUE_FILE, "utf-8"))
    : [];
  if (!Array.isArray(msgs)) {
    throw new Error(`Local queue must contain a JSON array: ${LOCAL_QUEUE_FILE}`);
  }
  msgs.unshift(item);
  fs.writeFileSync(LOCAL_QUEUE_FILE, JSON.stringify(msgs, null, 2));
}

async function runPollingLoop() {
  // If AWS SQS is configured, poll real SQS queue
  if (hasAwsKeys && queueUrl) {
    console.log(`📡 Polling AWS SQS queue: ${queueUrl} ...\n`);
    const sqsClient = new SQSClient({
      region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });

    try {
      while (isRunning) {
        try {
          const res = await sqsClient.send(
            new ReceiveMessageCommand({
              QueueUrl: queueUrl,
              MaxNumberOfMessages: 1,
              WaitTimeSeconds: 10,
              VisibilityTimeout: 90,
            })
          );

          if (res.Messages && res.Messages.length > 0) {
            const msg = res.Messages[0];
            console.log(`📥 Received message from SQS: ${msg.MessageId}`);

            const mockEvent = {
              Records: [
                {
                  messageId: msg.MessageId,
                  receiptHandle: msg.ReceiptHandle,
                  body: msg.Body,
                  attributes: msg.Attributes || {},
                  eventSourceARN: "aws:sqs",
                },
              ],
            };

            const result = await handler(mockEvent, {});
            if (result?.status === "BATCH_COMPLETE") {
              await sqsClient.send(
                new DeleteMessageCommand({
                  QueueUrl: queueUrl,
                  ReceiptHandle: msg.ReceiptHandle,
                })
              );
              console.log(`🗑️ Deleted processed message from SQS.\n`);
            }
          }
        } catch (err) {
          console.error("SQS Poll error:", err.message);
          await new Promise((r) => setTimeout(r, 5000));
        }
      }
    } finally {
      sqsClient.destroy();
    }
    return;
  }

  // Otherwise, poll local file queue for 100% offline local testing!
  console.log("📁 Polling local queue file (.local-queue.json) for campaigns...");
  console.log("💡 Tip: Create a campaign on http://localhost:3000 to see live dispatch here!\n");

  while (isRunning) {
    const item = popFromLocalQueue();
    if (item) {
      console.log(`\n📥 Received local message: ${item.messageId}`);
      const mockEvent = {
        Records: [
          {
            messageId: item.messageId,
            receiptHandle: item.receiptHandle,
            body: item.body,
            attributes: {},
            eventSourceARN: "local-file-queue",
          },
        ],
      };

      try {
        const result = await handler(mockEvent, {});
        if (result?.status === "BATCH_COMPLETE") {
          console.log(`✨ Local message ${item.messageId} successfully processed.\n`);
        } else {
          requeueLocalMessage(item);
          console.warn(`⏳ Local message ${item.messageId} deferred (${result?.status || "unknown status"}).\n`);
          await new Promise((r) => setTimeout(r, 2000));
        }
      } catch (procErr) {
        requeueLocalMessage(item);
        console.error("Local worker processing error:", procErr.message);
        await new Promise((r) => setTimeout(r, 2000));
      }
    } else {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

runPollingLoop().catch((err) => {
  console.error("Worker runner stopped unexpectedly:", err);
  process.exitCode = 1;
});
