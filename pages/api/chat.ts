import type { NextApiRequest, NextApiResponse } from "next";
import {
  searchKnowledgeDocuments,
  type SearchDocumentResult,
} from "@/lib/search";
import { formatKnowledgeAnswer } from "@/lib/responseFormatter";

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const MAX_CONTEXT_CONTENT_LENGTH = 1500;
const DIRECT_ANSWER_CONFIDENCE_THRESHOLD = 0.62;
const FACTUAL_ANSWER_CONFIDENCE_THRESHOLD = 0.35;
const MISSING_INFORMATION_MESSAGE =
  "I could not find this information in the official college records.";

const SYSTEM_PROMPT = `You are the official Galgotias University Admission Assistant.

Rules:
- Answer only from provided context.
- Never invent information.
- If information is missing, say:
  "${MISSING_INFORMATION_MESSAGE}"
- Be concise and professional.
- Do not include source URLs in the answer text. Sources are returned separately.`;

type ChatResponse =
  | {
      answer: string;
      sources: string[];
    }
  | {
      error: string;
    };

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  error?: {
    message?: string;
  };
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

  if (!message) {
    return res.status(400).json({ error: "Missing required field message" });
  }

  const searchResults = await searchKnowledgeDocuments(message, 5);
  const sources = uniqueSources(searchResults);
  const topResult = searchResults[0];
  const intent = classifyIntent(message);
  const structuredAnswer = topResult
    ? formatKnowledgeAnswer(topResult, message)
    : null;

  if (structuredAnswer && shouldAnswerFromKnowledge(topResult, intent)) {
    return res.status(200).json({
      answer: formatAnswer(structuredAnswer, [topResult.url]),
      sources: [topResult.url],
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: "GEMINI_API_KEY is not configured" });
  }

  const context = buildContext(searchResults);
  const prompt = buildUserPrompt(message, context);

  const geminiResponse = await fetch(GEMINI_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: SYSTEM_PROMPT }],
      },
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        topP: 0.8,
        maxOutputTokens: 512,
      },
    }),
  });

  const data = (await geminiResponse.json()) as GeminiResponse;

  if (!geminiResponse.ok) {
    return res.status(502).json({
      error: data.error?.message ?? "Gemini API request failed",
    });
  }

  const answer = formatAnswer(extractAnswer(data), sources);

  return res.status(200).json({
    answer,
    sources,
  });
}

function getMessage(body: unknown): string {
  if (!body || typeof body !== "object" || !("message" in body)) {
    return "";
  }

  const { message } = body as { message?: unknown };
  return typeof message === "string" ? message.trim() : "";
}

function classifyIntent(message: string) {
  const normalizedMessage = message.toLowerCase();

  return {
    isFactual: /\b(fees?|fee structure|eligibility|eligible|duration|hostel|scholarships?|admission dates?|deadline|last date|dates?)\b/.test(
      normalizedMessage,
    ),
    needsGemini: /\b(compare|comparison|which is better|recommend|recommendation|suggest|explain|explanation|summari[sz]e|summary|overview|difference|differences|pros and cons|best)\b/.test(
      normalizedMessage,
    ),
  };
}

function shouldAnswerFromKnowledge(
  result: SearchDocumentResult | undefined,
  intent: ReturnType<typeof classifyIntent>,
): result is SearchDocumentResult {
  if (!result || intent.needsGemini) {
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

function extractAnswer(data: GeminiResponse): string {
  return (
    data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("")
      .trim() ?? ""
  );
}

function uniqueSources(results: SearchDocumentResult[]): string[] {
  return Array.from(new Set(results.map((result) => result.url).filter(Boolean)));
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
