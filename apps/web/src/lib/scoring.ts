/* ──────────────────────────────────────────────
 *  Quality scoring module
 *
 *  Implements: exact, numeric_tolerance, json_schema,
 *              regex, judge, embedding+judge
 * ────────────────────────────────────────────── */

import type { WorkloadItem, ScoringDetails } from "../types";

// ── Objective scorers ──────────────────────────

function scoreExact(output: string, expected: Record<string, unknown>): number {
  const val = String(expected.value ?? "").trim();
  return output.trim() === val ? 1 : 0;
}

function scoreNumericTolerance(
  output: string,
  expected: Record<string, unknown>,
  tolerance: number = 0
): number {
  const nums = output.match(/-?\d+\.?\d*/g);
  if (!nums) return 0;
  const target = Number(expected.value);
  // Check if any number in the output matches
  for (const n of nums) {
    if (Math.abs(Number(n) - target) <= tolerance) return 1;
  }
  return 0;
}

function scoreJsonSchema(output: string, expected: Record<string, unknown>): number {
  try {
    // Extract JSON from output (strip markdown fences if present)
    const jsonMatch = output.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, output];
    const text = jsonMatch[1] || output;
    const brace = text.indexOf("{");
    const bracket = text.indexOf("[");
    let start = -1;
    if (brace >= 0 && bracket >= 0) start = Math.min(brace, bracket);
    else if (brace >= 0) start = brace;
    else if (bracket >= 0) start = bracket;
    if (start < 0) return 0;

    const parsed = JSON.parse(text.slice(start));
    return deepEqual(parsed, expected) ? 1 : 0;
  } catch {
    return 0;
  }
}

function scoreRegex(output: string, expected: Record<string, unknown>): number {
  const trimmed = output.trim();
  const patterns: string[] = Array.isArray(expected.regex)
    ? expected.regex
    : [String(expected.regex)];

  for (const pat of patterns) {
    try {
      const re = new RegExp(pat);
      if (re.test(trimmed)) return 1;
    } catch { /* skip invalid */ }
  }

  // Also try exact match if value is provided
  if (expected.value && trimmed === String(expected.value).trim()) return 1;

  return 0;
}

// ── Deep equality (order-insensitive for objects) ──

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    // For arrays of objects, try order-insensitive matching
    if (a.length > 0 && typeof a[0] === "object") {
      const bCopy = [...b];
      for (const item of a) {
        const idx = bCopy.findIndex((bItem) => deepEqual(item, bItem));
        if (idx < 0) return false;
        bCopy.splice(idx, 1);
      }
      return true;
    }
    return a.every((v, i) => deepEqual(v, b[i]));
  }

  if (typeof a === "object" && typeof b === "object") {
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    const aKeys = Object.keys(aObj).sort();
    const bKeys = Object.keys(bObj).sort();
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every(
      (k, i) => k === bKeys[i] && deepEqual(aObj[k], bObj[k])
    );
  }

  // numeric comparison
  if (typeof a === "number" && typeof b === "number") {
    return Math.abs(a - b) < 1e-9;
  }

  return String(a) === String(b);
}

// ── Main scoring function ──────────────────────

export function scoreObjective(
  item: WorkloadItem,
  output: string
): { score: number; method: string } {
  if (!item.expected) {
    return { score: -1, method: item.scoring }; // subjective — needs judge
  }

  switch (item.scoring) {
    case "exact":
      return { score: scoreExact(output, item.expected), method: "exact" };
    case "numeric_tolerance":
      return {
        score: scoreNumericTolerance(output, item.expected, item.tolerance),
        method: "numeric_tolerance",
      };
    case "json_schema":
      return { score: scoreJsonSchema(output, item.expected), method: "json_schema" };
    case "regex":
      return { score: scoreRegex(output, item.expected), method: "regex" };
    default:
      return { score: -1, method: item.scoring };
  }
}

// ── Embedding similarity (cosine) ──────────────

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  if (denom === 0) return 0;
  // Scale from [-1,1] to [0,1]
  return (dot / denom + 1) / 2;
}

// ── Subjective scoring via backend ─────────────

export async function scoreSubjective(
  item: WorkloadItem,
  output: string,
  referenceOutput?: string
): Promise<ScoringDetails> {
  const details: ScoringDetails = {
    method: item.scoring,
    raw_output: output.trim(),
  };

  if (item.scoring === "judge") {
    const judgeResult = await callJudge(item.prompt, output, referenceOutput);
    details.judge_score = judgeResult.score;
    details.judge_reasons = judgeResult.reasons;
    details.objective_score = judgeResult.score;
    return details;
  }

  if (item.scoring === "embedding+judge") {
    // Get embedding similarity
    let embeddingScore = 0;
    if (referenceOutput) {
      try {
        const [embA, embB] = await Promise.all([
          callEmbed(output),
          callEmbed(referenceOutput),
        ]);
        embeddingScore = cosineSimilarity(embA, embB);
      } catch (e) {
        console.warn("Embedding failed, using 0:", e);
      }
    }

    // Get judge score
    const judgeResult = await callJudge(item.prompt, output, referenceOutput);

    details.embedding_score = Math.round(embeddingScore * 1000) / 1000;
    details.judge_score = judgeResult.score;
    details.judge_reasons = judgeResult.reasons;
    details.objective_score = Math.round(
      (0.5 * embeddingScore + 0.5 * judgeResult.score) * 1000
    ) / 1000;

    return details;
  }

  // Fallback for objective scoring
  const objResult = scoreObjective(item, output);
  details.objective_score = objResult.score;
  return details;
}

// ── Full scoring (objective + optional subjective) ──

export async function scoreItem(
  item: WorkloadItem,
  output: string,
  referenceOutput?: string
): Promise<ScoringDetails> {
  // Try objective first
  if (item.expected && ["exact", "numeric_tolerance", "json_schema", "regex"].includes(item.scoring)) {
    const obj = scoreObjective(item, output);
    return {
      method: obj.method,
      objective_score: obj.score,
      raw_expected: item.expected,
      raw_output: output.trim(),
    };
  }

  // Subjective
  return scoreSubjective(item, output, referenceOutput);
}

// ── Backend API calls ──────────────────────────

async function callJudge(
  prompt: string,
  candidate: string,
  reference?: string
): Promise<{ score: number; reasons: string[] }> {
  try {
    const res = await fetch("/api/judge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, candidate, reference }),
    });
    if (!res.ok) throw new Error(`Judge API ${res.status}`);
    return await res.json();
  } catch (e) {
    console.warn("Judge call failed:", e);
    return { score: 0.5, reasons: ["Judge API unavailable"] };
  }
}

async function callEmbed(text: string): Promise<number[]> {
  const res = await fetch("/api/embed", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`Embed API ${res.status}`);
  const data = await res.json();
  return data.embedding;
}
