import type { SearchDocumentResult } from "@/lib/search";
import {
  formatValue,
  formatFee,
  limitWords,
  normalizeWhitespace,
} from "@/lib/formatters";

type FeeDetails = {
  programName: string;
  duration?: string;
  tuitionFee?: string;
  examFee?: string;
  hostelFee?: string;
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
  "Hostel Fee",
  "Hostel fees",
];

const NO_VALUE_MARKERS = new Set(["", "-", "|", "na", "n/a"]);

export function formatKnowledgeAnswer(
  result: SearchDocumentResult,
  query: string,
): string | null {
  if (result.category === "hostel") {
    return formatHostelAnswer(query, result.content);
  }

  const admissionAnswer = formatAdmissionAnswer(result, query);

  if (admissionAnswer) {
    return admissionAnswer;
  }

  if (isFeeDocument(result)) {
    return formatFeeAnswer(result, query);
  }

  return formatCourseDetailsAnswer(result);
}

export function formatAggregatedCourseInfo(
  results: SearchDocumentResult[],
  type: "fee" | "specialization",
): string | null {
  const infoMap = new Map<string, { fee?: string; specialization?: string }>();

  for (const result of results) {
    const details = extractCoursePageFeeDetails(result);
    const programName = details 
      ? simplifyProgramName(details.programName)
      : simplifyProgramName(result.title);

    // Skip generic or irrelevant titles
    if (programName.toLowerCase().includes("fee structure") || 
        programName.toLowerCase().includes("brochure") ||
        programName.length < 3) {
      continue;
    }

    const existing = infoMap.get(programName) || {};

    if (type === "fee") {
      if (details?.tuitionFee) {
        existing.fee = formatFee(details.tuitionFee);
      } else {
        existing.fee = existing.fee || "Contact for details";
      }
    }
    
    existing.specialization = programName;
    infoMap.set(programName, existing);
  }

  // If we are looking for fees, filter out entries that ONLY have "Contact for details"
  // if we have at least some with actual fees.
  if (type === "fee") {
    const hasAnyActualFee = Array.from(infoMap.values()).some(info => info.fee && info.fee !== "Contact for details");
    if (hasAnyActualFee) {
      for (const [name, info] of infoMap.entries()) {
        if (info.fee === "Contact for details") {
          infoMap.delete(name);
        }
      }
    }
  }

  if (infoMap.size === 0) {
    return null;
  }

  const items = Array.from(infoMap.entries())
    .slice(0, 10)
    .map(([name, info]) => {
      if (type === "fee") {
        return `| ${name} | ${info.fee || "Contact for details"} |`;
      }
      return `• ${name}`;
    });

  if (type === "fee") {
    return [
      "| Specialization | Tuition Fee |",
      "| :--- | :--- |",
      ...items,
    ].join("\n");
  }

  return ["Available Specializations:", ...items].join("\n");
}

export function formatGeneralFeeStructureResponse(): string {
  return [
    "### Fee Structure",
    "",
    "The fee structure at Galgotias University is divided into multiple components:",
    "",
    "• Tuition Fee",
    "• Registration / Admission Fee",
    "• Examination Fee",
    "• Caution / Security Deposit (if applicable)",
    "• Hostel Fee (for hostel residents)",
    "• Transport Fee (for students using university transport)",
    "",
    "The exact amount varies depending on the course, specialization, and facilities selected.",
    "",
    "For detailed fee information, please check the respective course, hostel, or transport sections available in this chatbot.",
  ].join("\n");
}

export function formatScholarshipInfoResponse(): string {
  return [
    "### Scholarship Information",
    "",
    "Galgotias University offers various scholarship opportunities to support meritorious and deserving students:",
    "",
    "• **Merit-Based Scholarships:** Based on Class 12th marks, JEE Main, CUET, NEET, and other qualifying entrance examinations.",
    "• **Sports Scholarships:** Awarded to students with exceptional achievements in various sports categories.",
    "• **NCC Scholarships:** Available for students who have served in the National Cadet Corps.",
    "• **Cultural & Extracurricular Scholarships:** Provided to students excelling in fine arts, performing arts, and other cultural activities.",
    "• **Special Category Scholarships:** Includes financial aid for students belonging to specific categories or backgrounds.",
    "",
    "Scholarships are subject to university policies and the submission of valid supporting documents. Students are encouraged to apply early as seats may be limited.",
  ].join("\n");
}

