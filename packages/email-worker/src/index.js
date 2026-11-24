import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { SQSClient, ChangeMessageVisibilityCommand } from "@aws-sdk/client-sqs";
import nodemailer from "nodemailer";

import { getTransporter } from "./ses-client.js";
import { renderEmail } from "./template-renderer.js";
import { isEmailSuppressed } from "./suppression-checker.js";
import { verifyAndIncrementDailyLimit } from "./warm-up-guard.js";
import {
  getSenderById,
  getAvailableSenderFromPool,
  incrementSenderSent,
} from "./sender-manager.js";
import { getWorkerDb } from "./db.js";

const region = process.env.AWS_REGION || "ap-south-1";
const hasAwsKeys = Boolean(
  process.env.AWS_ACCESS_KEY_ID &&
  process.env.AWS_SECRET_ACCESS_KEY &&
  process.env.AWS_ACCESS_KEY_ID.trim() !== "" &&
  process.env.AWS_ACCESS_KEY_ID !== "your_aws_access_key_id"
);

let sqsClient = null;

if (hasAwsKeys) {
  const credentials = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  };
  sqsClient = new SQSClient({ region, credentials });
}

// Memory cache for campaign templates
const campaignCache = new Map();

/**
 * Fetch campaign metadata from SQLite with caching
 */
async function getCachedCampaign(campaignId) {
  if (campaignCache.has(campaignId)) {
    return campaignCache.get(campaignId);
  }

  try {
    const db = getWorkerDb();
    const row = db.prepare("SELECT * FROM campaigns WHERE campaignId = ?").get(campaignId);
    if (row) {
      try {
        row.senderAccountPool = JSON.parse(row.senderAccountPool || "[]");
      } catch {
        row.senderAccountPool = [];
      }
      campaignCache.set(campaignId, row);
      return row;
    }
  } catch (err) {
    console.warn("Could not fetch campaign from SQLite:", err.message);
  }

  // Fallback mock campaign template
  const mockCampaign = {
    campaignId,
    name: "Outreach Campaign",
    subject: "Hello {{name}}, quick question for {{company}}",
    fromAddress: process.env.SMTP_USER || "info@yourdomain.com",
    fromName: "Outreach Team",
    replyTo: process.env.SMTP_USER || "info@yourdomain.com",
    htmlBody: `
      <h2>Hi {{name}},</h2>
      <p>This is a test outreach message for <strong>{{company}}</strong>.</p>
    `,
    plainTextBody: "Hi {{name}}, this is a test outreach message for {{company}}.",
  };
  campaignCache.set(campaignId, mockCampaign);
  return mockCampaign;
}

/**
 * Update recipient status in SQLite
 */
async function updateRecipient(campaignId, email, { status, messageId, errorMessage, senderInbox }) {
  try {
    const db = getWorkerDb();
    const now = new Date().toISOString();
    const normalizedEmail = email.toLowerCase();

    db.prepare(`
      UPDATE recipients 
      SET status = ?,
          messageId = COALESCE(?, messageId),
          errorMessage = ?,
          senderInbox = COALESCE(?, senderInbox),
          sentAt = CASE WHEN ? IS NOT NULL THEN ? ELSE sentAt END,
          updatedAt = ?
      WHERE campaignId = ? AND email = ?
    `).run(
      status,
      messageId || null,
      errorMessage || null,
      senderInbox || null,
      messageId || null,
      now,
      now,
      campaignId,
      normalizedEmail
    );

    console.log(`📝 [SQLITE SYNC] Recipient ${email} -> ${status} ${senderInbox ? `[via ${senderInbox}]` : ""}`);
  } catch (err) {
    console.error("Failed to update recipient in SQLite:", err.message);
  }
}

/**
 * Update campaign aggregate stats atomically in SQLite
 */
