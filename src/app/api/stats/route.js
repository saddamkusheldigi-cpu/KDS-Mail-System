import { NextResponse } from "next/server";
import {
  getDailyStats,
  setDailyLimit,
  getTodayDateString,
  listCampaigns,
} from "@/lib/db/sqlite";
import { getSESQuota } from "@/lib/aws/ses";
import { getQueueMetrics } from "@/lib/aws/sqs";

export const dynamic = "force-dynamic";

/**
 * GET /api/stats
 * Real-time metrics for Dashboard
 */
export async function GET() {
  try {
    const today = getTodayDateString();
    const [dailyStats, sesQuota, queueMetrics, campaigns] = await Promise.all([
      getDailyStats(today),
      getSESQuota(),
      getQueueMetrics(),
      listCampaigns(200),
    ]);

    const sentCount = dailyStats.sentCount || 0;
    const dailyLimit = dailyStats.dailyLimit || 1350;
    const remainingToday = Math.max(0, dailyLimit - sentCount);
    const percentageUsed = Math.min(100, Math.round((sentCount / dailyLimit) * 100));

    // Aggregate lifetime / cross-campaign metrics
    let totalRecipients = 0;
    let totalSent = 0;
    let totalOpened = 0;
    let totalFailed = 0;
    let totalBounced = 0;
    let totalUnsubscribed = 0;

    (campaigns || []).forEach((c) => {
      totalRecipients += Number(c.totalRecipients || 0);
      totalSent += Number(c.sentCount || 0);
      totalOpened += Number(c.openedCount || 0);
      totalFailed += Number(c.failedCount || 0);
      totalBounced += Number(c.bouncedCount || 0);
      totalUnsubscribed += Number(c.unsubscribedCount || 0);
    });

    const inboxPlacementRate =
      totalSent > 0 ? Math.min(100, Math.round((totalOpened / totalSent) * 100)) : 0;
    const bounceRate =
      totalSent > 0 ? Number(((totalBounced / totalSent) * 100).toFixed(1)) : 0;

    return NextResponse.json({
      success: true,
      warmUp: {
        date: today,
        sentCount,
        dailyLimit,
        remainingToday,
        percentageUsed,
        isCapReached: sentCount >= dailyLimit,
      },
      aggregate: {
        totalCampaigns: campaigns.length,
        totalRecipients,
        totalSent,
        totalOpened,
        totalFailed,
        totalBounced,
        totalUnsubscribed,
        inboxPlacementRate,
        bounceRate,
      },
      sesQuota,
      queue: queueMetrics,
    });
  } catch (err) {
    console.error("Failed to fetch dashboard stats:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch stats" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/stats
 * Update daily sending limit cap
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { dailyLimit } = body;

    if (!dailyLimit || isNaN(Number(dailyLimit)) || Number(dailyLimit) <= 0) {
      return NextResponse.json(
        { success: false, error: "Valid numeric dailyLimit is required" },
        { status: 400 }
      );
    }

    const today = getTodayDateString();
    const updated = await setDailyLimit(today, Number(dailyLimit));

    return NextResponse.json({
      success: true,
      updated,
    });
  } catch (err) {
    console.error("Failed to update daily stats:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to update daily limit" },
      { status: 500 }
    );
  }
}