export function formatPaymentMethodsResponse(): string {
  return [
    "### Payment Methods",
    "",
    "Galgotias University generally accepts fee payments through:",
    "",
    "• UPI Payments",
    "• Debit Cards",
    "• Credit Cards",
    "  - Visa",
    "  - Mastercard",
    "  - RuPay (if supported)",
    "• Net Banking",
    "• NEFT Bank Transfer",
    "• RTGS Bank Transfer",
    "• Cash Payment (where applicable)",
    "• Education Loans from approved banking partners",
    "",
    "Students should verify the latest payment options and instructions on the official admissions portal before making payments.",
  ].join("\n");
}

export function formatPlacementStatsResponse(): string {
  return [
    "### Latest Placement Statistics",
    "",
    "As per recent university placement records:",
    "",
    "• 526 students placed in Infosys",
    "• 228 students placed in Capgemini",
    "• 205 students placed in Cognizant",
    "• 188 students placed in City Union Bank",
    "• 119 students placed in LTM",
    "• 91 students placed in Accenture",
    "• 61 students placed in EY",
    "",
    "These figures demonstrate strong recruitment activity across IT, consulting, banking, and corporate sectors.",
    "",
    "**Note:** Placement statistics may vary from year to year depending on graduating batch size, market conditions, and recruitment drives.",
  ].join("\n");
}

export function formatHostelAnswer(query: string, content: string): string {
  const normalized = query.toLowerCase();

  if (/\bfees?\b/i.test(normalized)) {
    return [
      "### Hostel Fees",
      "",
      "• Approximate Hostel Fee: ₹1.6L/year",
      "• Includes accommodation and basic hostel services",
      "• Fees may vary depending on room type and occupancy",
      "• Students should verify the latest fee structure from the admission office",
    ].join("\n");
  }

  if (/\brules|regulations\b/i.test(normalized)) {
    return [
      "### Hostel Rules & Regulations",
      "",
      "• Students must carry a valid hostel ID card.",
      "• Hostel entry/exit timings must be followed.",
      "• Ragging is strictly prohibited.",
      "• Visitors are allowed only during permitted hours.",
      "• Students are responsible for maintaining cleanliness.",
      "• Damage to hostel property may result in penalties.",
      "• Silence and discipline should be maintained in residential areas.",
    ].join("\n");
  }

  // Default to facilities
  const normalizedContent = content.toLowerCase();
  const facilities = [
    ["Wi-Fi", /\bwi-?fi|internet/.test(normalizedContent)],
    ["Furnished rooms", /furnished|comfortable|rooms?/.test(normalizedContent)],
    ["Mess", /\bmess|food|dining/.test(normalizedContent)],
    ["Security", /security|safe|cctv/.test(normalizedContent)],
    ["Laundry", /laundry/.test(normalizedContent)],
  ]
    .filter(([, present]) => present)
    .map(([label]) => `• ${label}`);

  if (facilities.length > 0) {
    return ["### Hostel Facilities", "", ...facilities].join("\n");
  }

  return [
    "### Hostel Information",
    "",
    content
      .replace(/\s+/g, " ")
      .split(/\.\s+/)
      .filter((s) => s.length > 20)
      .slice(0, 3)
      .join(". ") + ".",
  ].join("\n");
}

export function formatAdmissionsResponse(query: string): string | null {
  const normalized = query.toLowerCase();

  if (/\beligibility\b/i.test(normalized)) {
    return [
      "### Admission Eligibility",
      "",
      "• Galgotias University evaluates students based on multiple criteria such as academic performance, entrance requirements (where applicable), and course-specific eligibility conditions.",
      "• Eligibility requirements vary from course to course.",
      "• Students interested in a specific program should check the detailed eligibility criteria on the official admissions page.",
      "• Different undergraduate and postgraduate programs may have different academic and subject requirements.",
    ].join("\n");
  }

  if (/\bapply|application|admission process\b/i.test(normalized)) {
    return [
      "### Admission Process",
      "",
      "1. Fill out the online application form.",
      "2. Pay the registration/application fee.",
      "3. Upload or submit the required documents.",
      "4. The university reviews your application and eligibility.",
      "5. Visit the university if document verification or counselling is required.",
      "6. After successful verification and approval, your admission is confirmed.",
      "",
      "**Note:**",
      "Admission procedures may vary slightly depending on the course. Students are advised to check the official admissions portal for the latest updates and course-specific requirements.",
    ].join("\n");
  }

  if (/\bdocuments?\b/i.test(normalized)) {
    return [
      "### Required Documents",
      "",
      "• Class 10 Marksheet",
      "• Class 12 Marksheet",
      "• Graduation Marksheet (for PG courses)",
      "• Passport-size Photographs",
      "• Government-issued ID Proof",
      "• Transfer/Migration Certificate (if applicable)",
      "• Category Certificate (if applicable)",
    ].join("\n");
  }

  return null;
}

