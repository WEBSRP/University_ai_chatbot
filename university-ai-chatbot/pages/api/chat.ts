import type { NextApiRequest, NextApiResponse } from "next";
import {
  searchKnowledgeDocuments,
  type SearchDocumentResult,
} from "@/lib/search";
import {
  formatKnowledgeAnswer,
  formatAggregatedCourseInfo,
  formatHostelAnswer,
  formatAdmissionsResponse,
  formatGeneralFeeStructureResponse,
  formatScholarshipInfoResponse,
  formatPaymentMethodsResponse,
  formatPlacementStatsResponse,
} from "@/lib/responseFormatter";
import {
  formatCatalogSection,
  getCatalogSection,
  getTopicForMessage,
} from "@/lib/catalog";
import { generateWithFallback, classifyIntent } from "@/lib/gemini";
import type { SourceLink } from "@/lib/sources";
import { getCourseDetail, type CourseField, type CourseLevel } from "@/lib/courseDetails";

const MAX_CONTEXT_CONTENT_LENGTH = 1500;
const DIRECT_ANSWER_CONFIDENCE_THRESHOLD = 0.62;
const FACTUAL_ANSWER_CONFIDENCE_THRESHOLD = 0.35;
const INTENT_ROUTER_THRESHOLD = 0.8;
const MISSING_INFORMATION_MESSAGE =
  "I could not find this information in the official college records.";

