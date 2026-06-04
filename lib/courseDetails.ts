import { promises as fs } from "fs";
import path from "path";
import type { KnowledgeDocument } from "@/lib/search";
import type { SourceLink } from "@/lib/sources";
import {
  formatValue,
  formatFee,
  limitWords,
  normalizeWhitespace,
} from "@/lib/formatters";

export type CourseLevel = "ug" | "pg";
export type CourseField =
  | "overview"
  | "eligibility"
  | "fee"
  | "duration"
  | "admission"
  | "placements";

export type CourseDetailResponse = {
  answer: string;
  sources: SourceLink[];
};

const KNOWLEDGE_DIR = path.join(process.cwd(), "knowledge_clean");

const COURSE_ALIASES: Record<string, RegExp[]> = {
  "B.Tech": [/\bb\.?\s*tech\b/i, /\bbtech\b/i, /bachelor of technology/i],
  BCA: [/\bbca\b/i, /bachelor of computer applications/i],
  BBA: [/\bbba\b/i, /bachelor of business administration/i],
  "B.Com": [/\bb\.?\s*com\b/i, /bachelor of commerce/i],
  BA: [/\bba\b/i, /\bb\.?\s*a\b/i, /bachelor of arts/i],
  "B.Sc": [/\bb\.?\s*sc\b/i, /bachelor of science/i],
  LLB: [/\bll\.?\s*b\b/i, /bachelor of law/i],
  MBA: [/\bmba\b/i, /master of business administration/i],
  MCA: [/\bmca\b/i, /master of computer applications/i],
  "M.Tech": [/\bm\.?\s*tech\b/i, /\bmtech\b/i, /master of technology/i],
  "M.Sc": [/\bm\.?\s*sc\b/i, /master of science/i],
  MA: [/\bma\b/i, /\bm\.?\s*a\b/i, /master of arts/i],
  LLM: [/\bll\.?\s*m\b/i, /master of laws?/i],
};

const DURATION_FALLBACKS: Record<string, string> = {
  "B.Tech": "4 years",
  BCA: "3 years",
  BBA: "3 years",
  "B.Com": "3 years",
  BA: "3 years",
  "B.Sc": "3 years",
  LLB: "3 years",
  MBA: "2 years",
  MCA: "2 years",
  "M.Tech": "2 years",
  "M.Sc": "2 years",
  MA: "2 years",
  LLM: "1 year",
};

export async function getCourseDetail(
  level: CourseLevel,
  course: string,
  field: CourseField,
): Promise<CourseDetailResponse> {
  const documents = await readKnowledgeDocuments();
  const courseDocuments = findCourseDocuments(documents, level, course);
  const feeDocuments = findFeeDocuments(documents, course);
  const sourceDocuments =
    field === "fee" ? [...feeDocuments, ...courseDocuments] : courseDocuments;
  const primaryDocument = sourceDocuments[0];

  if (!primaryDocument) {
    return {
      answer: `I could not find ${course} details in the course records.`,
      sources: [],
    };
  }

  return {
    answer: buildAnswer(course, field, sourceDocuments),
    sources: uniqueSourceLinks(sourceDocuments.slice(0, 3)),
  };
}

function uniqueSourceLinks(documents: KnowledgeDocument[]): SourceLink[] {
  const seen = new Set<string>();
  const sources: SourceLink[] = [];

  for (const document of documents) {
    if (!document.url || seen.has(document.url)) {
      continue;
    }

    seen.add(document.url);
    sources.push({
      title: cleanSourceTitle(document.title),
      url: document.url,
    });
  }

  return sources;
}

function cleanSourceTitle(title: string): string {
  return title.replace(/\s*\|\s*Galgotias University\s*$/i, "").trim();
}

async function readKnowledgeDocuments(): Promise<KnowledgeDocument[]> {
  const files = (await fs.readdir(KNOWLEDGE_DIR))
    .filter((file) => file.endsWith(".json"))
    .sort();

  return Promise.all(
    files.map(async (file) => {
      const raw = await fs.readFile(path.join(KNOWLEDGE_DIR, file), "utf8");
      const data = JSON.parse(raw) as Partial<KnowledgeDocument>;

      return {
        id: file.replace(/\.json$/, ""),
        title: data.title ?? "",
        url: data.url ?? "",
        category: data.category ?? "",
        content: data.content ?? "",
      };
    }),
  );
}

function findCourseDocuments(
  documents: KnowledgeDocument[],
  level: CourseLevel,
  course: string,
): KnowledgeDocument[] {
  const aliases = COURSE_ALIASES[course] ?? [new RegExp(escapeRegExp(course), "i")];
  const levelPath = level === "ug" ? /under-graduate/i : /post-graduate/i;

  return documents
    .filter((document) => document.category === "courses")
    .filter((document) => levelPath.test(document.url))
    .filter((document) => matchesAliases(`${document.title} ${document.url}`, aliases))
    .sort((a, b) => scoreCourseDocument(b, course) - scoreCourseDocument(a, course));
}

function findFeeDocuments(
  documents: KnowledgeDocument[],
  course: string,
): KnowledgeDocument[] {
  const aliases = COURSE_ALIASES[course] ?? [new RegExp(escapeRegExp(course), "i")];

  return documents
    .filter((document) => document.category === "fees")
    .filter((document) => matchesAliases(`${document.title} ${document.content}`, aliases))
    .slice(0, 3);
}

