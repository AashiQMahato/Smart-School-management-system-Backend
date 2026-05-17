/**
 * AI Service — Groq API integration
 * Proxies all AI analytics requests through backend
 */

import Groq from "groq-sdk";

let groqClient;

function getGroqClient() {
  if (groqClient) return groqClient;

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GROQ_API_KEY is missing. Set it in Backend/.env or as an environment variable.",
    );
  }

  groqClient = new Groq({ apiKey });
  return groqClient;
}

const MODEL = "qwen/qwen3-32b";

function cleanModelText(text) {
  const raw = String(text || "");
  return raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

/**
 * Send a prompt to Groq and return parsed JSON insights.
 * Falls back to raw text if JSON parsing fails.
 */
async function askGroq(systemPrompt, userPrompt, temperature = 0.7) {
  const groq = getGroqClient();
  const response = await groq.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature,
    max_tokens: 4096,
  });

  const raw = response.choices?.[0]?.message?.content || "";

  // Strip <think>...</think> blocks the model sometimes wraps reasoning in
  const cleaned = cleanModelText(raw);

  // Try to extract JSON from the response
  try {
    const jsonMatch =
      cleaned.match(/```json\s*([\s\S]*?)\s*```/) ||
      cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const jsonStr = jsonMatch[1] || jsonMatch[0];
      return JSON.parse(jsonStr);
    }
    return JSON.parse(cleaned);
  } catch {
    // Return structured fallback with text
    return { rawText: cleaned };
  }
}

/**
 * Chat assistant (text) — accepts a system prompt + message history
 * messages: [{role: 'user'|'assistant', content: string}, ...]
 */
export async function chatAssistant({
  systemPrompt,
  messages,
  temperature = 0.4,
  maxTokens = 1200,
}) {
  const groq = getGroqClient();

  const safeMessages = Array.isArray(messages) ? messages : [];
  const response = await groq.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      ...safeMessages.map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: String(m.content || "").slice(0, 4000),
      })),
    ],
    temperature,
    max_tokens: maxTokens,
  });

  return cleanModelText(response.choices?.[0]?.message?.content || "");
}

// ───────────────────────────────────────────────────────────────
// ADMIN analytics
// ───────────────────────────────────────────────────────────────
export async function getAdminInsights(data) {
  const systemPrompt = `You are an expert school data analyst AI. Analyze the provided school-wide academic data and return a JSON object with these exact keys:
{
  "summary": "A 2-3 sentence executive summary of overall school health",
  "performanceTrends": [{ "label": "string", "value": number, "trend": "up|down|stable" }],
  "attendancePrediction": { "nextMonthAvg": number, "risk": "low|medium|high", "explanation": "string" },
  "feeCollectionForecast": { "expectedCollection": number, "collectionRate": number, "insight": "string" },
  "dropoutRisks": [{ "category": "string", "count": number, "severity": "low|medium|high", "suggestion": "string" }],
  "classComparison": [{ "className": "string", "avgScore": number, "avgAttendance": number, "rank": number }],
  "weakSubjects": [{ "subject": "string", "avgScore": number, "failRate": number, "suggestion": "string" }],
  "alerts": [{ "type": "warning|danger|info", "title": "string", "message": "string" }],
  "recommendations": ["string"]
}
Return ONLY valid JSON, no markdown or explanation.`;

  const userPrompt = `Here is the school data:\n${JSON.stringify(data, null, 2)}`;
  return askGroq(systemPrompt, userPrompt, 0.6);
}

// ───────────────────────────────────────────────────────────────
// TEACHER analytics
// ───────────────────────────────────────────────────────────────
export async function getTeacherInsights(data) {
  const systemPrompt = `You are an expert education analytics AI assisting a teacher. Analyze the given class data and return a JSON object with these exact keys:
{
  "summary": "A 2-3 sentence summary of class performance",
  "classPerformance": { "average": number, "highest": number, "lowest": number, "passRate": number, "trend": "improving|declining|stable" },
  "weakStudents": [{ "name": "string", "avgScore": number, "attendance": number, "risk": "low|medium|high", "suggestion": "string" }],
  "attendanceIrregularities": [{ "name": "string", "absences": number, "pattern": "string", "recommendation": "string" }],
  "subjectDifficulty": [{ "subject": "string", "avgScore": number, "failCount": number, "difficulty": "easy|moderate|hard" }],
  "interventionTips": ["string"],
  "alerts": [{ "type": "warning|danger|info", "title": "string", "message": "string" }]
}
Return ONLY valid JSON, no markdown or explanation.`;

  const userPrompt = `Here is the teacher's class data:\n${JSON.stringify(data, null, 2)}`;
  return askGroq(systemPrompt, userPrompt, 0.6);
}

// ───────────────────────────────────────────────────────────────
// STUDENT analytics
// ───────────────────────────────────────────────────────────────
export async function getStudentInsights(data) {
  const systemPrompt = `You are an AI academic advisor for a student. Analyze the student's performance data and return a JSON object with these exact keys:
{
  "summary": "A 2-3 sentence personalized academic summary",
  "performanceAnalysis": { "overallAvg": number, "bestSubject": "string", "weakestSubject": "string", "trend": "improving|declining|stable" },
  "weakSubjects": [{ "subject": "string", "score": number, "suggestion": "string" }],
  "examReadiness": { "score": number, "level": "low|medium|high", "tips": ["string"] },
  "attendanceImpact": { "attendanceRate": number, "correlationInsight": "string", "recommendation": "string" },
  "studySuggestions": ["string"],
  "strengths": ["string"],
  "improvementScore": { "current": number, "potential": number, "gap": number }
}
Return ONLY valid JSON, no markdown or explanation.`;

  const userPrompt = `Here is the student's academic data:\n${JSON.stringify(data, null, 2)}`;
  return askGroq(systemPrompt, userPrompt, 0.6);
}

// ───────────────────────────────────────────────────────────────
// PARENT analytics
// ───────────────────────────────────────────────────────────────
export async function getParentInsights(data) {
  const systemPrompt = `You are an AI education advisor communicating with a parent about their child's academic progress. Analyze the data and return a JSON object with these exact keys:
{
  "summary": "A 2-3 sentence friendly summary for the parent",
  "progressSummary": { "overallGrade": "string", "trend": "improving|declining|stable", "classRank": "string", "highlights": ["string"] },
  "improvementAreas": [{ "subject": "string", "currentScore": number, "classAvg": number, "suggestion": "string" }],
  "attendanceImpact": { "rate": number, "impact": "positive|negative|neutral", "explanation": "string" },
  "behavioralPatterns": [{ "pattern": "string", "observation": "string", "recommendation": "string" }],
  "parentActions": ["string"],
  "alerts": [{ "type": "warning|danger|info", "title": "string", "message": "string" }],
  "encouragement": "string"
}
Return ONLY valid JSON, no markdown or explanation.`;

  const userPrompt = `Here is the child's academic data:\n${JSON.stringify(data, null, 2)}`;
  return askGroq(systemPrompt, userPrompt, 0.6);
}

export default {
  getAdminInsights,
  getTeacherInsights,
  getStudentInsights,
  getParentInsights,
  chatAssistant,
};
