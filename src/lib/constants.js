export const CAMPAIGN_STATUS = {
  DRAFT: "DRAFT",
  QUEUED: "QUEUED",
  PROCESSING: "PROCESSING",
  COMPLETED: "COMPLETED",
  PAUSED: "PAUSED",
};

export const RECIPIENT_STATUS = {
  PENDING: "PENDING",
  SENT: "SENT",
  FAILED: "FAILED",
  BOUNCED: "BOUNCED",
  UNSUBSCRIBED: "UNSUBSCRIBED",
};

export const SUPPRESSION_REASON = {
  UNSUBSCRIBE: "UNSUBSCRIBE",
  BOUNCE: "BOUNCE",
  COMPLAINT: "COMPLAINT",
  MANUAL: "MANUAL",
};

export const SENDER_OPTIONS = [
  {
    label: "Info Team",
    email: process.env.DEFAULT_SENDER_INFO || "info@yourdomain.com",
    defaultName: "Company Info",
    replyTo: process.env.DEFAULT_SENDER_INFO || "info@yourdomain.com",
  },
  {
    label: "Sales Team",
    email: process.env.DEFAULT_SENDER_SALES || "sales@yourdomain.com",
    defaultName: "Sales Department",
    replyTo: process.env.DEFAULT_SENDER_SALES || "sales@yourdomain.com",
  },
];

// Recommended warm-up daily tiers
export const WARM_UP_TIERS = [
  { day: 1, limit: 100, intervalSeconds: 45 },
  { day: 3, limit: 250, intervalSeconds: 40 },
  { day: 5, limit: 500, intervalSeconds: 35 },
  { day: 8, limit: 1000, intervalSeconds: 35 },
  { day: 11, limit: 1350, intervalSeconds: 30 },
];
