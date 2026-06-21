import type { NextApiRequest, NextApiResponse } from "next";
import { saveCallback } from "@/lib/feedback";

type CallbackResponse =
  | {
      ok: true;
    }
  | {
      error: string;
    };

const INDIAN_MOBILE_PATTERN = /^(?:\+91[\s-]?|91[\s-]?)?[6-9]\d{9}$/;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CallbackResponse>,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const name = getStringField(req.body, "name");
  const phone = normalizePhone(getStringField(req.body, "phone"));
  const question = getStringField(req.body, "question");

  if (!name) {
    return res.status(400).json({ error: "Missing required field name" });
  }

  if (!question) {
    return res.status(400).json({ error: "Missing required field question" });
  }

  if (!INDIAN_MOBILE_PATTERN.test(phone)) {
    return res.status(400).json({ error: "Invalid Indian mobile number" });
  }

  try {
    await saveCallback({ name, phone, question });
    return res.status(200).json({ ok: true });
  } catch {
    return res.status(500).json({ error: "Could not save callback request" });
  }
}

function getStringField(body: unknown, field: string): string {
  if (!body || typeof body !== "object" || !(field in body)) {
    return "";
  }

  const value = (body as Record<string, unknown>)[field];
  return typeof value === "string" ? value.trim() : "";
}

function normalizePhone(phone: string): string {
  return phone.replace(/[\s-]/g, "");
}
