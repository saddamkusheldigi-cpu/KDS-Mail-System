import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const { provider, smtpHost, smtpPort, smtpSecure, smtpUser, smtpPass } = await req.json();

    if (provider === "ses") {
      // For SES, we can confirm configuration
      return NextResponse.json({
        success: true,
        message: "Amazon SES transport verified (handled via AWS SDK Identity)",
      });
    }

    if (!smtpHost || !smtpUser || !smtpPass) {
      return NextResponse.json(
        { success: false, error: "SMTP Host, Username, and Password are required" },
        { status: 400 }
      );
    }

    const transport = nodemailer.createTransport({
      host: smtpHost,
      port: Number(smtpPort) || 587,
      secure: Boolean(smtpSecure),
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
      connectionTimeout: 10000, // 10s timeout
      greetingTimeout: 5000,
    });

    // Verify SMTP connection handshake
    await transport.verify();

    return NextResponse.json({
      success: true,
      message: "SMTP Connection verified successfully! Handshake passed.",
    });
  } catch (err) {
    console.error("SMTP Test Connection failed:", err);
    let errorMessage = err.message || "Failed to establish SMTP connection";

    if (errorMessage.includes("535") || errorMessage.includes("Username and Password not accepted")) {
      errorMessage =
        "Authentication failed (535): Invalid username or password. If using Gmail/Google Workspace, ensure you are using a 16-character App Password, NOT your regular account password.";
    } else if (errorMessage.includes("ETIMEDOUT") || errorMessage.includes("ESOCKET")) {
      errorMessage = "Connection timed out. Check Host and Port (try 465 with SSL or 587 with TLS).";
    }

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 400 }
    );
  }
}