function scoreCourseDocument(document: KnowledgeDocument, course: string): number {
  const title = document.title.toLowerCase();
  let score = 0;

  if (title === course.toLowerCase()) {
    score += 100;
  }

  if (title.startsWith(course.toLowerCase())) {
    score += 60;
  }

  if (/working professionals|lateral entry|integrated/i.test(document.title)) {
    score -= 30;
  }

  return score;
}

function buildAnswer(
  course: string,
  field: CourseField,
  documents: KnowledgeDocument[],
): string {
  const content = normalizeWhitespace(documents.map((doc) => doc.content).join(" "));

  if (field === "duration") {
    const duration = extractDuration(course, documents, content);
    return duration
      ? `${course} Duration: ${formatDuration(duration)}`
      : `I could not find the ${course} duration in the selected course records.`;
  }

  if (field === "eligibility") {
    const eligibility = extractEligibility(content);
    return eligibility
      ? `Eligibility:\n${toBullets(splitRequirements(eligibility))}`
      : `I could not find ${course} eligibility details.`;
  }

  if (field === "fee") {
    const fee = extractFee(course, content);
    return fee ? `${course} Fee: ${formatFee(fee)}` : `I could not find ${course} fee details.`;
  }

  if (field === "admission") {
    const admission = extractAdmissionSnippet(content);
    return admission
      ? `Admission Process:\n${toBullets([admission])}`
      : "Admission Process:\n• Apply through the official admission portal.";
  }

  if (field === "placements") {
    const placement = extractPlacementSnippet(content);
    return placement
      ? `Placements:\n${toBullets([placement])}`
      : `I could not find ${course} placement details.`;
  }

  return `${course} Overview:\n${toBullets([extractOverview(content)])}`;
}

function extractDuration(
  course: string,
  documents: KnowledgeDocument[],
  content: string,
): string | null {
  const titleDuration = documents
    .map((document) => document.title.match(/\((\d+)\s*Years?\)/i)?.[1])
    .find(Boolean);

  if (titleDuration) {
    return `${titleDuration} years`;
  }

  const numericDuration = content.match(/\b(?:duration\s*)?([1-6])\s*[- ]?\s*years?\b/i)?.[1];

  if (numericDuration) {
    return `${numericDuration} years`;
  }

  const wordDuration = content.match(/\b(one|two|three|four|five)\s*[- ]?\s*year\b/i)?.[1];

  if (wordDuration) {
    return `${wordToNumber(wordDuration)} years`;
  }

  return DURATION_FALLBACKS[course] ?? null;
}

function extractEligibility(content: string): string | null {
  return firstMatch(content, [
    /((?:Minimum|Bachelor|Graduation|Passed)[^.]{20,260}(?:\.|$))/i,
    /(Eligibility\s+[^.]{20,260}(?:\.|$))/i,
  ]);
}

function extractFee(course: string, content: string): string | null {
  const rowFee = extractFeeFromTable(course, content);

  if (rowFee) {
    return rowFee;
  }

  const fee = firstMatch(content, [
    /(?:Tuition fees?|Tuition Fee)\s*(?:\(Per Annum\))?\s*[:|]?\s*(₹?\s?\d[\d,]*)/i,
  ]);

  return fee ? normalizeCurrency(fee) : null;
}

function extractFeeFromTable(course: string, content: string): string | null {
  const aliases = COURSE_ALIASES[course] ?? [];
  const aliasMatch = aliases
    .map((alias) => content.search(alias))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0];

  if (aliasMatch !== undefined) {
    const segment = content.slice(aliasMatch, aliasMatch + 420);
    const fee = segment.match(/\|\s*([\d,]{4,})\s*\|/)?.[1];
    return fee ? `₹${fee}` : null;
  }

  return null;
}

function extractAdmissionSnippet(content: string): string | null {
  return firstMatch(content, [
    /((?:Apply Now|Students with|CUET|JEE|CLAT|MAT|XAT|CMAT|GMAT)[^.]{20,260}(?:\.|$))/i,
  ]);
}

function extractPlacementSnippet(content: string): string | null {
  return firstMatch(content, [
    /((?:leading Global|employment opportunities|career|corporates|companies)[^.]{20,260}(?:\.|$))/i,
  ]);
}

function extractOverview(content: string): string {
  return limitWords(content.split(/\.\s+/)[0] ?? content, 24);
}

function firstMatch(content: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = content.match(pattern)?.[1]?.trim();

    if (match) {
      return match;
    }
  }

  return null;
}

function matchesAliases(value: string, aliases: RegExp[]): boolean {
  return aliases.some((alias) => alias.test(value));
}

function normalizeCurrency(value: string): string {
  const cleaned = value.replace(/\bRs\.?\s*/gi, "₹").replace(/\s+/g, "").trim();
  return cleaned.startsWith("₹") ? cleaned : `₹${cleaned}`;
}

function formatDuration(duration: string): string {
  return duration.replace(/\byears?\b/i, "Years");
}

function splitRequirements(value: string): string[] {
  return value
    .split(/\s+(?:Or|OR)\s+|;\s*/)
    .map((item) => limitWords(item.trim(), 22))
    .filter(Boolean)
    .slice(0, 4);
}

function toBullets(items: string[]): string {
  return items.map((item) => `• ${item}`).join("\n");
}

function wordToNumber(word: string): number {
  const numbers: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
  };

  return numbers[word.toLowerCase()] ?? 0;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
