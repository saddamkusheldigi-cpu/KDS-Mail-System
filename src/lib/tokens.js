import crypto from "crypto";

const HMAC_SECRET =
  process.env.UNSUBSCRIBE_HMAC_SECRET || "fallback-inbox-mailer-secret-change-me";

/**
 * Generate a secure HMAC signature for an email address & campaign
 * @param {string} email
 * @param {string} campaignId
 * @returns {string} base64url signed token
 */
export function generateUnsubscribeToken(email, campaignId) {
  const normalizedEmail = (email || "").trim().toLowerCase();
  const payload = `${normalizedEmail}:${campaignId || "global"}`;
  const hmac = crypto.createHmac("sha256", HMAC_SECRET);
  hmac.update(payload);
  const signature = hmac.digest("hex");

  // Format: Base64URL(payload:signature)
  const fullToken = Buffer.from(`${payload}:${signature}`).toString("base64url");
  return fullToken;
}

/**
 * Verify an incoming unsubscribe token and extract payload
 * @param {string} token
 * @returns {{ valid: boolean, email?: string, campaignId?: string }}
 */
export function verifyUnsubscribeToken(token) {
  try {
    if (!token) return { valid: false };

    const decoded = Buffer.from(token, "base64url").toString("utf-8");
    const parts = decoded.split(":");
    if (parts.length < 3) return { valid: false };

    const [email, campaignId, providedSignature] = parts;

    const payload = `${email}:${campaignId}`;
    const hmac = crypto.createHmac("sha256", HMAC_SECRET);
    hmac.update(payload);
    const expectedSignature = hmac.digest("hex");

    const sigBuf = Buffer.from(providedSignature || "");
    const expBuf = Buffer.from(expectedSignature);

    if (sigBuf.length !== expBuf.length) {
      return { valid: false };
    }

    const isValid = crypto.timingSafeEqual(sigBuf, expBuf);

    if (!isValid) return { valid: false };

    return {
      valid: true,
      email: email.toLowerCase(),
      campaignId,
    };
  } catch (err) {
    console.error("Token verification error:", err.message);
    return { valid: false };
  }
}
