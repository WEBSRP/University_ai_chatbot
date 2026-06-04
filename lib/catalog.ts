import { promises as fs } from "fs";
import path from "path";
import type { KnowledgeDocument } from "@/lib/search";

export type CatalogTopic =
  | "admissions"
  | "courses"
  | "fees"
  | "hostel"
  | "placements"
  | "scholarships"
  | "contact";

export type CatalogEntry = Pick<
  KnowledgeDocument,
  "id" | "title" | "url" | "category"
> & {
  excerpt: string;
};

export type CatalogSection = {
  topic: CatalogTopic;
  label: string;
  count: number;
  entries: CatalogEntry[];
};

const KNOWLEDGE_DIR = path.join(process.cwd(), "knowledge_clean");
const FEATURED_LIMIT = 8;

const TOPIC_LABELS: Record<CatalogTopic, string> = {
  admissions: "Admissions",
  courses: "Courses",
  fees: "Fee Structure",
  hostel: "Hostel",
  placements: "Placements",
  scholarships: "Scholarships",
  contact: "Contact",
};

const FEATURED_PATTERNS: Record<CatalogTopic, RegExp[]> = {
  admissions: [
    /^admissions\s*\|\s*galgotias university/i,
    /international admission process/i,
    /admission brochure/i,
    /refund policy/i,
    /lateral entry|migration admission/i,
    /phd admission/i,
  ],
  courses: [/programmes?\s*&\s*fees/i, /^b\.?tech/i, /^mba/i, /^bba/i],
  fees: [
    /fee structure & eligibility/i,
    /programmes?\s*&\s*fees/i,
    /financial aid|loan facilities/i,
    /transportation services/i,
    /saarc|non saarc/i,
  ],
  hostel: [/hostel facilities/i],
  placements: [
    /100%\s*placement assistance/i,
    /about placements/i,
    /latest placements/i,
    /leading recruiters/i,
    /placement brochure/i,
    /training & placement/i,
  ],
  scholarships: [/scholarships in galgotias/i, /scholarships and freeships/i],
  contact: [/contact us/i, /international query/i],
};

let cachedCatalog: CatalogSection[] | null = null;

export async function getCatalog(): Promise<CatalogSection[]> {
  if (cachedCatalog) {
    return cachedCatalog;
  }

  const documents = await readKnowledgeDocuments();
  const grouped = new Map<CatalogTopic, KnowledgeDocument[]>();

  for (const document of documents) {
    if (isCatalogTopic(document.category)) {
      const topic = document.category;
      grouped.set(topic, [...(grouped.get(topic) ?? []), document]);
    }
  }

  cachedCatalog = (Object.keys(TOPIC_LABELS) as CatalogTopic[]).map((topic) => {
    const entries = grouped.get(topic) ?? [];

    return {
      topic,
      label: TOPIC_LABELS[topic],
      count: entries.length,
      entries: entries
        .sort((a, b) => scoreFeatured(b, topic) - scoreFeatured(a, topic))
        .slice(0, FEATURED_LIMIT)
        .map(toCatalogEntry),
    };
  });

  return cachedCatalog;
}

export async function getCatalogSection(
  topic: CatalogTopic,
): Promise<CatalogSection | null> {
  const catalog = await getCatalog();
  return catalog.find((section) => section.topic === topic) ?? null;
}

export function getTopicForMessage(message: string): CatalogTopic | null {
  const normalized = message.trim().toLowerCase();

  if (/^(admissions?|admission process|documents?)$/.test(normalized)) {
    return "admissions";
  }

  if (/^(courses?|programmes?|programs?)$/.test(normalized)) {
    return "courses";
  }

  if (/^(fees?|fee structure|programmes? and fees|programs? and fees)$/.test(normalized)) {
    return "fees";
  }

  if (/^hostel$/.test(normalized)) {
    return "hostel";
  }

  if (/^placements?$/.test(normalized)) {
    return "placements";
  }

  if (/^scholarships?$/.test(normalized)) {
    return "scholarships";
  }

  if (/^(contact|contact us)$/.test(normalized)) {
    return "contact";
  }

  return null;
}

export function formatCatalogSection(section: CatalogSection): string {
  const entries = section.entries
    .slice(0, 5)
    .map((entry) => `- **${entry.title}**${entry.excerpt ? `: ${entry.excerpt}` : ""}`);

  return [
    `### ${section.label}`,
    "",
    `I found ${section.count} official ${section.label.toLowerCase()} record${section.count === 1 ? "" : "s"}.`,
    entries.length > 0 ? "" : null,
    ...entries,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
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

function isCatalogTopic(category: string): category is CatalogTopic {
  return category in TOPIC_LABELS;
}

function toCatalogEntry(document: KnowledgeDocument): CatalogEntry {
  return {
    id: document.id,
    title: document.title,
    url: document.url,
    category: document.category,
    excerpt: createExcerpt(document.content),
  };
}

function scoreFeatured(document: KnowledgeDocument, topic: CatalogTopic): number {
  const searchable = `${document.title} ${document.url}`.toLowerCase();
  const patternScore = FEATURED_PATTERNS[topic].reduce(
    (score, pattern, index) => score + (pattern.test(searchable) ? 100 - index : 0),
    0,
  );
  const eventPenalty = /\bevent|workshop|webinar|guest lecture|expert talk|celebration\b/i.test(
    document.title,
  )
    ? 80
    : 0;

  return patternScore - eventPenalty;
}

function createExcerpt(content: string): string {
  return content.replace(/\s+/g, " ").trim().slice(0, 180);
}
