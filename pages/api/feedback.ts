import type { NextApiRequest, NextApiResponse } from "next";
import { saveFeedback } from "@/lib/feedback";

type FeedbackResponse =
  | {
      ok: true;
    }
  | {
      error: string;
    };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<FeedbackResponse>,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const question = getStringField(req.body, "question");
  const feedback = getStringField(req.body, "feedback");

  if (!question) {
    return res.status(400).json({ error: "Missing required field question" });
  }

  if (feedback !== "positive" && feedback !== "negative") {
    return res.status(400).json({ error: "Invalid feedback value" });
  }

  try {
    await saveFeedback({ question, feedback });
    return res.status(200).json({ ok: true });
  } catch {
    return res.status(500).json({ error: "Could not save feedback" });
  }
}

function getStringField(body: unknown, field: string): string {
  if (!body || typeof body !== "object" || !(field in body)) {
    return "";
  }

  const value = (body as Record<string, unknown>)[field];
  return typeof value === "string" ? value.trim() : "";
}
