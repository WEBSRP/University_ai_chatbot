import type { SearchDocumentResult } from "@/lib/search";

type FeeDetails = {
  programName: string;
  duration?: string;
  tuitionFee?: string;
  examFee?: string;
  eligibility?: string;
  otherFees: Array<{
    label: string;
    value: string;
  }>;
};

const FIELD_LABELS = [
  "Duration",
  "Tuition Fee (per annum)",
  "Tuition fees (Per Annum)",
  "Tution fees (Per Annum)",
  "Exam Fee (per annum)",
  "Exam Fees (Per Annum)",
  "Medical Insurance (Per Annum)",
  "Caution Money (One Time Payment )",
  "Caution Money(One Time Payment)",
  "Student ID Card",
  "Training & Certification Fee",
  "Clinical Training Fee",
  "One-time registration fee",
  "One-Time Registration Fee",
  "Eligibility",
];

const NO_VALUE_MARKERS = new Set(["", "-", "|", "na", "n/a"]);

export function formatKnowledgeAnswer(
  result: SearchDocumentResult,
  query: string,
): string | null {
  if (isFeeDocument(result)) {
    return formatFeeAnswer(result, query);
  }

  return formatCourseDetailsAnswer(result);
}

function isFeeDocument(result: SearchDocumentResult): boolean {
  return (
    result.category.toLowerCase().includes("fee") ||
    /fee structure|tuition fee|tuition fees|exam fee/i.test(result.content)
  );
}

