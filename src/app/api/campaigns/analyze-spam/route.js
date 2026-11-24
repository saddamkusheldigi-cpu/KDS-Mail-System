import { NextResponse } from "next/server";
import { analyzeSpamRisk } from "@/lib/spam-analyzer";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await request.json();
    const { subject, htmlBody, plainTextBody } = body;

    const analysis = analyzeSpamRisk({
      subject: subject || "",
      htmlBody: htmlBody || "",
      plainTextBody: plainTextBody || "",
    });

    return NextResponse.json({
      success: true,
      analysis,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
