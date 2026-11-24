import { NextResponse } from "next/server";
import {
  listSenderAccounts,
  createSenderAccount,
  updateSenderAccount,
  deleteSenderAccount,
} from "@/lib/db/sqlite";

export const dynamic = "force-dynamic";

// GET /api/senders - List all registered sender inboxes
export async function GET() {
  try {
    const senders = await listSenderAccounts();
    // Return list with masked passwords for security
    const sanitized = senders.map((s) => ({
      ...s,
      smtpPass: s.smtpPass ? "••••••••" : "",
    }));
    return NextResponse.json({ success: true, senders: sanitized });
  } catch (err) {
    console.error("Failed to list sender accounts:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to list senders" },
      { status: 500 }
    );
  }
}

// POST /api/senders - Create or toggle an inbox
export async function POST(req) {
  try {
    const body = await req.json();

    // If update status toggle or dailyLimit
    if (body.action === "update" && body.id) {
      const updates = {};
      if (body.status) updates.status = body.status;
      if (body.dailyLimit !== undefined) updates.dailyLimit = Number(body.dailyLimit);
      if (body.fromName !== undefined) updates.fromName = body.fromName;
      if (body.replyTo !== undefined) updates.replyTo = body.replyTo;

      const updated = await updateSenderAccount(body.id, updates);
      return NextResponse.json({ success: true, sender: updated });
    }

    // Creating a new sender
    const { email, smtpHost, smtpPort, smtpUser, smtpPass, provider } = body;
    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { success: false, error: "A valid email address is required" },
        { status: 400 }
      );
    }

    if (provider !== "ses" && (!smtpHost || !smtpPass)) {
      return NextResponse.json(
        { success: false, error: "SMTP host and password are required for SMTP providers" },
        { status: 400 }
      );
    }

    const newSender = await createSenderAccount(body);
    return NextResponse.json({
      success: true,
      sender: {
        ...newSender,
        smtpPass: "••••••••",
      },
    });
  } catch (err) {
    console.error("Failed to save sender account:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to save sender" },
      { status: 500 }
    );
  }
}

// DELETE /api/senders?id=... - Delete sender account
export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ success: false, error: "Sender ID is required" }, { status: 400 });
    }

    await deleteSenderAccount(id);
    return NextResponse.json({ success: true, message: "Sender deleted successfully" });
  } catch (err) {
    console.error("Failed to delete sender account:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to delete sender" },
      { status: 500 }
    );
  }
}
