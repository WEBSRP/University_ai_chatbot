import { promises as fs } from "fs";
import path from "path";

export type KnowledgeDocument = {
  id: string;
  title: string;
  url: string;
  category: string;
  content: string;
};

export type SearchResult = {
  id: string;
  title: string;
  url: string;
  category: string;
  snippet: string;
  score: number;
  confidence: number;
};

export type SearchDocumentResult = SearchResult & {
  content: string;
};

type IndexedDocument = KnowledgeDocument & {
  titleTokens: Map<string, number>;
  categoryTokens: Map<string, number>;
  contentTokens: Map<string, number>;
  allText: string;
};

type SearchIndex = {
  documents: IndexedDocument[];
  documentFrequency: Map<string, number>;
};

const KNOWLEDGE_DIR = path.join(process.cwd(), "knowledge_clean");
const MAX_SNIPPET_LENGTH = 240;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 25;

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
]);

let cachedIndex: SearchIndex | null = null;

export async function searchKnowledge(
  query: string,
  limit = DEFAULT_LIMIT,
): Promise<SearchResult[]> {
  return (await searchKnowledgeDocuments(query, limit)).map(
    ({ content: _content, ...result }) => result,
  );
}

export async function searchKnowledgeDocuments(
  query: string,
  limit = DEFAULT_LIMIT,
  categoryFilter?: string,
): Promise<SearchDocumentResult[]> {
  const queryTokens = tokenize(query);

  if (queryTokens.length === 0) {
    return [];
  }

  const index = await getSearchIndex();
  const normalizedQuery = normalizeText(query);
  const resultLimit = clampLimit(limit);

  console.log(`[Search] Query: "${query}", Category Filter: ${categoryFilter || "None"}`);

  const scoredResults = index.documents
    .map((document) => {
      // If category filter is provided, strictly exclude other categories
      if (categoryFilter && document.category.toLowerCase() !== categoryFilter.toLowerCase()) {
        return null;
      }

      const score = scoreDocument(document, queryTokens, normalizedQuery, index);

      if (score <= 0) {
        return null;
      }

      return {
        id: document.id,
        title: document.title,
        url: document.url,
        category: document.category,
        content: document.content,
        snippet: buildSnippet(document.content || document.title, queryTokens),
        score: Number(score.toFixed(4)),
        confidence: 0,
      };
    })
    .filter((result): result is SearchDocumentResult => result !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, resultLimit);

  if (scoredResults.length > 0) {
    console.log(`[Search] Top match: ${scoredResults[0].id} (${scoredResults[0].score})`);
  } else {
    console.log("[Search] No matches found.");
  }

  const topScore = scoredResults[0]?.score ?? 0;

  return scoredResults.map((result) => ({
    ...result,
    confidence: calculateConfidence(result.score, topScore),
  }));
}

export async function getKnowledgeDocumentCount(): Promise<number> {
  const index = await getSearchIndex();
  return index.documents.length;
}

async function getSearchIndex(): Promise<SearchIndex> {
  if (cachedIndex) {
    return cachedIndex;
  }

  const files = (await fs.readdir(KNOWLEDGE_DIR))
    .filter((file) => file.endsWith(".json"))
    .sort();

  const documents = await Promise.all(
    files.map(async (file) => {
      const raw = await fs.readFile(path.join(KNOWLEDGE_DIR, file), "utf8");
      const data = JSON.parse(raw) as Partial<KnowledgeDocument>;

      return indexDocument({
        id: file.replace(/\.json$/, ""),
        title: data.title ?? "",
        url: data.url ?? "",
        category: data.category ?? "",
        content: data.content ?? "",
      });
    }),
  );

  const documentFrequency = new Map<string, number>();

  for (const document of documents) {
    const uniqueTokens = new Set([
      ...document.titleTokens.keys(),
      ...document.categoryTokens.keys(),
      ...document.contentTokens.keys(),
    ]);

    for (const token of uniqueTokens) {
      documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1);
    }
  }

  cachedIndex = { documents, documentFrequency };
  return cachedIndex;
}

function indexDocument(document: KnowledgeDocument): IndexedDocument {
  return {
    ...document,
    titleTokens: countTokens(document.title),
    categoryTokens: countTokens(document.category),
    contentTokens: countTokens(document.content),
    allText: normalizeText(
      `${document.title} ${document.category} ${document.content}`,
    ),
  };
}

