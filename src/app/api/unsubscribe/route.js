import { NextResponse } from "next/server";
import { verifyUnsubscribeToken } from "@/lib/tokens";
import {
  addToSuppressionList,
  updateRecipientStatus,
  incrementCampaignStats,
} from "@/lib/db/sqlite";
import { SUPPRESSION_REASON, RECIPIENT_STATUS } from "@/lib/constants";

export const dynamic = "force-dynamic";

/**
 * Handle unsubscribe processing logic
 */
async function processUnsubscribe(token) {
  const result = verifyUnsubscribeToken(token);
  if (!result.valid || !result.email) {
    return { success: false, error: "Invalid or expired unsubscribe link" };
  }

  const { email, campaignId } = result;

  // 1. Add to global SuppressionList
  await addToSuppressionList({
    email,
    reason: SUPPRESSION_REASON.UNSUBSCRIBE,
    source: campaignId ? `campaign:${campaignId}` : "direct-link",
    details: "Recipient clicked unsubscribe link",
  });

  // 2. If campaignId exists, update recipient record and campaign count
  if (campaignId && campaignId !== "global") {
    try {
      await updateRecipientStatus(campaignId, email, {
        status: RECIPIENT_STATUS.UNSUBSCRIBED,
        errorMessage: "User unsubscribed via link",
      });
      await incrementCampaignStats(campaignId, "unsubscribedCount", 1);
    } catch (err) {
      console.warn("Could not update campaign recipient stats:", err.message);
    }
  }

  return { success: true, email };
}

/**
 * GET /api/unsubscribe?token=...
 * Render styled HTML confirmation page for user
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return new Response(renderErrorHtml("Missing unsubscribe token."), {
      headers: { "Content-Type": "text/html" },
      status: 400,
    });
  }

  const res = await processUnsubscribe(token);

  if (!res.success) {
    return new Response(renderErrorHtml(res.error), {
      headers: { "Content-Type": "text/html" },
      status: 400,
    });
  }

  return new Response(renderSuccessHtml(res.email), {
    headers: { "Content-Type": "text/html" },
    status: 200,
  });
}

/**
 * POST /api/unsubscribe?token=...
 * RFC 8058 One-Click Unsubscribe Handler
 */
export async function POST(request) {
  const { searchParams } = new URL(request.url);
  let token = searchParams.get("token");

  if (!token) {
    try {
      const body = await request.json();
      token = body?.token;
    } catch {
      // ignore
    }
  }

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const res = await processUnsubscribe(token);
  if (!res.success) {
    return NextResponse.json({ error: res.error }, { status: 400 });
  }

  return NextResponse.json({ success: true, message: `Unsubscribed ${res.email}` });
}

function renderSuccessHtml(email) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Unsubscribed Successfully</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f3f4f6; margin: 0; padding: 40px 16px; display: flex; align-items: center; justify-content: center; min-height: 80vh; }
    .card { background: white; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1); max-width: 480px; width: 100%; padding: 36px 28px; text-align: center; }
    .icon { width: 56px; height: 56px; background-color: #ecfdf5; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px auto; color: #10b981; font-size: 28px; }
    h1 { font-size: 22px; color: #111827; margin: 0 0 12px 0; font-weight: 700; }
    p { font-size: 14px; color: #4b5563; line-height: 1.6; margin: 0 0 20px 0; }
    .email-badge { background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 8px 14px; font-weight: 600; color: #1f2937; display: inline-block; word-break: break-all; margin-bottom: 24px; }
    .footer { font-size: 12px; color: #9ca3af; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✓</div>
    <h1>You have been unsubscribed</h1>
    <p>Your email address has been added to our global suppression list. You will no longer receive marketing or outreach emails from this domain.</p>
    <div class="email-badge">${email}</div>
    <div class="footer">If this was a mistake, please contact our support team.</div>
  </div>
</body>
</html>`;
}

function renderErrorHtml(errorMsg) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Unsubscribe Error</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f3f4f6; margin: 0; padding: 40px 16px; display: flex; align-items: center; justify-content: center; min-height: 80vh; }
    .card { background: white; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); max-width: 480px; width: 100%; padding: 36px 28px; text-align: center; }
    .icon { width: 56px; height: 56px; background-color: #fef2f2; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px auto; color: #ef4444; font-size: 28px; }
    h1 { font-size: 22px; color: #111827; margin: 0 0 12px 0; }
    p { font-size: 14px; color: #4b5563; line-height: 1.6; margin: 0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✕</div>
    <h1>Unable to Process Unsubscribe</h1>
    <p>${errorMsg || "The link may be malformed or expired."}</p>
  </div>
</body>
</html>`;
}
