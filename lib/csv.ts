import type { ClaimType, Prospect } from "./types";

const CLAIM_LABELS: Record<ClaimType, string> = {
  explicit_request: "Explicit request",
  inferred_need: "Inferred need",
  company_fit: "Company fit only",
};

export function safeCsvCell(value: unknown): string {
  let text = String(value ?? "").replace(/\u0000/g, "");
  // Formula injection can begin after whitespace or control characters.
  if (/^[\s]*[=+\-@]/.test(text) || /^[\t\r]/.test(text)) {
    text = `'${text}`;
  }
  return `"${text.replace(/"/g, '""')}"`;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(safeCsvCell).join(",")];
  for (const row of rows) lines.push(row.map(safeCsvCell).join(","));
  return `\ufeff${lines.join("\r\n")}\r\n`;
}

export function prospectsToCsv(prospects: Prospect[]): string {
  const headers = [
    "Company",
    "Website",
    "Industry",
    "Location",
    "Employees",
    "Pipeline stage",
    "Notes",
    "Contact name",
    "Contact email",
    "Contact source",
    "Claim type",
    "Source title",
    "Source URL",
    "Retrieved at",
    "Published at",
    "Evidence excerpt",
    "Factual summary",
    "Data type",
  ];

  const rows = prospects.map((prospect) => {
    const primary = prospect.evidence[0];
    return [
      prospect.name,
      prospect.website,
      prospect.industry,
      prospect.location,
      prospect.employeeCount ?? "Not available",
      prospect.stage,
      prospect.notes,
      prospect.contactName ?? "",
      prospect.contactEmail ?? "Not available",
      prospect.contactSource ?? "",
      primary ? CLAIM_LABELS[primary.claimType] : "",
      primary?.sourceTitle ?? "",
      primary?.sourceUrl ?? "",
      primary?.retrievedAt ?? "",
      primary?.publishedAt ?? "Not available",
      primary?.excerpt ?? "",
      primary?.summary ?? "",
      "LIVE PILOT — manual evidence",
    ];
  });

  return toCsv(headers, rows);
}