type ChatResponse =
  | {
      answer: string;
      sources: SourceLink[];
    }
  | {
      error: string;
    };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ChatResponse>,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const message = getMessage(req.body);
  const categoryFilter = getCategory(req.body);

  if (!message) {
    return res.status(400).json({ error: "Missing required field message" });
  }

  // AI Intent Router
  const aiIntent = await classifyIntent(message);
  console.log(`[AI Intent Router] Intent: ${aiIntent.intent}, Confidence: ${aiIntent.confidence}`);

  if (aiIntent.confidence >= INTENT_ROUTER_THRESHOLD) {
    console.log(`[Chat] Routing via AI Intent: ${aiIntent.intent}`);
    
    // Admissions
    if (aiIntent.intent.startsWith("Admissions/")) {
      const subIntent = aiIntent.intent.split("/")[1];
      const answer = formatAdmissionsResponse(subIntent.toLowerCase());
      if (answer) {
        return res.status(200).json({ answer, sources: [] });
      }
    }

    // Fees
    if (aiIntent.intent === "Fees/Fee Structure") {
      return res.status(200).json({ answer: formatGeneralFeeStructureResponse(), sources: [] });
    }
    if (aiIntent.intent === "Fees/Scholarship Information") {
      return res.status(200).json({ answer: formatScholarshipInfoResponse(), sources: [] });
    }
    if (aiIntent.intent === "Fees/Payment Methods") {
      return res.status(200).json({ answer: formatPaymentMethodsResponse(), sources: [] });
    }

    // Hostel
    if (aiIntent.intent === "Hostel/Hostel Facilities") {
      return res.status(200).json({ answer: formatHostelAnswer("facilities", "facilities"), sources: [] });
    }
    if (aiIntent.intent === "Hostel/Hostel Fees") {
      return res.status(200).json({ answer: formatHostelAnswer("fees", ""), sources: [] });
    }
    if (aiIntent.intent === "Hostel/Rules & Regulations") {
      return res.status(200).json({ answer: formatHostelAnswer("rules", ""), sources: [] });
    }

    // Placements
    if (aiIntent.intent === "Placements/Latest Placement Statistics") {
      return res.status(200).json({ answer: formatPlacementStatsResponse(), sources: [] });
    }

    // Contact
    if (aiIntent.intent === "Contact/Contact Information") {
      return res.status(200).json({
        answer: "### Contact Information\n\n**Admission Office**\nPhone: +91-120-4370000\nEmail: admissions@galgotiasuniversity.edu.in\n\n**Address**\nPlot No. 2, Sector 17-A, Yamuna Expressway, Greater Noida, Gautam Buddh Nagar, Uttar Pradesh, India.",
        sources: []
      });
    }

    // Courses
    if (aiIntent.intent.startsWith("Courses/")) {
      const match = aiIntent.intent.match(/Courses\/(.+) (Eligibility|Fee Structure|Specializations)/);
      if (match) {
        const course = match[1].trim();
        const fieldMap: Record<string, CourseField> = {
          "Eligibility": "eligibility",
          "Fee Structure": "fee",
          "Specializations": "overview" // Specializations often in overview or use existing search
        };
        const field = fieldMap[match[2]];
        const level: CourseLevel = course.toLowerCase().startsWith("m") ? "pg" : "ug"; // Simple heuristic
        
        const detail = await getCourseDetail(level, course, field);
        return res.status(200).json(detail);
      }
    }
  }

  const intent = classifyIntentOld(message);
  console.log(`[Chat] Incoming: "${message}", Intent: ${JSON.stringify(intent)}, Category: ${categoryFilter || "None"}`);

  if (intent.isGeneralFeeStructure) {
    console.log("[Chat] Returning fixed Fee Structure response.");
    return res.status(200).json({
      answer: formatGeneralFeeStructureResponse(),
      sources: [],
    });
  }

  if (intent.isScholarshipInfo) {
    console.log("[Chat] Returning fixed Scholarship Information response.");
    return res.status(200).json({
      answer: formatScholarshipInfoResponse(),
      sources: [],
    });
  }

  if (intent.isPaymentMethods) {
    console.log("[Chat] Returning fixed Payment Methods response.");
    return res.status(200).json({
      answer: formatPaymentMethodsResponse(),
      sources: [],
    });
  }

  if (intent.isPlacementStats) {
    console.log("[Chat] Returning fixed Placement Statistics response.");
    return res.status(200).json({
      answer: formatPlacementStatsResponse(),
      sources: [],
    });
  }

  const catalogTopic = getTopicForMessage(message);

  if (catalogTopic) {
    const section = await getCatalogSection(catalogTopic);

    if (section) {
      console.log(`[Chat] Routing to Catalog: ${catalogTopic}`);
      return res.status(200).json({
        answer: formatCatalogSection(section),
        sources: section.entries
          .filter((entry) => Boolean(entry.url))
          .map((entry) => ({
            title: cleanSourceTitle(entry.title),
            url: entry.url,
          })),
      });
    }
  }
  const searchResults = await searchKnowledgeDocuments(message, 10, categoryFilter);
  const sources = uniqueSources(searchResults);
  const sourceUrls = sources.map((source) => source.url);
  const topResult = searchResults[0];

  let structuredAnswer: string | null = null;

  if (categoryFilter === "admissions") {
    structuredAnswer = formatAdmissionsResponse(message);
  }

  if (!structuredAnswer && categoryFilter === "hostel" && topResult) {
    structuredAnswer = formatHostelAnswer(message, topResult.content);
  } else if (!structuredAnswer && intent.isFeeStructure) {
    structuredAnswer = formatAggregatedCourseInfo(searchResults, "fee");
  } else if (!structuredAnswer && intent.isSpecialization) {
    structuredAnswer = formatAggregatedCourseInfo(searchResults, "specialization");
  } else if (!structuredAnswer && topResult) {
    structuredAnswer = formatKnowledgeAnswer(topResult, message);
  }

  const hasRelevantSearchResult = isRelevantSearchResult(topResult, intent);


  if (structuredAnswer && hasRelevantSearchResult) {
    console.log(`[Chat] Returning structured knowledge answer from ${topResult.id}`);
    return res.status(200).json({
      answer: formatAnswer(structuredAnswer, [topResult.url]),
      sources: [
        {
          title: cleanSourceTitle(topResult.title),
          url: topResult.url,
        },
      ],
    });
  }

  if (hasRelevantSearchResult) {
    console.log(`[Chat] Returning fallback knowledge answer from ${topResult.id} (Confidence: ${topResult.confidence})`);
    return res.status(200).json({
      answer: buildSourceFallbackAnswer(message, topResult),
      sources,
    });
  }

  const context = buildContext(searchResults);
  const prompt = buildUserPrompt(message, context);

  try {
    console.log("[Chat] Forwarding to Gemini for synthesis.");
    const answer = formatAnswer(await generateWithFallback(prompt), sourceUrls);

    return res.status(200).json({
      answer,
      sources,
    });
  } catch (error) {
    console.warn(
      `[Chat] Gemini failed; falling back to knowledge base. Reason: ${getErrorMessage(
        error,
      )}`,
    );

    return res.status(200).json({
      answer: buildSourceFallbackAnswer(message, topResult),
      sources,
    });
  }
}

function getMessage(body: unknown): string {
  if (!body || typeof body !== "object" || !("message" in body)) {
    return "";
  }

  const { message } = body as { message?: unknown };
  return typeof message === "string" ? message.trim() : "";
}

function getCategory(body: unknown): string {
  if (!body || typeof body !== "object" || !("category" in body)) {
    return "";
  }

  const { category } = body as { category?: unknown };
  return typeof category === "string" ? category.trim().toLowerCase() : "";
}

