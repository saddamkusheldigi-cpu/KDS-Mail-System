import { NextResponse } from "next/server";
import {
  getCampaign,
  getRecipientsByCampaign,
  updateRecipientStatus,
  updateCampaignStatus,
} from "@/lib/db/sqlite";
import { enqueueRecipientsBatch } from "@/lib/aws/sqs";
import { CAMPAIGN_STATUS, RECIPIENT_STATUS } from "@/lib/constants";

export const dynamic = "force-dynamic";

/**
 * POST /api/campaigns/[id]/retry
 * Retry all FAILED recipients in a campaign
 */
export async function POST(request, { params }) {
  try {
    const { id: campaignId } = params;

    const campaign = await getCampaign(campaignId);
    if (!campaign) {
      return NextResponse.json(
        { success: false, error: "Campaign not found" },
        { status: 404 }
      );
    }

    // Get all failed recipients
    const failedRecipients = await getRecipientsByCampaign(
      campaignId,
      RECIPIENT_STATUS.FAILED,
      500
    );

    if (failedRecipients.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No failed recipients found to retry",
        retriedCount: 0,
      });
    }

    // Reset status to PENDING
    for (const r of failedRecipients) {
      await updateRecipientStatus(campaignId, r.email, {
        status: RECIPIENT_STATUS.PENDING,
        errorMessage: null,
      });
    }

    // Push back to SQS
    const enqueueResult = await enqueueRecipientsBatch(campaignId, failedRecipients);

    // Update campaign status
    await updateCampaignStatus(campaignId, CAMPAIGN_STATUS.QUEUED);

    return NextResponse.json({
      success: true,
      message: `Successfully re-queued ${enqueueResult.totalEnqueued} failed recipient(s)`,
      retriedCount: enqueueResult.totalEnqueued,
    });
  } catch (err) {
    console.error(`Failed to retry campaign ${params?.id}:`, err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to retry campaign recipients" },
      { status: 500 }
    );
  }
}
