import { NextResponse } from "next/server";
import { listSuppression, addToSuppressionList } from "@/lib/db/sqlite";
import { isValidEmail } from "@/lib/csv-validator";
import { SUPPRESSION_REASON } from "@/lib/constants";

export const dynamic = "force-dynamic";

/**
 * GET /api/suppression
 * List global suppressed emails
 */
export async function GET() {
  try {
    const list = await listSuppression(200);
    return NextResponse.json({ success: true, suppressionList: list });
  } catch (err) {
    console.error("Failed to list suppression list:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch suppression list" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/suppression
 * Manually add an email to the suppression list
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { email, reason = SUPPRESSION_REASON.MANUAL, details = "Manually suppressed by admin" } = body;

    const normalizedEmail = (email || "").trim().toLowerCase();
    if (!isValidEmail(normalizedEmail)) {
      return NextResponse.json(
        { success: false, error: "Invalid email format" },
        { status: 400 }
      );
    }

    const item = await addToSuppressionList({
      email: normalizedEmail,
      reason,
      source: "admin-dashboard",
      details,
    });

    return NextResponse.json({ success: true, item });
  } catch (err) {
    console.error("Failed to add to suppression list:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to suppress email" },
      { status: 500 }
    );
  }
}