async function updateCampaignStats(campaignId, fieldToIncrement) {
  try {
    const db = getWorkerDb();
    const now = new Date().toISOString();

    if (fieldToIncrement === "sentCount" || fieldToIncrement === "failedCount") {
      db.prepare(`
        UPDATE campaigns 
        SET ${fieldToIncrement} = ${fieldToIncrement} + 1,
            pendingCount = MAX(0, pendingCount - 1),
            status = CASE WHEN (pendingCount - 1) <= 0 THEN 'COMPLETED' ELSE 'PROCESSING' END,
            updatedAt = ?
        WHERE campaignId = ?
      `).run(now, campaignId);
    } else {
      db.prepare(`
        UPDATE campaigns 
        SET ${fieldToIncrement} = ${fieldToIncrement} + 1,
            updatedAt = ?
        WHERE campaignId = ?
      `).run(now, campaignId);
    }

    const c = db.prepare("SELECT * FROM campaigns WHERE campaignId = ?").get(campaignId);
    if (c) {
      console.log(`📊 [DASHBOARD SYNC] Campaign progress: ${c.sentCount}/${c.totalRecipients} sent (Status: ${c.status})`);
    }
  } catch (err) {
    console.error("Failed to update campaign stats in SQLite:", err.message);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRandomJitterDelay() {
  const min = parseInt(process.env.MIN_DELAY_MS || "3000", 10);
  const max = parseInt(process.env.MAX_DELAY_MS || "5000", 10);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Main AWS Lambda SQS Event Handler
 */
export async function handler(event, context) {
  const records = event.Records || [];
  console.log(`📨 Worker invoked with ${records.length} record(s).`);

  for (const record of records) {
    let payload;
    try {
      payload = JSON.parse(record.body);
    } catch (err) {
      console.error("Malformed record body:", record.body);
      continue;
    }

    const { campaignId, email, name, company, customVariables } = payload;
    console.log(`\n▶ Processing recipient: ${email} for campaign ${campaignId}`);

    // 1. Check Global Suppression List
    const suppressed = await isEmailSuppressed(email);
    if (suppressed) {
      console.warn(`🛑 Email ${email} is in SuppressionList. Skipping dispatch.`);
      await updateRecipient(campaignId, email, {
        status: "UNSUBSCRIBED",
        errorMessage: "Suppressed: recipient previously unsubscribed or bounced",
      });
      await updateCampaignStats(campaignId, "unsubscribedCount");
      continue;
    }

    // 2. Check & Atomically Increment Daily Warm-Up Cap
    const limitCheck = await verifyAndIncrementDailyLimit();
    if (!limitCheck.allowed) {
      console.warn(
        `⏳ Daily limit of ${limitCheck.dailyLimit} reached. Postponing message visibility...`
      );

      if (sqsClient && record.receiptHandle) {
        try {
          const queueUrl = process.env.SQS_DISPATCH_QUEUE_URL;
          if (queueUrl) {
            await sqsClient.send(
              new ChangeMessageVisibilityCommand({
                QueueUrl: queueUrl,
                ReceiptHandle: record.receiptHandle,
                VisibilityTimeout: 43200,
              })
            );
          }
        } catch (visErr) {
          console.error("Failed to update message visibility timeout:", visErr.message);
        }
      }
      return { status: "PAUSED_DAILY_LIMIT_REACHED" };
    }

    // 3. Fetch Campaign Details
    const campaign = await getCachedCampaign(campaignId);
    if (!campaign) {
      console.error(`❌ Campaign ${campaignId} not found!`);
      await updateRecipient(campaignId, email, {
        status: "FAILED",
        errorMessage: "Campaign not found",
      });
      continue;
    }

    // 4. Resolve Dynamic Sender Account (Single or Pool Round-Robin)
    let activeSender = null;
    if (campaign.senderStrategy === "POOL" && Array.isArray(campaign.senderAccountPool) && campaign.senderAccountPool.length > 0) {
      activeSender = await getAvailableSenderFromPool(campaign.senderAccountPool);
      if (!activeSender) {
        console.warn(`⏳ All inboxes in campaign pool have exhausted today's quota. Postponing message...`);
        return { status: "POOL_QUOTA_EXHAUSTED" };
      }
      console.log(`🔄 [POOL ROTATION] Assigned inbox: ${activeSender.email} (${activeSender.sentToday || 0}/${activeSender.dailyLimit} sent today)`);
    } else if (campaign.senderAccountId) {
      activeSender = await getSenderById(campaign.senderAccountId);
      if (activeSender && (activeSender.sentToday || 0) >= (activeSender.dailyLimit || 50)) {
        console.warn(`⏳ Assigned inbox ${activeSender.email} reached daily limit (${activeSender.dailyLimit}). Postponing...`);
        return { status: "INBOX_QUOTA_EXHAUSTED" };
      }
    }

    const effectiveFromAddress = activeSender ? activeSender.email : campaign.fromAddress;
    const effectiveFromName = activeSender?.fromName || campaign.fromName || "Team";
    const effectiveReplyTo = activeSender?.replyTo || campaign.replyTo || effectiveFromAddress;

    // 5. Render Email Template
    const { subject, html, text, headers, unsubscribeUrl } = renderEmail({
      subjectTemplate: campaign.subject,
      htmlTemplate: campaign.htmlBody,
      plainTextTemplate: campaign.plainTextBody,
      recipient: { email, name, company, customVariables },
      campaignId,
      fromEmail: effectiveFromAddress,
    });

    // 6. Send via Dynamic Transporter (SES, Custom SMTP, or Mock)
    const transporter = await getTransporter(activeSender);
    const mailOptions = {
      from: `"${effectiveFromName}" <${effectiveFromAddress}>`,
      to: email,
      replyTo: effectiveReplyTo,
      subject,
      html,
      text,
      headers,
    };

    if (process.env.SES_CONFIGURATION_SET) {
      mailOptions.headers["X-SES-CONFIGURATION-SET"] = process.env.SES_CONFIGURATION_SET;
    }

    try {
      const sendResult = await transporter.sendMail(mailOptions);
      const messageId = sendResult.messageId || `mock-${Date.now()}`;

      console.log(`✅ Email successfully dispatched to ${email} via [${effectiveFromAddress}]`);

      if (transporter.isMock) {
        if (transporter.isJsonMock) {
          console.log(`🔍 [PREVIEW DETAILS]:`);
          console.log(`   From: "${effectiveFromName}" <${effectiveFromAddress}>`);
          console.log(`   To: ${email}`);
          console.log(`   Subject: "${subject}"`);
          console.log(`   Unsubscribe Link: ${unsubscribeUrl}`);
        } else {
          const previewUrl = nodemailer.getTestMessageUrl(sendResult);
          if (previewUrl) {
            console.log(`🔍 [CLICK TO PREVIEW EMAIL IN BROWSER]:`);
            console.log(`👉 ${previewUrl}`);
          }
        }
      }

      // If sent via dynamic sender account, increment its counter
      if (activeSender && activeSender.id) {
        await incrementSenderSent(activeSender.id);
      }

      // Update Recipient and Campaign records
      await updateRecipient(campaignId, email, {
        status: "SENT",
        messageId,
        senderInbox: effectiveFromAddress,
      });
      await updateCampaignStats(campaignId, "sentCount");

      // 7. Intelligent Throttle Jitter
      const delayMs = getRandomJitterDelay();
      console.log(`⏱️  Pacing throttle: Sleeping for ${(delayMs / 1000).toFixed(1)}s before next message...`);
      await sleep(delayMs);

    } catch (sendErr) {
      console.error(`❌ Failed to send email to ${email} via [${effectiveFromAddress}]:`, sendErr.message);
      await updateRecipient(campaignId, email, {
        status: "FAILED",
        errorMessage: sendErr.message,
      });
      await updateCampaignStats(campaignId, "failedCount");
    }
  }

  return { status: "BATCH_COMPLETE" };
}
