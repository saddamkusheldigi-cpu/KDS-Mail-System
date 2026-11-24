import { NextResponse } from "next/server";
import { getCampaign, getRecipientsByCampaign } from "@/lib/db/sqlite";

export const dynamic = "force-dynamic";

/**
 * GET /api/campaigns/[id]
 * Fetch campaign details and recipient logs
 */
export async function GET(request, { params }) {
  try {
    const { id: campaignId } = params;
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get("status"); // optional: 'FAILED', 'SENT', etc.
    const limit = parseInt(searchParams.get("limit") || "100", 10);

    const campaign = await getCampaign(campaignId);
    if (!campaign) {
      return NextResponse.json(
        { success: false, error: "Campaign not found" },
        { status: 404 }
      );
    }

    const recipients = await getRecipientsByCampaign(campaignId, statusFilter, limit);

    return NextResponse.json({
      success: true,
      campaign,
      recipients,
    });
  } catch (err) {
    console.error(`Failed to get campaign ${params?.id}:`, err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch campaign details" },
      { status: 500 }
    );
  }
}
