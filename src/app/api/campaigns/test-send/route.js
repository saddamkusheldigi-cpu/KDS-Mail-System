import { NextResponse } from "next/server";
import { getEmailTransporter } from "@/lib/aws/ses";
import { renderEmail } from "@/lib/template-renderer";

export const dynamic = "force-dynamic";

/**
 * POST /api/campaigns/test-send
 * Send a single test email directly to a seed email for inbox placement verification
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { testEmail, subject, fromAddress, fromName, replyTo, htmlBody, plainTextBody } = body;

    if (!testEmail) {
      return NextResponse.json({ error: "Test email recipient is required" }, { status: 400 });
    }

    // Strict 1 MB (1,048,576 bytes) Total Template Size Check
    const templateSizeBytes = Buffer.byteLength(htmlBody || "", "utf8");
    const MAX_ALLOWED_BYTES = 1024 * 1024; // 1 MB
    if (templateSizeBytes > MAX_ALLOWED_BYTES) {
      return NextResponse.json(
        {
          success: false,
          error: `Test email template exceeds 1 MB limit (Current: ${(templateSizeBytes / 1024).toFixed(1)} KB / 1,024 KB max). Please compress or reduce image size.`,
        },
        { status: 400 }
      );
    }

    const { subject: renderedSubject, html, text, headers } = renderEmail({
      subjectTemplate: subject || "Test Placement Email",
      htmlTemplate: htmlBody || "<p>This is a test email.</p>",
      plainTextTemplate: plainTextBody || "This is a test email.",
      recipient: {
        email: testEmail,
        name: "Test User",
        company: "Seed Check",
      },
      campaignId: "placement-test",
      fromEmail: fromAddress || process.env.SMTP_USER || "info@yourdomain.com",
    });

    const transporter = await getEmailTransporter();
    const mailOptions = {
      from: `"${fromName || "Team"}" <${fromAddress || process.env.SMTP_USER}>`,
      to: testEmail,
      replyTo: replyTo || fromAddress || process.env.SMTP_USER,
      subject: renderedSubject,
      html,
      text,
      headers,
    };

    const result = await transporter.sendMail(mailOptions);

    return NextResponse.json({
      success: true,
      message: `Test email dispatched to ${testEmail}! Check your inbox/spam folder now.`,
      messageId: result.messageId || "mock-test",
      isMock: transporter.isMock,
    });
  } catch (err) {
    console.error("Test placement send error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
