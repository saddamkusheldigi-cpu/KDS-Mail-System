import crypto from "crypto";

const HMAC_SECRET =
  process.env.UNSUBSCRIBE_HMAC_SECRET || "fallback-inbox-mailer-secret-change-me";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_BASE_URL || "http://localhost:3000";

export function generateUnsubscribeToken(email, campaignId) {
  const normalizedEmail = (email || "").trim().toLowerCase();
  const payload = `${normalizedEmail}:${campaignId || "global"}`;
  const hmac = crypto.createHmac("sha256", HMAC_SECRET);
  hmac.update(payload);
  const signature = hmac.digest("hex");
  return Buffer.from(`${payload}:${signature}`).toString("base64url");
}

export function interpolateVariables(templateText, variables = {}) {
  if (!templateText) return "";

  let result = templateText;
  for (const [key, val] of Object.entries(variables)) {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, "gi");
    result = result.replace(regex, val !== undefined && val !== null ? String(val) : "");
  }

  result = result.replace(/{{\s*[\w.-]+\s*}}/g, "");
  return result;
}

export function renderEmail({
  subjectTemplate,
  htmlTemplate,
  plainTextTemplate,
  recipient,
  campaignId,
  fromEmail,
}) {
  const variables = {
    name: recipient.name || "there",
    firstName: (recipient.name || "there").split(" ")[0],
    company: recipient.company || "your company",
    email: recipient.email,
    ...(recipient.customVariables || {}),
  };

  const renderedSubject = interpolateVariables(subjectTemplate, variables);
  let renderedHtml = interpolateVariables(htmlTemplate, variables);
  let renderedPlainText = interpolateVariables(plainTextTemplate, variables);

  const token = generateUnsubscribeToken(recipient.email, campaignId);
  const unsubscribeUrl = `${APP_URL.replace(/\/$/, "")}/api/unsubscribe?token=${token}`;

  if (!renderedPlainText) {
    renderedPlainText = renderedHtml
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  renderedPlainText += `\n\n---\nTo unsubscribe from these emails, visit:\n${unsubscribeUrl}\n`;

  const htmlFooter = `
    <div style="margin-top: 36px; padding-top: 18px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; text-align: center; line-height: 1.5;">
      <p style="margin: 0 0 8px 0;">You received this email because your contact was included in our outreach campaign.</p>
      <p style="margin: 0;">
        <a href="${unsubscribeUrl}" style="color: #4f46e5; text-decoration: underline;">Click here to unsubscribe</a> 
        or reply to this email with &ldquo;Unsubscribe&rdquo;.
      </p>
    </div>
  `;

  // 1x1 Transparent Open Tracking Pixel to confirm Primary Inbox delivery
  const trackingPixel = `<img src="${APP_URL.replace(/\/$/, "")}/api/track/open?cid=${encodeURIComponent(campaignId || "test")}&email=${encodeURIComponent(recipient.email)}" width="1" height="1" alt="" style="display:none !important; width:1px; height:1px; border:0;" />`;

  if (/<\/body>/i.test(renderedHtml)) {
    renderedHtml = renderedHtml.replace(/<\/body>/i, `${htmlFooter}${trackingPixel}</body>`);
  } else {
    renderedHtml += `${htmlFooter}${trackingPixel}`;
  }

  const headers = {
    "List-Unsubscribe": `<${unsubscribeUrl}>, <mailto:${fromEmail}?subject=unsubscribe>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    Precedence: "bulk",
    "X-Auto-Response-Suppress": "OOF, AutoReply",
  };

  return {
    subject: renderedSubject,
    html: renderedHtml,
    text: renderedPlainText,
    headers,
    unsubscribeUrl,
  };
}