function formatFeeAnswer(
  result: SearchDocumentResult,
  query: string,
): string | null {
  const details = hasFeeTable(result.content)
    ? extractTableFeeDetails(result, query) ?? extractCoursePageFeeDetails(result)
    : extractCoursePageFeeDetails(result) ?? extractTableFeeDetails(result, query);

  if (!details) {
    return null;
  }

  return [
    `### ${details.programName}`,
    "",
    "**Fee Details**",
    details.duration ? `- **Duration:** ${details.duration}` : null,
    details.tuitionFee ? `- **Tuition Fee:** ${details.tuitionFee}` : null,
    details.examFee ? `- **Exam Fee:** ${details.examFee}` : null,
    details.otherFees.length > 0
      ? `- **Other Fees:** ${details.otherFees
          .map((fee) => `${fee.label}: ${fee.value}`)
          .join(", ")}`
      : null,
    details.eligibility ? "" : null,
    details.eligibility ? "**Eligibility**" : null,
    details.eligibility ? details.eligibility : null,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

function formatCourseDetailsAnswer(result: SearchDocumentResult): string | null {
  const details = extractCoursePageFeeDetails(result);

  if (!details?.duration && !details?.eligibility) {
    return null;
  }

  return [
    `### ${details.programName}`,
    "",
    details.duration ? `- **Duration:** ${details.duration}` : null,
    details.eligibility ? `- **Eligibility:** ${details.eligibility}` : null,
    details.tuitionFee ? `- **Tuition Fee:** ${details.tuitionFee}` : null,
    details.examFee ? `- **Exam Fee:** ${details.examFee}` : null,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

function extractCoursePageFeeDetails(
  result: SearchDocumentResult,
): FeeDetails | null {
  const content = normalizeWhitespace(result.content);
  const programName = extractProgramName(result, content);

  if (programName.includes("|")) {
    return null;
  }

  const duration = extractFieldValue(content, "Duration");
  const tuitionFee =
    extractFieldValue(content, "Tuition Fee (per annum)") ??
    extractFieldValue(content, "Tuition fees (Per Annum)") ??
    extractFieldValue(content, "Tution fees (Per Annum)");
  const examFee =
    extractFieldValue(content, "Exam Fee (per annum)") ??
    extractFieldValue(content, "Exam Fees (Per Annum)");
  const eligibility = extractEligibility(content);
  const otherFees = [
    "Medical Insurance (Per Annum)",
    "Caution Money (One Time Payment )",
    "Caution Money(One Time Payment)",
    "Student ID Card",
    "Training & Certification Fee",
    "Clinical Training Fee",
    "One-time registration fee",
    "One-Time Registration Fee",
  ]
    .map((label) => ({ label: cleanLabel(label), value: extractFieldValue(content, label) }))
    .filter(
      (fee): fee is { label: string; value: string } =>
        isMeaningfulValue(fee.value),
    );

  if (!duration && !tuitionFee && !examFee && !eligibility) {
    return null;
  }

  return {
    programName,
    duration,
    tuitionFee,
    examFee,
    eligibility,
    otherFees,
  };
}

function extractTableFeeDetails(
  result: SearchDocumentResult,
  query: string,
): FeeDetails | null {
  const content = normalizeWhitespace(result.content);
  const headerPattern =
    /Mode of apply\s*\|\s*Duration\s*\|\s*Tui?t?ion fees?\s*\(Per Annum\)\s*\|\s*Exam Fees\s*\(Per Annum\)\s*\|\s*Medical Insurance\s*\(Per Annum\)\s*\|\s*Caution Money\s*\(One Time Payment\)\s*\|\s*Student ID Card\s*\|\s*Training & Certification Fee\s*\|\s*Clinical Training Fee\s*\|\s*Eligibility/gi;
  const matches = Array.from(content.matchAll(headerPattern));

  if (matches.length === 0) {
    return null;
  }

  const rows = matches
    .map((match) => parseFeeRow(content, match.index ?? 0))
    .filter((row): row is FeeDetails => row !== null);

  return pickBestFeeRow(rows, query);
}

function parseFeeRow(content: string, headerIndex: number): FeeDetails | null {
  const beforeHeader = content.slice(0, headerIndex);
  const programName =
    beforeHeader.match(/Department of [^|]+$/i)?.[0]?.trim() ??
    "Fee Structure";
  const afterHeader = content.slice(headerIndex);
  const cells = afterHeader
    .split("|")
    .map((cell) => cell.trim())
    .filter((cell) => cell.length > 0);
  const rowStart = cells.findIndex(
    (cell, index) =>
      index > 10 &&
      !/^-+$/.test(cell) &&
      /\b\d+\s*Years?\b|Cwork/i.test(cells[index + 1] ?? ""),
  );

  if (rowStart < 0) {
    return null;
  }

  const [
    mode,
    duration,
    tuitionFee,
    examFee,
    medicalInsurance,
    cautionMoney,
    studentIdCard,
    trainingFee,
    clinicalFee,
    eligibility,
  ] = cells.slice(rowStart, rowStart + 10);

  if (!mode || !duration) {
    return null;
  }

  return {
    programName: `${programName} - ${mode}`,
    duration,
    tuitionFee,
    examFee,
    eligibility,
    otherFees: [
      { label: "Medical Insurance", value: medicalInsurance },
      { label: "Caution Money", value: cautionMoney },
      { label: "Student ID Card", value: studentIdCard },
      { label: "Training & Certification Fee", value: trainingFee },
      { label: "Clinical Training Fee", value: clinicalFee },
    ].filter((fee) => isMeaningfulValue(fee.value)),
  };
}

function pickBestFeeRow(rows: FeeDetails[], query: string): FeeDetails | null {
  if (rows.length === 0) {
    return null;
  }

  const queryTokens = tokenize(query);

  return rows
    .map((row) => ({
      row,
      score: tokenize(`${row.programName} ${row.eligibility ?? ""}`).filter(
        (token) => queryTokens.includes(token),
      ).length,
    }))
    .sort((a, b) => b.score - a.score)[0].row;
}

function extractProgramName(
  result: SearchDocumentResult,
  content: string,
): string {
  const fromContent = content.match(/^(.+?)\s+Department of /i)?.[1]?.trim();
  return fromContent || result.title.replace(/\s*\|\s*Galgotias University\s*$/i, "");
}

function hasFeeTable(content: string): boolean {
  return /Mode of apply\s*\|\s*Duration\s*\|/i.test(content);
}

function extractEligibility(content: string): string | undefined {
  const match = content.match(
    /(?:About the Programme\s+)?Eligibility\s+(.+?)\s+Fee Structure/i,
  );
  return cleanValue(match?.[1]);
}

function extractFieldValue(content: string, label: string): string | undefined {
  const labelIndex = content.toLowerCase().indexOf(label.toLowerCase());

  if (labelIndex < 0) {
    return undefined;
  }

  const valueStart = labelIndex + label.length;
  const nextLabelIndex = FIELD_LABELS.map((fieldLabel) =>
    content.toLowerCase().indexOf(fieldLabel.toLowerCase(), valueStart),
  )
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0];

  return cleanValue(content.slice(valueStart, nextLabelIndex ?? undefined));
}

function cleanLabel(label: string): string {
  return label
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanValue(value: string | undefined): string | undefined {
  const cleaned = value
    ?.replace(/\bIMPORTANT LINKS\b.*$/i, "")
    .replace(/\bProgram Structure\b.*$/i, "")
    .replace(/\bAPPLY NOW\b.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();

  return isMeaningfulValue(cleaned) ? cleaned : undefined;
}

function isMeaningfulValue(value: string | undefined): value is string {
  return Boolean(value && !NO_VALUE_MARKERS.has(value.toLowerCase()));
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1);
}
