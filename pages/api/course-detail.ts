import type { NextApiRequest, NextApiResponse } from "next";
import {
  getCourseDetail,
  type CourseField,
  type CourseLevel,
} from "@/lib/courseDetails";
import type { SourceLink } from "@/lib/sources";

type CourseDetailApiResponse =
  | {
      answer: string;
      sources: SourceLink[];
    }
  | {
      error: string;
    };

const COURSE_FIELDS = new Set<CourseField>([
  "overview",
  "eligibility",
  "fee",
  "duration",
  "admission",
  "placements",
]);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CourseDetailApiResponse>,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const level = getStringField(req.body, "level");
  const course = getStringField(req.body, "course");
  const field = getStringField(req.body, "field");

  if (level !== "ug" && level !== "pg") {
    return res.status(400).json({ error: "Invalid course level" });
  }

  if (!course) {
    return res.status(400).json({ error: "Missing required field course" });
  }

  if (!COURSE_FIELDS.has(field as CourseField)) {
    return res.status(400).json({ error: "Invalid course field" });
  }

  const detail = await getCourseDetail(
    level as CourseLevel,
    course,
    field as CourseField,
  );

  return res.status(200).json(detail);
}

function getStringField(body: unknown, field: string): string {
  if (!body || typeof body !== "object" || !(field in body)) {
    return "";
  }

  const value = (body as Record<string, unknown>)[field];
  return typeof value === "string" ? value.trim() : "";
}
