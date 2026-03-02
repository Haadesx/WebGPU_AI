# Benchmark Results Analysis

**Run:** `2026-03-02T16-00-38` (single run, 24 prompts × 3 systems = 72 results)
**Duration:** ~18 minutes (15:41 → 15:59 UTC)
**Device:** MacIntel, Apple WebGPU adapter, Safari 26.3

---

## Systems Tested

| System | Model | Where |
|--------|-------|-------|
| **Edge** | Llama 3.1 8B (4-bit, q4f16) | In-browser via WebGPU, ~4.3 GB model |
| **Cloud Small** | GPT-OSS 20B | OpenRouter API (free tier) |
| **Cloud Large** | GPT-OSS 120B | OpenRouter API (free tier) |

---

## Performance Summary

### Latency (TTFT — Time to First Token)

| System | Avg TTFT | Min | Max | Notes |
|--------|----------|-----|-----|-------|
| **Edge** | ~850 ms | 655 ms | 7,777 ms | Very consistent (~700 ms typical), spikes on longer prompts |
| **Cloud Small** | ~6,500 ms | 408 ms | 42,625 ms | Highly variable — reasoning tokens cause hidden delays |
| **Cloud Large** | ~7,000 ms | 426 ms | 48,422 ms | Similar variability; some prompts take 30-48 seconds |

> **Key finding:** Edge TTFT is **~8× faster** on average and much more consistent. The cloud models' TTFT includes hidden "reasoning time" (GPT-OSS thinks before outputting visible tokens), creating massive spikes.

### Throughput (TPS — Tokens Per Second)

| System | Avg TPS | Min | Max |
|--------|---------|-----|-----|
| **Edge** | ~25 TPS | 13.6 | 31.2 |
| **Cloud Small** | ~115 TPS | 73.5 | 176.7 |
| **Cloud Large** | ~72 TPS | 6.3 | 147.9 |

> **Key finding:** Cloud Small is **~4.6× faster** in raw throughput once tokens start flowing. Cloud Large varies wildly (6-148 TPS). Edge is steady at ~25 TPS.

---

## Quality Scores

### Objective Prompts (12 prompts, scored automatically)

| Prompt | Type | Edge | Cloud Small | Cloud Large |
|--------|------|------|-------------|-------------|
| math_01 (17×23+91) | numeric | ✅ 1.0 | ✅ 1.0 | ✅ 1.0 |
| math_02 (144/12+7×9) | numeric | ✅ 1.0 | ✅ 1.0 | ✅ 1.0 |
| math_03 (2^10) | numeric | ✅ 1.0 | ❌ 0.0 | ✅ 1.0 |
| json_01 | json_schema | ✅ 1.0 | ❌ 0.0 | ❌ 0.0 |
| json_02 | json_schema | ✅ 1.0 | ❌ 0.0 | ❌ 0.0 |
| extract_01 (email) | regex | ✅ 1.0 | ❌ 0.0 | ❌ 0.0 |
| extract_02 (3rd word) | exact | ❌ 0.0 | ❌ 0.0 | ❌ 0.0 |
| code_01 (len) | exact | ✅ 1.0 | ❌ 0.0 | ❌ 0.0 |
| code_02 (toLowerCase) | regex | ✅ 1.0 | ❌ 0.0 | ❌ 0.0 |
| logic_01 (syllogism) | exact | ❌ 0.0 | ❌ 0.0 | ❌ 0.0 |
| instruction_01 (EDGE) | exact | ✅ 1.0 | ❌ 0.0 | ❌ 0.0 |
| instruction_02 (A,B,C) | exact | ✅ 1.0 | ❌ 0.0 | ❌ 0.0 |
| **Objective Total** | | **10/12 (83%)** | **2/12 (17%)** | **3/12 (25%)** |

> [!IMPORTANT]
> **Edge crushed the cloud models on objective quality.** Why? Because GPT-OSS is a **reasoning model** that leaks its chain-of-thought into the visible output. When the prompt says "return only the number" or "return only JSON", GPT-OSS outputs its reasoning first ("The user asks...") and then appends the actual answer. Our scoring checks the **entire output**, so the preamble causes `exact`, `regex`, and `json_schema` matches to fail.
>
> **Edge (Llama 3.1 8B)** follows instructions more cleanly — it outputs just the answer without visible reasoning contamination.

### Subjective Prompts (12 prompts, judge + embedding scored)

All subjective prompts scored **0.25** (embedding+judge) or **0.50** (judge-only) across all systems. This is because:

1. **Embeddings failed** — OpenRouter doesn't support the embeddings API for free models, so `embedding_score = 0` for all
2. **Judge failed** — The GPT-OSS reasoning model returns malformed JSON from the judge prompt (its reasoning tokens corrupt the JSON response), producing `"Judge API unavailable: Unexpected end of JSON input"`
3. **Fallback to 0.5** — When judge fails, we default to 0.5

> These subjective scores are **not meaningful** in this run. They need a non-reasoning model (or proper reasoning-token filtering) for judging.

---

## What This All Means

### 1. Edge (WebGPU) is surprisingly competitive
- **83% objective accuracy** vs 17-25% for cloud models
- **Sub-second TTFT** (700ms typical) — the user sees output almost immediately
- Consistent ~25 TPS throughput
- Runs entirely offline, no API dependency

### 2. GPT-OSS reasoning models are a bad fit for this benchmark
The GPT-OSS models are **reasoning models** — they "think" internally (reasoning tokens) before outputting their answer. This creates two problems:
- **The reasoning text leaks into the output**, breaking exact-match, regex, and JSON scoring
- **TTFT is artificially inflated** because the model spends seconds "thinking" before the first visible token

### 3. Cloud has higher raw throughput but worse responsiveness
Cloud Small reaches ~115 TPS once tokens flow, but the user might wait **42 seconds** before seeing the first token (reasoning time). Edge is slower per-token but much more responsive.

### 4. Subjective scoring needs fixing
The judge/embedding scoring pipeline didn't work because:
- OpenRouter free tier doesn't support embeddings
- Reasoning models return corrupted JSON from the judge prompt

---

## Recommendations for Next Run

1. **Switch cloud models to a non-reasoning model** (e.g., `meta-llama/llama-3.1-8b-instruct:free` or `google/gemma-2-9b-it:free`) — these output clean content without reasoning preamble
2. **Or filter reasoning tokens** — strip the reasoning preamble before scoring (everything before the visible answer)
3. **Use a paid model for judging** — the judge needs to return clean JSON, which reasoning models can't do reliably
4. **Run 3+ runs** for statistical significance (this was a single run)
