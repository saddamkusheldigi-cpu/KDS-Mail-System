import { updateRecipientStatus, incrementCampaignStats } from "@/lib/db/sqlite";

export const dynamic = "force-dynamic";

// 1x1 transparent GIF buffer
const TRANSPARENT_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

/**
 * GET /api/track/open?cid=...&email=...
 * Tracking pixel that fires when recipient opens the email in their Primary Inbox
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const campaignId = searchParams.get("cid");
  const email = searchParams.get("email");

  if (campaignId && email) {
    try {
      await updateRecipientStatus(campaignId, email.toLowerCase(), {
        status: "OPENED",
        errorMessage: "Opened in Primary Inbox",
      });
      await incrementCampaignStats(campaignId, "openedCount", 1);
      console.log(`👁️ [INBOX CONFIRMED] Recipient ${email} opened the email!`);
    } catch (err) {
      console.warn("Could not record open event:", err.message);
    }
  }

  return new Response(TRANSPARENT_GIF, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}
