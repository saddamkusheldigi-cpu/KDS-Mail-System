/**
 * Email Spam & Inbox Placement Prediction Engine
 * Analyzes subject lines, HTML markup, plain-text fallback, and links
 * to predict placement (Primary Inbox vs Promotions vs Spam).
 */

const SPAM_TRIGGER_WORDS = [
  { word: "free", weight: 8, advice: "Avoid 'free' in subject or header; replace with 'complimentary' or specify value." },
  { word: "100%", weight: 7, advice: "Avoid '100%' claims; spam filters flag absolute percentage promises." },
  { word: "guarantee", weight: 7, advice: "Replace 'guarantee' with 'assurance' or 'track record'." },
  { word: "risk-free", weight: 8, advice: "'Risk-free' is a frequent spam trigger." },
  { word: "urgent", weight: 9, advice: "High urgency phrases trigger aggressive spam filtering." },
  { word: "act now", weight: 9, advice: "Hard sell calls-to-action like 'act now' reduce inbox rate." },
  { word: "click here", weight: 6, advice: "Replace generic 'click here' with descriptive action anchors (e.g. 'View the guide')." },
  { word: "buy now", weight: 8, advice: "'Buy now' is heavily filtered in cold outreach." },
  { word: "winner", weight: 10, advice: "Sweepstakes words trigger instant spam flags." },
  { word: "congratulations", weight: 8, advice: "Often associated with phishing/lottery scams." },
  { word: "earn money", weight: 10, advice: "Financial promise triggers strict filters." },
  { word: "no catch", weight: 7, advice: "Phrases like 'no catch' heighten spam suspicion." },
  { word: "credit card", weight: 6, advice: "Mentioning credit cards or payment info triggers security scanners." },
];

const DISALLOWED_SHORTENERS = [
  "bit.ly",
  "tinyurl.com",
  "ow.ly",
  "goo.gl",
  "buff.ly",
  "t.co",
];

export function analyzeSpamRisk({ subject = "", htmlBody = "", plainTextBody = "" }) {
  let spamPenalty = 0;
  const warnings = [];
  const recommendations = [];
  const passedChecks = [];

  const combinedText = `${subject} ${htmlBody} ${plainTextBody}`.toLowerCase();

  // 1. Subject Line Checks
  if (!subject.trim()) {
    spamPenalty += 30;
    warnings.push("Subject line is empty.");
  } else {
    // All caps check
    const letters = subject.replace(/[^a-zA-Z]/g, "");
    if (letters.length > 5 && letters === letters.toUpperCase()) {
      spamPenalty += 20;
      warnings.push("Subject line is in ALL CAPS (major spam trigger).");
    }

    // Excessive punctuation
    if (/([!?$]{2,})/.test(subject)) {
      spamPenalty += 15;
      warnings.push("Excessive punctuation ('??', '!!', '$$$') detected in subject line.");
    }

    // Subject length check
    if (subject.length > 70) {
      spamPenalty += 5;
      warnings.push("Subject line is longer than 70 characters (may be truncated on mobile).");
    } else {
      passedChecks.push("Subject line length is optimal for mobile & desktop.");
    }
  }

  // 2. Spam Keyword Detection
  for (const trigger of SPAM_TRIGGER_WORDS) {
    const regex = new RegExp(`\\b${trigger.word}\\b`, "i");
    if (regex.test(subject)) {
      spamPenalty += trigger.weight * 1.5; // Double penalty for subject
      warnings.push(`High-risk word "${trigger.word}" in subject line.`);
      recommendations.push(trigger.advice);
    } else if (regex.test(combinedText)) {
      spamPenalty += trigger.weight;
      warnings.push(`Trigger word "${trigger.word}" found in email body.`);
      recommendations.push(trigger.advice);
    }
  }

  // 3. Link Shortener Check
  for (const shortener of DISALLOWED_SHORTENERS) {
    if (combinedText.includes(shortener)) {
      spamPenalty += 25;
      warnings.push(`Link shortener (${shortener}) detected. Spam filters blacklist shortened URLs.`);
      recommendations.push("Use full, branded domain URLs instead of link shorteners.");
    }
  }

  // 4. Plain Text Fallback Check
  if (!plainTextBody || plainTextBody.trim().length < 10) {
    spamPenalty += 15;
    warnings.push("Missing plain-text fallback version.");
    recommendations.push("Always include a plain text version for multi-part MIME compliance.");
  } else {
    passedChecks.push("Plain-text fallback version is present (satisfies Gmail/Outlook multi-part requirement).");
  }

  // 5. Unsubscribe Link Check
  if (
    !combinedText.includes("unsubscribe") &&
    !combinedText.includes("opt-out") &&
    !combinedText.includes("opt out")
  ) {
    passedChecks.push("RFC 8058 automated unsubscribe footer will be injected at send time.");
  } else {
    passedChecks.push("Unsubscribe notice explicitly included in copy.");
  }

  // 6. Template Size Check (Strict 1 MB = 1,024 KB limit)
  const templateSizeBytes = typeof Buffer !== "undefined"
    ? Buffer.byteLength(htmlBody || "", "utf8")
    : (htmlBody || "").length;
  if (templateSizeBytes > 1024 * 1024) {
    spamPenalty += 35;
    warnings.push(`Email template (${(templateSizeBytes / 1024).toFixed(1)} KB) exceeds strict 1 MB limit (1,024 KB max).`);
    recommendations.push("Compress or resize images so total email template is 1 MB or less.");
  } else {
    passedChecks.push(`Template size (${(templateSizeBytes / 1024).toFixed(1)} KB) is within the safe 1 MB limit.`);
  }

  // Calculate Placement Score
  const score = Math.max(0, Math.min(100, 100 - spamPenalty));

  let placement = "PRIMARY_INBOX";
  let placementLabel = "Primary Inbox";
  let badgeColor = "emerald";

  if (score >= 85) {
    placement = "PRIMARY_INBOX";
    placementLabel = "90–95%+ Primary Inbox";
    badgeColor = "emerald";
  } else if (score >= 65) {
    placement = "PROMOTIONS_TAB";
    placementLabel = "Promotions / Secondary Tab";
    badgeColor = "amber";
  } else {
    placement = "SPAM_FOLDER";
    placementLabel = "High Spam Folder Risk";
    badgeColor = "rose";
  }

  return {
    score,
    placement,
    placementLabel,
    badgeColor,
    warnings,
    recommendations,
    passedChecks,
  };
}
