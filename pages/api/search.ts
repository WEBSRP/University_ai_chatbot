import type { NextApiRequest, NextApiResponse } from "next";
import { getKnowledgeDocumentCount, searchKnowledge } from "@/lib/search";

type SearchResponse =
  | {
      query: string;
      count: number;
      totalDocuments: number;
      results: Awaited<ReturnType<typeof searchKnowledge>>;
    }
  | {
      error: string;
    };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SearchResponse>,
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const query = getStringParam(req.query.q).trim();

  if (!query) {
    return res.status(400).json({ error: "Missing required query parameter q" });
  }

  const limit = Number(getStringParam(req.query.limit) || "10");
  const [results, totalDocuments] = await Promise.all([
    searchKnowledge(query, limit),
    getKnowledgeDocumentCount(),
  ]);

  return res.status(200).json({
    query,
    count: results.length,
    totalDocuments,
    results,
  });
}

function getStringParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}
