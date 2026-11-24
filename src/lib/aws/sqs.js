import fs from "fs";
import path from "path";
import {
  SQSClient,
  SendMessageBatchCommand,
  DeleteMessageCommand,
  ChangeMessageVisibilityCommand,
  GetQueueAttributesCommand,
} from "@aws-sdk/client-sqs";

export function isAwsConfigured() {
  return Boolean(
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY &&
    process.env.AWS_ACCESS_KEY_ID.trim() !== "" &&
    process.env.AWS_ACCESS_KEY_ID !== "your_aws_access_key_id"
  );
}

const region = process.env.AWS_REGION || "ap-south-1";
export const QUEUE_URL = process.env.SQS_DISPATCH_QUEUE_URL || "";

let sqsClient = null;
if (isAwsConfigured()) {
  sqsClient = new SQSClient({
    region,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });
}

export { sqsClient };

const LOCAL_QUEUE_FILE = path.join(
  process.env.DATA_DIR || process.cwd(),
  ".local-queue.json"
);

function appendToLocalQueue(messages) {
  let existing = [];
  try {
    if (fs.existsSync(LOCAL_QUEUE_FILE)) {
      existing = JSON.parse(fs.readFileSync(LOCAL_QUEUE_FILE, "utf-8"));
    }
  } catch {
    existing = [];
  }
  const updated = [...existing, ...messages];
  fs.writeFileSync(LOCAL_QUEUE_FILE, JSON.stringify(updated, null, 2));
}

/**
 * Push an array of recipient tasks to SQS in chunks of 10
 */
export async function enqueueRecipientsBatch(campaignId, recipients) {
  // If AWS not configured, use local queue file for zero-setup offline testing
  if (!isAwsConfigured() || !QUEUE_URL) {
    const localMessages = recipients.map((recipient, idx) => ({
      messageId: `local_msg_${Date.now()}_${idx}`,
      receiptHandle: `handle_${Date.now()}_${idx}`,
      body: JSON.stringify({
        campaignId,
        email: recipient.email.toLowerCase(),
        name: recipient.name || "",
        company: recipient.company || "",
        customVariables: recipient.customVariables || {},
      }),
      createdAt: new Date().toISOString(),
    }));

    appendToLocalQueue(localMessages);
    return { totalEnqueued: localMessages.length, errors: [] };
  }

  const BATCH_SIZE = 10;
  let totalEnqueued = 0;
  const errors = [];

  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const chunk = recipients.slice(i, i + BATCH_SIZE);

    const entries = chunk.map((recipient, idx) => ({
      Id: `msg_${i + idx}_${Date.now()}`,
      MessageBody: JSON.stringify({
        campaignId,
        email: recipient.email.toLowerCase(),
        name: recipient.name || "",
        company: recipient.company || "",
        customVariables: recipient.customVariables || {},
      }),
    }));

    try {
      const response = await sqsClient.send(
        new SendMessageBatchCommand({
          QueueUrl: QUEUE_URL,
          Entries: entries,
        })
      );

      if (response.Successful) {
        totalEnqueued += response.Successful.length;
      }
      if (response.Failed && response.Failed.length > 0) {
        errors.push(...response.Failed);
      }
    } catch (err) {
      console.error(`Error sending SQS batch at index ${i}:`, err.message);
      errors.push({ error: err.message, chunkIndex: i });
    }
  }

  return { totalEnqueued, errors };
}

export async function deleteQueueMessage(receiptHandle, queueUrl = QUEUE_URL) {
  if (!isAwsConfigured() || !queueUrl || !receiptHandle) return;
  await sqsClient.send(
    new DeleteMessageCommand({
      QueueUrl: queueUrl,
      ReceiptHandle: receiptHandle,
    })
  );
}

export async function postponeQueueMessage(receiptHandle, delaySeconds = 43200, queueUrl = QUEUE_URL) {
  if (!isAwsConfigured() || !queueUrl || !receiptHandle) return;
  const safeDelay = Math.min(delaySeconds, 43200);
  await sqsClient.send(
    new ChangeMessageVisibilityCommand({
      QueueUrl: queueUrl,
      ReceiptHandle: receiptHandle,
      VisibilityTimeout: safeDelay,
    })
  );
}

export async function getQueueMetrics(queueUrl = QUEUE_URL) {
  if (!isAwsConfigured() || !queueUrl) {
    let count = 0;
    try {
      if (fs.existsSync(LOCAL_QUEUE_FILE)) {
        const msgs = JSON.parse(fs.readFileSync(LOCAL_QUEUE_FILE, "utf-8"));
        count = msgs.length;
      }
    } catch {
      count = 0;
    }
    return { visible: count, invisible: 0, delayed: 0 };
  }

  try {
    const res = await sqsClient.send(
      new GetQueueAttributesCommand({
        QueueUrl: queueUrl,
        AttributeNames: [
          "ApproximateNumberOfMessages",
          "ApproximateNumberOfMessagesNotVisible",
          "ApproximateNumberOfMessagesDelayed",
        ],
      })
    );
    const attrs = res.Attributes || {};
    return {
      visible: parseInt(attrs.ApproximateNumberOfMessages || "0", 10),
      invisible: parseInt(attrs.ApproximateNumberOfMessagesNotVisible || "0", 10),
      delayed: parseInt(attrs.ApproximateNumberOfMessagesDelayed || "0", 10),
    };
  } catch (err) {
    return { visible: 0, invisible: 0, delayed: 0 };
  }
}
