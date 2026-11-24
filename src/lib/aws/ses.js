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

let cachedTransporter = null;

export async function getEmailTransporter() {
  if (cachedTransporter) return cachedTransporter;

  const isMock = process.env.MOCK_SES === "true";

  if (isMock) {
    console.log("🛠️ [DEV MODE] Initializing Ethereal Test SMTP Transporter (SES Mock)...");
    const testAccount = await nodemailer.createTestAccount();
    cachedTransporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    cachedTransporter.isMock = true;
    return cachedTransporter;
  }

  // Direct SMTP Configuration (Amazon SES SMTP or Custom SMTP)
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    cachedTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || "587", 10),
      secure: process.env.SMTP_SECURE === "true" || process.env.SMTP_PORT === "465",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    cachedTransporter.isMock = false;
    return cachedTransporter;
  }

  // Production SES Transporter via AWS SDK
  cachedTransporter = nodemailer.createTransport({
    SES: { ses: sesClient, aws },
  });
  cachedTransporter.isMock = false;
  return cachedTransporter;
}

export async function getSESQuota() {
  if (!process.env.AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID === "your_aws_access_key_id") {
    return {
      max24HourSend: 50000,
      maxSendRate: 14,
      sentLast24Hours: 0,
    };
  }

  try {
    const res = await sesClient.send(new aws.GetSendQuotaCommand({}));
    return {
      max24HourSend: res.Max24HourSend || 0,
      maxSendRate: res.MaxSendRate || 0,
      sentLast24Hours: res.SentLast24Hours || 0,
    };
  } catch (err) {
    return {
      max24HourSend: 50000,
      maxSendRate: 14,
      sentLast24Hours: 0,
    };
  }
}
