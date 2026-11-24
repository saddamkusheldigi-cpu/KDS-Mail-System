import { NextResponse } from "next/server";
import {
  addToSuppressionList,
  updateRecipientStatus,
  findRecipientByEmail,
  incrementCampaignStats,
} from "@/lib/db/sqlite";
import { SUPPRESSION_REASON, RECIPIENT_STATUS } from "@/lib/constants";

export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/ses
 * Amazon SNS Webhook receiver for SES Bounces and Complaints
 */
export async function POST(request) {
  try {
    const rawBody = await request.text();
    let body;

    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    // 1. Handle Amazon SNS Subscription Confirmation
    if (body.Type === "SubscriptionConfirmation") {
      const subscribeUrl = body.SubscribeURL;
      console.log(`🔗 Auto-confirming SNS Subscription: ${subscribeUrl}`);
      try {
        await fetch(subscribeUrl);
        return NextResponse.json({ success: true, message: "Subscription confirmed" });
      } catch (subErr) {
        console.error("Failed to confirm SNS subscription:", subErr);
        return NextResponse.json({ error: "Failed to confirm" }, { status: 500 });
      }
    }

    // 2. Handle SNS Notification
    if (body.Type === "Notification") {
      let message;
      try {
        message = typeof body.Message === "string" ? JSON.parse(body.Message) : body.Message;
      } catch (parseErr) {
        console.error("Failed to parse SNS message payload:", parseErr);
        return NextResponse.json({ error: "Invalid notification message" }, { status: 400 });
      }

      const eventType = message.eventType || message.notificationType;
      console.log(`📢 Received SES Event via SNS: ${eventType}`);

      // Handle BOUNCE
      if (eventType === "Bounce" || eventType === "BOUNCE") {
        const bounce = message.bounce || {};
        const bouncedRecipients = bounce.bouncedRecipients || [];
        const bounceType = `${bounce.bounceType || "Permanent"} (${bounce.bounceSubType || "General"})`;

        for (const recipient of bouncedRecipients) {
          const email = (recipient.emailAddress || "").trim().toLowerCase();
          const diagnosticCode = recipient.diagnosticCode || bounceType;

          console.warn(`🚨 SES Bounce received for: ${email} [${diagnosticCode}]`);

          // Add to Global Suppression List
          await addToSuppressionList({
            email,
            reason: SUPPRESSION_REASON.BOUNCE,
            source: "ses-sns-webhook",
            details: diagnosticCode,
          });

          // Find associated campaigns and update recipient record
          const records = await findRecipientByEmail(email);
          for (const item of records) {
            await updateRecipientStatus(item.campaignId, email, {
              status: RECIPIENT_STATUS.BOUNCED,
              errorMessage: diagnosticCode,
            });
            await incrementCampaignStats(item.campaignId, "bouncedCount", 1);
          }
        }
      }

      // Handle COMPLAINT (Marked as Spam)
      if (eventType === "Complaint" || eventType === "COMPLAINT") {
        const complaint = message.complaint || {};
        const complainedRecipients = complaint.complainedRecipients || [];
        const feedbackType = complaint.complaintFeedbackType || "abuse";

        for (const recipient of complainedRecipients) {
          const email = (recipient.emailAddress || "").trim().toLowerCase();
          console.warn(`⚠️ SES Complaint received for: ${email} [${feedbackType}]`);

          // Add to Global Suppression List
          await addToSuppressionList({
            email,
            reason: SUPPRESSION_REASON.COMPLAINT,
            source: "ses-sns-webhook",
            details: `Complaint type: ${feedbackType}`,
          });

          // Find and update recipient record
          const records = await findRecipientByEmail(email);
          for (const item of records) {
            await updateRecipientStatus(item.campaignId, email, {
              status: RECIPIENT_STATUS.BOUNCED,
              errorMessage: `Spam Complaint: ${feedbackType}`,
            });
            await incrementCampaignStats(item.campaignId, "bouncedCount", 1);
          }
        }
      }

      return NextResponse.json({ success: true, processed: eventType });
    }

    return NextResponse.json({ success: true, message: "Ignored event type" });
  } catch (err) {
    console.error("SES Webhook handling error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
