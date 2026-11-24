import { NextResponse } from "next/server";
import crypto from "crypto";
import {
  createCampaign,
  listCampaigns,
  batchSaveRecipients,
  isSuppressed,
} from "@/lib/db/sqlite";
import { enqueueRecipientsBatch } from "@/lib/aws/sqs";
import { CAMPAIGN_STATUS } from "@/lib/constants";

export const dynamic = "force-dynamic";

/**
 * GET /api/campaigns
 * List all campaigns
 */
export async function GET() {
  try {
    const campaigns = await listCampaigns(100);
    return NextResponse.json({ success: true, campaigns });
  } catch (err) {
    console.error("Failed to list campaigns:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch campaigns" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/campaigns
 * Create a new campaign and queue recipients
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      name,
      subject,
      fromAddress,
      fromName,
      replyTo,
      senderStrategy = "SINGLE", // "SINGLE" | "POOL"
      senderAccountId = null,
      senderAccountPool = [],
      htmlBody,
      plainTextBody,
      recipients = [],
    } = body;

    // Validation
    if (!name || !subject || !fromAddress || !htmlBody) {
      return NextResponse.json(
        { success: false, error: "Missing required fields (name, subject, fromAddress, htmlBody)" },
        { status: 400 }
      );
    }

    // Strict 1 MB (1,048,576 bytes) Total Template Size Check
    const templateSizeBytes = Buffer.byteLength(htmlBody || "", "utf8");
    const MAX_ALLOWED_BYTES = 1024 * 1024; // 1 MB
    if (templateSizeBytes > MAX_ALLOWED_BYTES) {
      return NextResponse.json(
        {
          success: false,
          error: `Email template size exceeds the strict 1 MB limit (Current size: ${(templateSizeBytes / 1024).toFixed(1)} KB / 1,024 KB max). Please compress or resize images before launching.`,
        },
        { status: 400 }
      );
    }

    if (!Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json(
        { success: false, error: "At least one recipient is required" },
        { status: 400 }
      );
    }

    const campaignId = crypto.randomUUID();

    // Filter out already-suppressed recipients before queuing
    const activeRecipients = [];
    const preSuppressedRecipients = [];

    for (const r of recipients) {
      const email = (r.email || "").trim().toLowerCase();
      const suppressed = await isSuppressed(email);
      if (suppressed) {
        preSuppressedRecipients.push({
          ...r,
          email,
          status: "UNSUBSCRIBED",
          errorMessage: "Pre-suppressed: Email is on global suppression blocklist",
        });
      } else {
        activeRecipients.push({
          ...r,
          email,
          status: "PENDING",
        });
      }
    }

    const totalRecipients = activeRecipients.length + preSuppressedRecipients.length;

    // 1. Create Campaign in SQLite
    const campaignItem = await createCampaign({
      campaignId,
      name: name.trim(),
      subject: subject.trim(),
      fromAddress: fromAddress.trim(),
      fromName: fromName ? fromName.trim() : "Team",
      replyTo: replyTo ? replyTo.trim() : fromAddress.trim(),
      senderStrategy,
      senderAccountId,
      senderAccountPool,
      htmlBody,
      plainTextBody: plainTextBody || "",
      status: activeRecipients.length > 0 ? CAMPAIGN_STATUS.QUEUED : CAMPAIGN_STATUS.COMPLETED,
      totalRecipients,
      unsubscribedCount: preSuppressedRecipients.length,
    });

    // 2. Batch Save Recipients to SQLite
    const allRecipients = [...activeRecipients, ...preSuppressedRecipients];
    await batchSaveRecipients(campaignId, allRecipients);

    // 3. Enqueue Active Recipients to Amazon SQS
    let totalEnqueued = 0;
    if (activeRecipients.length > 0) {
      const enqueueResult = await enqueueRecipientsBatch(campaignId, activeRecipients);
      totalEnqueued = enqueueResult.totalEnqueued;
    }

    return NextResponse.json({
      success: true,
      campaignId,
      totalRecipients,
      activeQueued: totalEnqueued,
      suppressedSkipped: preSuppressedRecipients.length,
      campaign: campaignItem,
    });
  } catch (err) {
    console.error("Failed to create campaign:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to create campaign" },
      { status: 500 }
    );
  }
}