function formatAdmissionAnswer(
  result: SearchDocumentResult,
  query: string,
): string | null {
  if (
    result.category !== "admissions" ||
    !/\bdocuments?|checklist|required\b/i.test(query)
  ) {
    return null;
  }

  const checklist = extractAdmissionDocumentChecklist(result.content);

  if (checklist.length === 0) {
    return null;
  }

  return [
    "Admission Documents:",
    ...checklist.slice(0, 12).map((item) => `• ${item}`),
  ].join("\n");
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

  const queryType = classifyQuery(query);
  const label = simplifyProgramName(details.programName);

  if (queryType === "duration" && details.duration) {
    return `${label} Duration: ${formatValue(details.duration)}`;
  }

  if (queryType === "eligibility" && details.eligibility) {
    return formatEligibility(details.eligibility);
  }

  if (details.tuitionFee) {
    return `${label} Fee: ${formatFee(details.tuitionFee)}`;
  }

  return compactLines([
    details.duration ? `${label} Duration: ${formatValue(details.duration)}` : null,
    details.examFee ? `Exam Fee: ${formatFee(details.examFee)}` : null,
    details.hostelFee ? `Hostel Fee: ${formatFee(details.hostelFee)}` : null,
    details.eligibility ? formatEligibility(details.eligibility) : null,
  ]);
}

function formatCourseDetailsAnswer(result: SearchDocumentResult): string | null {
  const details = extractCoursePageFeeDetails(result);

  if (!details?.duration && !details?.eligibility) {
    return null;
  }

  return [
    details.duration
      ? `${simplifyProgramName(details.programName)} Duration: ${formatValue(details.duration)}`
      : null,
    details.eligibility ? formatEligibility(details.eligibility) : null,
    details.tuitionFee
      ? `${simplifyProgramName(details.programName)} Fee: ${formatFee(details.tuitionFee)}`
      : null,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

function classifyQuery(query: string): "duration" | "eligibility" | "fee" | "general" {
  if (/\bduration|how long|years?\b/i.test(query)) {
    return "duration";
  }

  if (/\beligib|requirement|criteria\b/i.test(query)) {
    return "eligibility";
  }

  if (/\bfees?|tuition|cost|price\b/i.test(query)) {
    return "fee";
  }

  return "general";
}

function formatEligibility(eligibility: string): string {
  const requirements = eligibility
    .split(/\s+(?:Or|OR)\s+|;\s*/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 4);

  return ["Eligibility:", ...requirements.map((item) => `• ${limitWords(item, 22)}`)].join("\n");
}

function simplifyProgramName(programName: string): string {
  return programName
    .replace(/\s*-\s*Cwork.*$/i, "")
    .replace(/^Department of\s+/i, "")
    .replace(/\s*\|\s*Galgotias University\s*$/i, "")
    .trim();
}

function compactLines(lines: Array<string | null>): string {
  return lines.filter((line): line is string => Boolean(line)).slice(0, 3).join("\n");
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
  const hostelFee =
    extractFieldValue(content, "Hostel Fee") ??
    extractFieldValue(content, "Hostel fees");
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

  if (!duration && !tuitionFee && !examFee && !eligibility && !hostelFee) {
    return null;
  }

  return {
    programName,
    duration,
    tuitionFee,
    examFee,
    hostelFee,
    eligibility,
    otherFees,
  };
}

function extractAdmissionDocumentChecklist(content: string): string[] {
  const normalizedContent = normalizeWhitespace(content);
  const checklistMatch = normalizedContent.match(
    /Document Checklist\s+(.+?)\s+Note\s*-/i,
  );
  const checklistText = checklistMatch?.[1];

  if (!checklistText) {
    return [];
  }

  return checklistText
    .split(/\s+-\s+/)
    .map((item) => item.replace(/^\-\s*/, "").trim())
    .filter(Boolean);
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

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1);
}
