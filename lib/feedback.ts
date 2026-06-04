import { promises as fs } from "fs";
import path from "path";

export type FeedbackRecord = {
  question: string;
  feedback: "positive" | "negative";
  timestamp: string;
};

export type CallbackRecord = {
  name: string;
  phone: string;
  question: string;
  timestamp: string;
};

const DATA_DIR = path.join(process.cwd(), "data");
const FEEDBACK_FILE = path.join(DATA_DIR, "feedback.json");
const CALLBACKS_FILE = path.join(DATA_DIR, "callbacks.json");

export async function saveFeedback(
  record: Omit<FeedbackRecord, "timestamp">,
): Promise<FeedbackRecord> {
  const savedRecord = {
    ...record,
    timestamp: new Date().toISOString(),
  };

  await appendJsonRecord(FEEDBACK_FILE, savedRecord);
  return savedRecord;
}

export async function saveCallback(
  record: Omit<CallbackRecord, "timestamp">,
): Promise<CallbackRecord> {
  const savedRecord = {
    ...record,
    timestamp: new Date().toISOString(),
  };

  await appendJsonRecord(CALLBACKS_FILE, savedRecord);
  return savedRecord;
}

async function appendJsonRecord<T>(filePath: string, record: T): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });

  const records = await readJsonArray<T>(filePath);
  records.push(record);

  await fs.writeFile(filePath, JSON.stringify(records, null, 2), "utf8");
}

async function readJsonArray<T>(filePath: string): Promise<T[]> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch (error) {
    if (isNotFoundError(error)) {
      return [];
    }

    throw error;
  }
}

function isNotFoundError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "ENOENT"
  );
}
