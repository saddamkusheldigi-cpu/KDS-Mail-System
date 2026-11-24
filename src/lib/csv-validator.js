import Papa from "papaparse";

// RFC 5322 compliant regex check for email
const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

/**
 * Validate an email string
 * @param {string} email
 * @returns {boolean}
 */
export function isValidEmail(email) {
  if (!email || typeof email !== "string") return false;
  const trimmed = email.trim();
  if (trimmed.length > 254) return false;
  return EMAIL_REGEX.test(trimmed);
}

/**
 * Parse CSV text and validate recipient data
 * @param {string} csvText
 * @returns {{ validRecipients: Array<object>, invalidRows: Array<object>, duplicatesCount: number, detectedVariables: string[] }}
 */
export function parseAndValidateCSV(csvText) {
  const parsed = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => header.trim().toLowerCase(),
  });

  if (parsed.errors && parsed.errors.length > 0) {
    const criticalError = parsed.errors.find((e) => e.type === "Delimiter");
    if (criticalError) {
      throw new Error(`CSV Parsing error: ${criticalError.message}`);
    }
  }

  const rawRows = parsed.data || [];
  const validRecipients = [];
  const invalidRows = [];
  const seenEmails = new Set();
  let duplicatesCount = 0;

  // Detect variable columns (excluding core 'email' key)
  const allHeaders = parsed.meta.fields || [];
  const detectedVariables = allHeaders.filter((h) => h !== "email");

  for (let index = 0; index < rawRows.length; index++) {
    const row = rawRows[index];

    // Find email field (look for 'email' or 'e-mail' or 'email address')
    const emailKey =
      Object.keys(row).find((k) =>
        ["email", "e-mail", "email_address", "emailaddress"].includes(k.toLowerCase())
      ) || "email";

    const rawEmail = (row[emailKey] || "").trim().toLowerCase();

    if (!isValidEmail(rawEmail)) {
      invalidRows.push({
        rowNumber: index + 2, // header is row 1
        data: row,
        reason: rawEmail ? "Invalid email format" : "Missing email address",
      });
      continue;
    }

    if (seenEmails.has(rawEmail)) {
      duplicatesCount++;
      continue;
    }

    seenEmails.add(rawEmail);

    // Name mapping fallback
    const nameKey =
      Object.keys(row).find((k) =>
        ["name", "fullname", "full_name", "first_name", "firstname"].includes(k.toLowerCase())
      );
    const name = nameKey ? (row[nameKey] || "").trim() : "";

    // Company mapping fallback
    const companyKey =
      Object.keys(row).find((k) =>
        ["company", "company_name", "organization", "business"].includes(k.toLowerCase())
      );
    const company = companyKey ? (row[companyKey] || "").trim() : "";

    // Remaining custom fields
    const customVariables = {};
    for (const [key, value] of Object.entries(row)) {
      if (key !== emailKey && key !== nameKey && key !== companyKey) {
        customVariables[key] = typeof value === "string" ? value.trim() : value;
      }
    }

    validRecipients.push({
      email: rawEmail,
      name,
      company,
      customVariables,
    });
  }

  return {
    validRecipients,
    invalidRows,
    duplicatesCount,
    detectedVariables,
  };
}