function scoreDocument(
  document: IndexedDocument,
  queryTokens: string[],
  normalizedQuery: string,
  index: SearchIndex,
): number {
  let score = 0;
  const uniqueQueryTokens = Array.from(new Set(queryTokens));

  for (const token of uniqueQueryTokens) {
    const titleHits = document.titleTokens.get(token) ?? 0;
    const categoryHits = document.categoryTokens.get(token) ?? 0;
    const contentHits = document.contentTokens.get(token) ?? 0;

    if (titleHits + categoryHits + contentHits === 0) {
      continue;
    }

    const idf = inverseDocumentFrequency(
      token,
      index.documents.length,
      index.documentFrequency,
    );

    score += idf * (titleHits * 8 + categoryHits * 3 + contentHits);
  }

  if (normalizedQuery.length > 2 && document.allText.includes(normalizedQuery)) {
    score += 12;
  }

  score += scoreIntentMatch(document, normalizedQuery);

  return score;
}

function scoreIntentMatch(
  document: IndexedDocument,
  normalizedQuery: string,
): number {
  let score = 0;

  if (/\badmissions?|admission process|documents?|checklist\b/.test(normalizedQuery)) {
    score += document.category === "admissions" ? 35 : 0;
  }

  if (/\bfees?|fee structure|tuition|exam fee\b/.test(normalizedQuery)) {
    score += document.category === "fees" ? 35 : 0;
  }

  if (/\bhostel|accommodation\b/.test(normalizedQuery)) {
    score += document.category === "hostel" ? 35 : 0;
  }

  if (/\bplacements?|recruiters?|cpdd|career\b/.test(normalizedQuery)) {
    score += document.category === "placements" ? 35 : 0;
  }

  if (/\bscholarships?|freeships?\b/.test(normalizedQuery)) {
    score += document.category === "scholarships" ? 35 : 0;
  }

  if (/\bcontact|phone|email|address\b/.test(normalizedQuery)) {
    score += document.category === "contact" ? 35 : 0;
  }

  if (
    /\badmission\b/.test(normalizedQuery) &&
    /\bdocuments?|checklist|required\b/.test(normalizedQuery) &&
    /admission documents|document checklist/.test(document.allText)
  ) {
    score += 90;
  }

  if (
    /\badmission\b/.test(normalizedQuery) &&
    /\bdocuments?|checklist|required\b/.test(normalizedQuery) &&
    /document checklist\s+-\s+10th mark sheet/.test(document.allText)
  ) {
    score += 150;
  }

  return score;
}

function inverseDocumentFrequency(
  token: string,
  totalDocuments: number,
  documentFrequency: Map<string, number>,
): number {
  const frequency = documentFrequency.get(token) ?? 0;
  return Math.log((totalDocuments + 1) / (frequency + 1)) + 1;
}

function calculateConfidence(score: number, topScore: number): number {
  if (score <= 0 || topScore <= 0) {
    return 0;
  }

  const absoluteConfidence = score / (score + 18);
  const relativeConfidence = score / topScore;
  return Number(
    Math.min(0.99, absoluteConfidence * 0.75 + relativeConfidence * 0.25).toFixed(
      4,
    ),
  );
}

function buildSnippet(content: string, queryTokens: string[]): string {
  const normalizedContent = normalizeText(content);
  const firstMatch = queryTokens
    .map((token) => normalizedContent.indexOf(token))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0];

  const start =
    firstMatch === undefined
      ? 0
      : Math.max(0, firstMatch - Math.floor(MAX_SNIPPET_LENGTH / 3));
  const snippet = content.slice(start, start + MAX_SNIPPET_LENGTH).trim();
  const prefix = start > 0 ? "... " : "";
  const suffix =
    start + MAX_SNIPPET_LENGTH < content.length ? " ..." : "";

  return `${prefix}${snippet}${suffix}`;
}

function countTokens(value: string): Map<string, number> {
  const counts = new Map<string, number>();

  for (const token of tokenize(value)) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }

  return counts;
}

function tokenize(value: string): string[] {
  return normalizeText(value)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/&/g, " and ");
}

function clampLimit(limit: number): number {
  if (!Number.isFinite(limit)) {
    return DEFAULT_LIMIT;
  }

  return Math.min(MAX_LIMIT, Math.max(1, Math.floor(limit)));
}