function classifyIntentOld(message: string) {
  const normalizedMessage = message.toLowerCase();

  return {
    isFactual: /\b(fees?|fee structure|eligibility|eligible|duration|hostel|scholarships?|admission dates?|deadline|last date|dates?)\b/.test(
      normalizedMessage,
    ),
    needsGemini: /\b(compare|comparison|which is better|recommend|recommendation|suggest|explain|explanation|summari[sz]e|summary|overview|difference|differences|pros and cons|best)\b/.test(
      normalizedMessage,
    ),
    isFeeStructure: /\bfee structure|tuition fees?|how much (is|are) the fees?\b/i.test(
      normalizedMessage,
    ),
    isSpecialization: /\bspecializations?|branches?|majors?|programs? list|list (of )?programs?\b/i.test(
      normalizedMessage,
    ),
    isHostelFee: /\bhostel fees?\b/i.test(normalizedMessage),
    isHostelRules: /\bhostel rules|hostel regulations\b/i.test(normalizedMessage),
    isHostelFacilities: /\bhostel facilities\b/i.test(normalizedMessage),
    isAdmissionEligibility: /\beligibility\b/i.test(normalizedMessage) && normalizedMessage.includes("admission"),
    isAdmissionProcess: /\bapply|application|admission process\b/i.test(normalizedMessage),
    isAdmissionDocuments: /\bdocuments?\b/i.test(normalizedMessage) && normalizedMessage.includes("admission"),
    isGeneralFeeStructure:
      normalizedMessage === "what is the fee structure?" ||
      normalizedMessage === "fee structure",
    isScholarshipInfo:
      normalizedMessage === "scholarship information" ||
      (normalizedMessage.includes("scholarship") && normalizedMessage.includes("info")),
    isPaymentMethods:
      normalizedMessage === "payment methods" ||
      (normalizedMessage.includes("payment") && normalizedMessage.includes("method")),
    isPlacementStats:
      normalizedMessage === "latest placement statistics" ||
      (normalizedMessage.includes("placement") && normalizedMessage.includes("stat")),
  };
}

function isRelevantSearchResult(
  result: SearchDocumentResult | undefined,
  intent: ReturnType<typeof classifyIntentOld>,
): result is SearchDocumentResult {
  if (!result) {
    return false;
  }

  if (intent.isFactual) {
    return result.confidence >= FACTUAL_ANSWER_CONFIDENCE_THRESHOLD;
  }

  return result.confidence >= DIRECT_ANSWER_CONFIDENCE_THRESHOLD;
}

function buildContext(results: SearchDocumentResult[]): string {
  if (results.length === 0) {
    return "No matching official records were found.";
  }

  return results
    .map(
      (result, index) => `Source ${index + 1}
Title: ${result.title}
Category: ${result.category}
Confidence: ${result.confidence.toFixed(2)}
Content: ${truncateContent(result.content)}
URL: ${result.url}`,
    )
    .join("\n\n");
}

function buildUserPrompt(message: string, context: string): string {
  return `Official college records:
${context}

User question:
${message}`;
}

function uniqueSources(results: SearchDocumentResult[]): SourceLink[] {
  const seen = new Set<string>();
  const sources: SourceLink[] = [];

  for (const result of results) {
    if (!result.url || seen.has(result.url)) {
      continue;
    }

    seen.add(result.url);
    sources.push({
      title: cleanSourceTitle(result.title),
      url: result.url,
    });
  }

  return sources;
}

function buildSourceFallbackAnswer(
  message: string,
  result: SearchDocumentResult | undefined,
): string {
  if (!result) {
    console.log("[Chat] Fallback-to-knowledge-base event: no source available.");
    return MISSING_INFORMATION_MESSAGE;
  }

  console.log(
    `[Chat] Fallback-to-knowledge-base event: using ${result.id} (${result.confidence.toFixed(
      2,
    )}).`,
  );

  if (result.category === "hostel") {
    return formatHostelAnswer(message, result.content);
  }

  return `${cleanSourceTitle(result.title)}:\n${summarizeContent(result.content || result.snippet)}`;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function truncateContent(content: string): string {
  return content.slice(0, MAX_CONTEXT_CONTENT_LENGTH).trim();
}

function formatAnswer(answer: string, sources: string[]): string {
  const normalizedAnswer =
    answer
      .replace(/\\n/g, "\n")
      .replace(/\r\n/g, "\n")
      .replace(/[ \t]+\n/g, "\n")
      .trim() || MISSING_INFORMATION_MESSAGE;

  return removeInlineSources(normalizedAnswer, sources).trim();
}

function removeInlineSources(answer: string, sources: string[]): string {
  return sources
    .reduce((currentAnswer, source) => currentAnswer.replaceAll(source, ""), answer)
    .replace(/(?:^|\n)\s*(?:sources?|source urls?)\s*:?\s*(?:\n\s*)?$/i, "")
    .replace(/\n{3,}/g, "\n\n");
}

function cleanSourceTitle(title: string): string {
  return title.replace(/\s*\|\s*Galgotias University\s*$/i, "").trim();
}

function summarizeContent(content: string): string {
  return content
    .replace(/\s+/g, " ")
    .split(/\.\s+/)
    .filter((sentence) => sentence.length > 20)
    .slice(0, 2)
    .map((sentence) => sentence.trim())
    .join(". ");
}
