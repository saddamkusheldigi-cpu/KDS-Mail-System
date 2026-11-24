import * as aws from "@aws-sdk/client-ses";
import nodemailer from "nodemailer";

const region = process.env.AWS_REGION || "ap-south-1";

const clientConfig = { region };
if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
  clientConfig.credentials = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  };
}

export const sesClient = new aws.SESClient(clientConfig);

let defaultTransporter = null;
const dynamicTransporters = new Map();

/**
 * Returns a Nodemailer transporter.
 * If senderAccount is passed, creates/reuses a transporter configured for that specific sender account.
 * Otherwise, falls back to the default .env configuration (SES / SMTP / Mock).
 */
export async function getTransporter(senderAccount = null) {
  const isMock = process.env.MOCK_SES === "true";

  // 1. Mock Mode (Offline Console fallback or Ethereal)
  if (isMock) {
    if (defaultTransporter) return defaultTransporter;
    try {
      console.log("🛠️  [WORKER] Initializing Ethereal Test SMTP Transporter...");
      const testAccount = await nodemailer.createTestAccount();
      defaultTransporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      defaultTransporter.isMock = true;
      return defaultTransporter;
    } catch {
      console.log("🛠️  [WORKER] Offline Mode: Simulating email delivery locally...");
      defaultTransporter = nodemailer.createTransport({
        jsonTransport: true,
      });
      defaultTransporter.isMock = true;
      defaultTransporter.isJsonMock = true;
      return defaultTransporter;
    }
  }

  // 2. Dynamic Sender Account (Multi-SMTP / Multi-Domain)
  if (senderAccount && senderAccount.id) {
    if (dynamicTransporters.has(senderAccount.id)) {
      return dynamicTransporters.get(senderAccount.id);
    }

    if (senderAccount.provider === "ses") {
      console.log(`☁️  [WORKER] Using Amazon SES for ${senderAccount.email}...`);
      const sesTransport = nodemailer.createTransport({
        SES: { ses: sesClient, aws },
      });
      sesTransport.isMock = false;
      dynamicTransporters.set(senderAccount.id, sesTransport);
      return sesTransport;
    }

    if (senderAccount.smtpHost && senderAccount.smtpPass) {
      console.log(
        `🔌 [WORKER] Connecting dynamic inbox ${senderAccount.email} via ${senderAccount.smtpHost}:${senderAccount.smtpPort}...`
      );
      const customTransport = nodemailer.createTransport({
        host: senderAccount.smtpHost,
        port: parseInt(senderAccount.smtpPort || "587", 10),
        secure: Boolean(senderAccount.smtpSecure),
        auth: {
          user: senderAccount.smtpUser || senderAccount.email,
          pass: senderAccount.smtpPass,
        },
        connectionTimeout: 15000,
      });
      customTransport.isMock = false;
      dynamicTransporters.set(senderAccount.id, customTransport);
      return customTransport;
    }
  }

  // 3. Static Direct SMTP Configuration (.env fallback)
  if (defaultTransporter) return defaultTransporter;

  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    console.log(`🔌 [WORKER] Connecting via default SMTP: ${process.env.SMTP_HOST}:${process.env.SMTP_PORT || 587} ...`);
    defaultTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || "587", 10),
      secure: process.env.SMTP_SECURE === "true" || process.env.SMTP_PORT === "465",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    defaultTransporter.isMock = false;
    return defaultTransporter;
  }

  // 4. Default Amazon SES via AWS SDK IAM Credentials
  console.log("☁️  [WORKER] Connecting via default Amazon SES AWS SDK (SendRawEmail)...");
  defaultTransporter = nodemailer.createTransport({
    SES: { ses: sesClient, aws },
  });
  defaultTransporter.isMock = false;
  return defaultTransporter;
}
