const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
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
    status?: string;
  };
};

type SelectedApiKey = {
  key: string;
  index: number;
};

let roundRobinIndex = 0;

export function getNextApiKey(): SelectedApiKey | null {
  const keys = getConfiguredApiKeys();

  if (keys.length === 0) {
    console.warn("[Gemini] No Gemini API keys are configured.");
    return null;
  }

  const selectedIndex = roundRobinIndex % keys.length;
  roundRobinIndex = (roundRobinIndex + 1) % keys.length;

  console.log(
    `[Gemini] Selected key index ${selectedIndex + 1}/${keys.length}: ${maskApiKey(
      keys[selectedIndex],
    )}`,
  );

  return {
    key: keys[selectedIndex],
    index: selectedIndex,
  };
}

export async function generateWithFallback(prompt: string): Promise<string> {
  const keys = getConfiguredApiKeys();

  if (keys.length === 0) {
    throw new Error("No Gemini API keys are configured.");
  }

  const firstSelection = getNextApiKey();

  if (!firstSelection) {
    throw new Error("No Gemini API keys are configured.");
  }

  const attempts = buildAttemptOrder(keys, firstSelection.index);
  const failures: string[] = [];

  for (const selected of attempts) {
    console.log(
      `[Gemini] Attempting key index ${selected.index + 1}/${keys.length}: ${maskApiKey(
        selected.key,
      )}`,
    );

    try {
      const answer = await generateWithKey(prompt, selected);
      console.log(`[Gemini] Success with key index ${selected.index + 1}.`);
      return answer;
    } catch (error) {
      const reason = getErrorMessage(error);
      failures.push(`key ${selected.index + 1}: ${reason}`);
      console.warn(
        `[Gemini] Failure with key index ${selected.index + 1}: ${reason}`,
      );

      if (attempts.indexOf(selected) < attempts.length - 1) {
        console.warn("[Gemini] Failing over to next configured key.");
      }
    }
  }

  throw new Error(`All Gemini API keys failed. ${failures.join(" | ")}`);
}

export async function classifyIntent(message: string): Promise<{ intent: string; confidence: number }> {
  const keys = getConfiguredApiKeys();
  if (keys.length === 0) return { intent: "unknown", confidence: 0 };

  const prompt = `Classify the following user query into one of the chatbot actions.
Return ONLY a JSON object with "intent" and "confidence" fields.

Available Intents:
- Admissions/Eligibility
- Admissions/Application Process
- Admissions/Required Documents
- Admissions/Important Dates
- Admissions/Contact Admissions
- Courses/[Course Name] Eligibility
- Courses/[Course Name] Fee Structure
- Courses/[Course Name] Specializations
- Fees/Fee Structure
- Fees/Scholarship Information
- Fees/Payment Methods
- Hostel/Hostel Facilities
- Hostel/Hostel Fees
- Hostel/Rules & Regulations
- Placements/Latest Placement Statistics
- Contact/Contact Information

Examples:
"how do i apply?" -> {"intent": "Admissions/Application Process", "confidence": 0.98}
"hostel cost" -> {"intent": "Hostel/Hostel Fees", "confidence": 0.95}
"mba fees" -> {"intent": "Courses/MBA Fee Structure", "confidence": 0.99}
"btech specializations" -> {"intent": "Courses/BTech Specializations", "confidence": 0.99}
"where is the campus?" -> {"intent": "Contact/Contact Information", "confidence": 0.92}

User Query: "${message}"`;

  try {
    const response = await generateWithFallback(prompt);
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { intent: "unknown", confidence: 0 };
    
    const result = JSON.parse(jsonMatch[0]);
    return {
      intent: result.intent || "unknown",
      confidence: result.confidence || 0
    };
  } catch (error) {
    console.error("[Gemini Intent Router] Error:", error);
    return { intent: "unknown", confidence: 0 };
  }
}

function getConfiguredApiKeys(): string[] {
  return [
    process.env.GEMINI_API_KEY_1,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
  ]
    .map((key) => key?.trim())
    .filter((key): key is string => Boolean(key));
}

function buildAttemptOrder(
  keys: string[],
  startingIndex: number,
): SelectedApiKey[] {
  return keys.map((_, offset) => {
    const index = (startingIndex + offset) % keys.length;
    return {
      key: keys[index],
      index,
    };
  });
}

async function generateWithKey(
  prompt: string,
  selected: SelectedApiKey,
): Promise<string> {
  const response = await fetch(GEMINI_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": selected.key,
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

  const data = (await response.json()) as GeminiResponse;

  if (!response.ok) {
    throw new Error(
      `${response.status} ${response.statusText}: ${
        data.error?.message ?? data.error?.status ?? "Gemini API request failed"
      }`,
    );
  }

  const answer = extractAnswer(data);

  if (!answer) {
    throw new Error("Gemini returned an empty answer.");
  }

  return answer;
}

function extractAnswer(data: GeminiResponse): string {
  return (
    data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("")
      .trim() ?? ""
  );
}

function maskApiKey(key: string): string {
  if (key.length <= 8) {
    return `${key.slice(0, 2)}***`;
  }

  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
