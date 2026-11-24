import { NextResponse } from "next/server";
import dns from "dns/promises";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const { domain, dkimSelector = "google" } = await req.json();

    if (!domain || typeof domain !== "string") {
      return NextResponse.json({ success: false, error: "Valid domain is required" }, { status: 400 });
    }

    const cleanDomain = domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");

    // 1. Check MX records
    let mxRecords = [];
    let mxValid = false;
    try {
      mxRecords = await dns.resolveMx(cleanDomain);
      mxValid = mxRecords.length > 0;
    } catch {
      mxValid = false;
    }

    // 2. Check SPF in TXT records
    let spfValid = false;
    let spfRecord = null;
    try {
      const txtRecords = await dns.resolveTxt(cleanDomain);
      const flatTxt = txtRecords.map((chunk) => chunk.join(""));
      spfRecord = flatTxt.find((r) => r.startsWith("v=spf1")) || null;
      spfValid = Boolean(spfRecord);
    } catch {
      spfValid = false;
    }

    // 3. Check DMARC in _dmarc.domain
    let dmarcValid = false;
    let dmarcRecord = null;
    try {
      const dmarcTxt = await dns.resolveTxt(`_dmarc.${cleanDomain}`);
      const flatDmarc = dmarcTxt.map((chunk) => chunk.join(""));
      dmarcRecord = flatDmarc.find((r) => r.startsWith("v=DMARC1")) || null;
      dmarcValid = Boolean(dmarcRecord);
    } catch {
      dmarcValid = false;
    }

    // 4. Check DKIM (try requested selector or common selectors)
    let dkimValid = false;
    let dkimRecord = null;
    let matchedSelector = null;
    const selectorsToTry = [dkimSelector, "google", "default", "k1", "ses"];

    for (const sel of selectorsToTry) {
      if (!sel) continue;
      try {
        const dkimTxt = await dns.resolveTxt(`${sel}._domainkey.${cleanDomain}`);
        const flatDkim = dkimTxt.map((chunk) => chunk.join(""));
        const found = flatDkim.find((r) => r.includes("k=rsa") || r.includes("p="));
        if (found) {
          dkimValid = true;
          dkimRecord = found;
          matchedSelector = sel;
          break;
        }
      } catch {
        // Try next selector
      }
    }

    // Calculate Deliverability Readiness Score (0 - 100)
    let score = 0;
    if (mxValid) score += 20;
    if (spfValid) score += 30;
    if (dkimValid) score += 30;
    if (dmarcValid) score += 20;

    return NextResponse.json({
      success: true,
      domain: cleanDomain,
      score,
      status: score >= 80 ? "EXCELLENT" : score >= 50 ? "FAIR" : "POOR",
      records: {
        mx: { valid: mxValid, records: mxRecords },
        spf: { valid: spfValid, record: spfRecord },
        dmarc: { valid: dmarcValid, record: dmarcRecord },
        dkim: { valid: dkimValid, record: dkimRecord, selector: matchedSelector },
      },
    });
  } catch (err) {
    console.error("DNS verification failed:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to query DNS" },
      { status: 500 }
    );
  }
}
