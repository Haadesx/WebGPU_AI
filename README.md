# Edge AI Benchmark: WebGPU Quantized LLMs vs Cloud

> **CS553 — Ethan Nguyen, Varesh Patel, Najeeb Quadri**

A comparative benchmark harness that runs a **4-bit quantized LLM entirely in the browser via WebGPU** alongside **cloud-hosted LLMs**, measuring latency, throughput, memory footprint, and output quality across a fixed viability workload of 16 prompts.

---

## Quick Start

```bash
# 1. Clone and install
git clone https://github.com/Haadesx/WebGPU_AI.git && cd WebGPU_AI
cp .env.example .env        # ← add your API key
npm install

# 2. Start the backend (proxies cloud API calls)
npm run server               # http://localhost:3001

# 3. Start the frontend (in another terminal)
npm run dev                  # http://localhost:5173
```

Open **http://localhost:5173** in Chrome/Edge with WebGPU enabled.

---

## Requirements

| Requirement        | Version                                    |
| ------------------ | ------------------------------------------ |
| Node.js            | ≥ 18                                       |
| Browser            | Chrome 113+ or Edge 113+ with WebGPU       |
| OpenRouter API key | For cloud benchmarks (free tier available) |

### Enabling WebGPU

- **Chrome** → `chrome://flags` → search "WebGPU" → Enable → Relaunch
- **Edge** → `edge://flags` → same as above
- **macOS (Apple Silicon):** WebGPU works out of the box on recent Chrome
- **Windows:** Requires compatible GPU drivers (Vulkan backend)

The app detects WebGPU automatically and shows a status banner.

---

## Architecture

```
┌─────────────────────────────────────────┐
│  Browser (Vite + React + TypeScript)    │
│  ┌──────────┐  ┌────────────────────┐   │
│  │ WebLLM   │  │ Cloud Engine       │   │
│  │ (WebGPU) │  │ (SSE → /api/chat)  │   │
│  └──────────┘  └────────┬───────────┘   │
│       │                 │               │
│  Benchmark Runner + Scoring Module      │
└────────────────────────┬────────────────┘
                         │ fetch
┌────────────────────────▼────────────────┐
│  Express Server (:3001)                 │
│  POST /api/chat  (stream SSE)           │
│  POST /api/embed (embeddings)           │
│  POST /api/judge (LLM-as-judge)         │
│  GET  /api/health                       │
│            │                            │
│     OpenAI-compatible Provider          │
└─────────────────────────────────────────┘
```

**Key design choices:**

- API keys **never** reach the client — all cloud calls go through the backend proxy.
- Edge inference is fully in-browser via `@mlc-ai/web-llm` + WebGPU.
- Streaming (SSE) for TTFT measurement on both cloud and edge paths.
- The provider module (`apps/server/src/providers/openai.ts`) is isolated for easy swap.

---

## Systems Under Test

| ID            | Model                                                     | Location         | Quantization  |
| ------------- | --------------------------------------------------------- | ---------------- | ------------- |
| `edge`        | Llama 3.1 8B / Phi 3.5 Mini / TinyLlama 1.1B (selectable) | Browser (WebGPU) | 4-bit (q4f16) |
| `cloud_small` | GPT-OSS 20B (free via OpenRouter)                         | OpenRouter API   | N/A           |
| `cloud_large` | GPT-OSS 120B (free via OpenRouter)                        | OpenRouter API   | N/A           |

Change cloud models via `.env`:

```
CLOUD_MODEL_SMALL=openai/gpt-oss-20b:free
CLOUD_MODEL_LARGE=openai/gpt-oss-120b:free
```

---

## Workload

**16 prompts** in `benchmarks/workload.json` across 8 categories, tuned for faster one-day data collection:

| #     | Type                                                         | Count | Scoring                               |
| ----- | ------------------------------------------------------------ | ----- | ------------------------------------- |
| 1-11, 14-15 | Objective/semi-objective (math, json, code, extraction, logic, instruction, privacy) | 13 | numeric / json_schema / regex |
| 12-13, 16 | Subjective (summarization, reasoning, quantization) | 3 | embedding+judge / judge |

Generation settings: `temperature=0`, `top_p=1`, with per-prompt `max_new_tokens` caps of 16-112 tokens to keep runs short.

### Full Prompt List

All prompts are stored in [`benchmarks/workload.json`](benchmarks/workload.json) and copied to `apps/web/public/workload.json` for browser access. The current set is intentionally compact: most prompts are short objective tasks with regex/JSON/numeric scoring, plus three capped subjective prompts for summarization and reasoning quality.

---

## Metrics Collected

| Metric                  | Description                                          |
| ----------------------- | ---------------------------------------------------- |
| **TTFT (ms)**           | Time from prompt submission to first generated token |
| **TPS**                 | Tokens per second after first token                  |
| **Total Latency (ms)**  | End-to-end completion time                           |
| **Tokens Generated**    | Count (API usage + whitespace estimate)              |
| **Prompt Tokens**       | API usage field or whitespace estimate               |
| **JS Heap (MB)**        | `performance.memory.usedJSHeapSize` (Chrome only)    |
| **Model Size (MB)**     | Estimated from WebLLM download progress              |
| **Quality Score [0,1]** | Per prompt, per scoring type                         |
| **PQR**                 | `(normalized_TPS) × avg_quality`                     |
| **PQR2**                | `avg_quality / (TTFT_seconds + ε)`                   |
| **VSI**                 | `avg_quality × (0.7 × responsiveness + 0.3 × normalized_TPS)` |

### Memory Limitations

True GPU VRAM usage is **not accessible** from the browser. We collect:

1. JS heap size via `performance.memory` (Chrome-only, best effort)
2. Model artifact size (sum of downloaded model files, reported by WebLLM)
3. Any internal memory stats reported by the WebLLM engine

These are **approximations** — see the report template for details.

---

## Understanding the Benchmark Results (Field-by-Field Glossary)

When you export results (JSON or CSV), every record contains the fields below. Here is what each one means, why it matters, and how to interpret it.

### Per-Prompt Result Fields

| Field       | Type       | What It Means                                                                                               |
| ----------- | ---------- | ----------------------------------------------------------------------------------------------------------- |
| `promptId`  | string     | Unique ID of the workload prompt (e.g. `math_01`, `summarize_01`). Maps back to `benchmarks/workload.json`. |
| `system`    | string     | Which system produced this result: `edge` (in-browser WebGPU), `cloud_small`, or `cloud_large`.             |
| `model`     | string     | Human-readable model name (e.g. "Edge (WebGPU)", "Cloud Small").                                            |
| `output`    | string     | The raw text the model generated. This is the full, unedited response.                                      |
| `timestamp` | ISO string | When this specific inference call completed.                                                                |

### Latency & Throughput Metrics

| Field              | Unit         | What It Means                                                                                                                                           | Why It Matters                                                                                                                                                                                                                                                                                             |
| ------------------ | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ttft_ms`          | milliseconds | **Time To First Token** — the time between sending the prompt and receiving the very first token of the response.                                       | Measures _perceived responsiveness_. A low TTFT means the user sees output start almost instantly. Edge models typically have consistent TTFT (~700ms) because everything runs locally. Cloud models can have high TTFT due to network latency, queuing, or (for reasoning models) hidden "thinking" time. |
| `tps`              | tokens/sec   | **Tokens Per Second** — how fast the model generates tokens _after_ the first token arrives. Calculated as `tokens_generated / (total_latency - ttft)`. | Measures _generation throughput_. Higher = faster to complete long responses. Cloud models often have higher TPS because they run on powerful server GPUs. Edge models are limited by your local GPU.                                                                                                      |
| `total_latency_ms` | milliseconds | **Total Latency** — wall-clock time from prompt submission to the last token received. Equal to `ttft_ms + (tokens_generated / tps × 1000)`.            | The end-to-end time the user waits for a complete answer.                                                                                                                                                                                                                                                  |

### Token Counts

| Field                         | Unit  | What It Means                                                                                                                                                       |
| ----------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tokens_generated`            | count | Number of output tokens the model produced. For cloud models this comes from the API's `usage.completion_tokens`. For edge, it's counted from the streaming chunks. |
| `tokens_generated_whitespace` | count | Approximate token count estimated by splitting the output on whitespace. Used as a fallback when API usage data is unavailable.                                     |
| `prompt_tokens`               | count | Number of tokens in the input prompt. From the API's `usage.prompt_tokens` for cloud; estimated for edge.                                                           |

### Memory Metrics

| Field               | Unit | What It Means                                                                                                                                                                                                                                                            |
| ------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `memory_js_heap_mb` | MB   | JavaScript heap memory usage at the time of inference, measured via `performance.memory.usedJSHeapSize`. Only available in Chromium browsers. Shows **0** in Safari or Firefox. This is _not_ GPU/VRAM — it's CPU-side JS memory.                                        |
| `model_size_mb`     | MB   | Estimated size of the model files downloaded for edge inference (e.g. 4309 MB for Llama 3.1 8B 4-bit). Always **0** for cloud models since nothing is downloaded locally. This is the closest proxy we have for VRAM usage, since browsers don't expose GPU memory APIs. |

### Quality Scoring

| Field                             | Type    | What It Means                                                                                                                                                                          |
| --------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `quality_score`                   | 0.0–1.0 | The final quality score for this prompt. **1.0 = perfect**, **0.0 = failed**. For objective prompts, this is binary (0 or 1). For subjective prompts, it's averaged from judge scores. |
| `scoring_details`                 | object  | Breakdown of how the score was calculated (see below).                                                                                                                                 |
| `scoring_details.method`          | string  | Which scoring method was used — one of: `exact`, `numeric_tolerance`, `json_schema`, `regex`, `judge`, `embedding+judge`.                                                              |
| `scoring_details.objective_score` | 0 or 1  | For objective prompts: did the model's output match the expected answer?                                                                                                               |
| `scoring_details.raw_expected`    | object  | The expected answer from the workload (e.g. `{"value": 482}` or `{"regex": "^pattern$"}`).                                                                                             |
| `scoring_details.raw_output`      | string  | The model's full output that was evaluated against the expected value.                                                                                                                 |

### Scoring Methods Explained

| Method                  | How It Works                                                                                                                                                   | Example                                                                                                                |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **`exact`**             | Trims whitespace from the output and compares character-by-character to the expected value. Case-sensitive.                                                    | Prompt: "Return the 3rd word." Expected: `browsers`. Output must be exactly `browsers` — not `Browsers` or `browsers.` |
| **`numeric_tolerance`** | Extracts the last number found in the output and checks if it's within ±1% of the expected number.                                                             | Expected: `482`. If output contains "the answer is 482", it extracts `482` and passes.                                 |
| **`json_schema`**       | Parses the output as JSON, then does a deep equality check against the expected JSON object. Order of object keys doesn't matter; array order does.            | Expected: `{"a":2,"b":[1,2,3]}`. Output must parse to the same structure.                                              |
| **`regex`**             | Tests the trimmed output against one or more regex patterns. The _entire_ output must match (anchored).                                                        | Expected regex: `^s\.toLowerCase\(\);?$`. Output `s.toLowerCase()` passes; `Use s.toLowerCase()` fails.                |
| **`judge`**             | Sends the prompt + output to a "judge" LLM which scores correctness (0-1), instruction following (0-1), and clarity (0-1). Final score = average of the three. | If judge returns `{"correctness": 0.8, "instruction_following": 0.9, "clarity": 0.7}`, score = 0.8.                    |
| **`embedding+judge`**   | 50% cosine similarity between output embedding and reference embedding + 50% judge score. Falls back to judge-only if embeddings unavailable.                  | If embedding similarity = 0.9 and judge = 0.7, score = `0.5 × 0.9 + 0.5 × 0.7 = 0.8`.                                  |

### Subjective Scoring Fields

These appear in `scoring_details` for subjective prompts:

| Field             | What It Means                                                                                              |
| ----------------- | ---------------------------------------------------------------------------------------------------------- |
| `embedding_score` | Cosine similarity (0-1) between the output and a reference answer. **0** if embeddings API is unavailable. |
| `judge_score`     | Score from the LLM-as-judge (0-1). Defaults to **0.5** if the judge API call fails.                        |
| `judge_reasons`   | Array of reasons the judge provided for its scores. Shows error messages if the judge call failed.         |

### Summary / Aggregate Metrics

These appear in the CSV export and summary cards:

| Metric                 | Formula                                        | What It Means                                                                                                                                     |
| ---------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `avg_ttft_ms`          | mean of all TTFT values for that system        | Average responsiveness                                                                                                                            |
| `avg_tps`              | mean of all TPS values                         | Average generation speed                                                                                                                          |
| `p50_ttft_ms`          | 50th percentile of TTFT                        | Median responsiveness (less affected by outliers)                                                                                                 |
| `p95_ttft_ms`          | 95th percentile of TTFT                        | Worst-case responsiveness (tail latency)                                                                                                          |
| `avg_quality`          | mean of all quality scores (0-1)               | Overall answer accuracy                                                                                                                           |
| `avg_penalty_vs_large` | `quality_large − quality_this_system`          | How much worse this system is vs the "best" cloud model                                                                                           |
| `avg_memory_mb`        | mean of JS heap usage                          | Typical memory footprint                                                                                                                          |
| **`PQR`**              | `(TPS / max_TPS_across_systems) × avg_quality` | **Performance-Quality Ratio** — rewards systems that are both fast AND accurate. A system with high throughput but bad quality scores low.        |
| **`PQR2`**             | `avg_quality / (avg_TTFT_seconds + 0.000001)`  | **Responsiveness-Quality Ratio** — rewards systems that are both responsive AND accurate. A system with low TTFT and high quality scores highest. |
| **`VSI`**              | `avg_quality × (0.7 × (1 / (1 + avg_TTFT_seconds)) + 0.3 × normalized_TPS)` | **Viability Score Index** — a presentation-friendly score for whether a model is practical: good answers matter most, but low first-token latency and usable throughput also count. |

### Device Metadata

| Field                    | What It Contains                                                              |
| ------------------------ | ----------------------------------------------------------------------------- |
| `device.userAgent`       | Browser's user agent string (identifies browser, OS, version)                 |
| `device.platform`        | OS platform (e.g. `MacIntel`, `Win32`, `Linux x86_64`)                        |
| `device.webgpuAdapter`   | GPU adapter name reported by WebGPU (e.g. `apple`, `NVIDIA GeForce RTX 4090`) |
| `device.webgpuSupported` | Whether WebGPU was detected (`true`/`false`)                                  |
| `device.timestamp`       | When device info was collected                                                |

### Generation Settings

| Field                                | What It Means                                                                                                                                |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `generation_settings.temperature`    | Controls randomness. **0** = deterministic (always pick the most likely token). Higher = more creative/random. We use 0 for reproducibility. |
| `generation_settings.top_p`          | Nucleus sampling threshold. **1** = consider all tokens. Lower = only consider the most probable tokens. We use 1 (no filtering).            |
| `generation_settings.max_new_tokens` | Maximum number of tokens the model is allowed to generate. The compact workload sets short per-prompt caps for faster runs.                  |

---

## Quality Evaluation

### Objective Prompts

| Scoring             | Logic                                                         |
| ------------------- | ------------------------------------------------------------- |
| `exact`             | Trimmed/final-answer string match after stripping common reasoning blocks |
| `numeric_tolerance` | Parse number, compare with tolerance                          |
| `json_schema`       | Parse JSON, deep-equal (order-insensitive for objects/arrays) |
| `regex`             | Case-insensitive regex against cleaned output; arrays can require any or all patterns |

### Subjective Prompts

| Scoring           | Logic                                                                     |
| ----------------- | ------------------------------------------------------------------------- |
| `judge`           | Cloud Large as judge: correctness + instruction_following + clarity → avg |
| `embedding+judge` | 50% cosine similarity (via embeddings) + 50% judge score                  |

### Derived Metrics

- **Quality Penalty:** `quality_large − quality_edge`
- **PQR:** Throughput-weighted quality
- **PQR2:** Responsiveness-weighted quality
- **VSI:** Viability score that blends quality, first-token responsiveness, and throughput

---

## Benchmark Flow

1. **Warmup** — 2 short prompts per engine to stabilize
2. **Sequential execution** — each prompt runs on all enabled systems before moving to next
3. **Repeated** — R times (default 3, configurable)
4. **Scoring** — objective scoring immediate; subjective via backend (judge + embeddings)
5. **Export** — JSON + CSV from UI; JSON + CSV from CLI

---

## Scripts

| Command                                           | Description                           |
| ------------------------------------------------- | ------------------------------------- |
| `npm run dev`                                     | Start Vite frontend (port 5173)       |
| `npm run server`                                  | Start Express backend (port 3001)     |
| `npm run bench`                                   | Run CLI benchmark (cloud models only) |
| `npm run bench -- --runs 1 --systems cloud_small` | Custom CLI run                        |
| `npm run build`                                   | Production build                      |

### CLI Benchmark Options

```bash
npx tsx scripts/bench.ts \
  --runs 3 \
  --systems cloud_small,cloud_large \
  --out results/ \
  --server http://localhost:3001
```

> **Note:** Edge (browser) benchmarks must run from the web UI since they require WebGPU.

---

## Output Files

| File                              | Contents                                                      |
| --------------------------------- | ------------------------------------------------------------- |
| `results/run_<timestamp>.json`    | Full raw per-prompt metrics for all systems + device metadata |
| `results/summary_<timestamp>.csv` | One row per (device, system) with aggregates                  |

The web UI also provides **Export** buttons for JSON and CSV download.

---

## Environment Variables

| Variable            | Default                        | Description                                                      |
| ------------------- | ------------------------------ | ---------------------------------------------------------------- |
| `OPENAI_API_KEY`    | —                              | **Required** — OpenRouter API key (or any OpenAI-compatible key) |
| `OPENAI_BASE_URL`   | `https://openrouter.ai/api/v1` | OpenRouter endpoint (OpenAI-compatible)                          |
| `CLOUD_MODEL_SMALL` | `openai/gpt-oss-20b:free`      | Small cloud model                                                |
| `CLOUD_MODEL_LARGE` | `openai/gpt-oss-120b:free`     | Large cloud model                                                |
| `EMBED_MODEL`       | `openai/gpt-oss-20b:free`      | Embedding model (fallback: judge-only scoring)                   |
| `PORT`              | `3001`                         | Backend port                                                     |

---

## Repo Structure

```
├── README.md
├── .env.example
├── package.json
├── tsconfig.base.json
├── apps/
│   ├── web/                    # Vite + React + TS frontend
│   │   ├── src/
│   │   │   ├── App.tsx
│   │   │   ├── types/index.ts
│   │   │   ├── lib/            # edge-engine, cloud-engine, scoring, metrics, etc.
│   │   │   └── components/     # ModelSelector, BenchmarkControls, ResultsTable, etc.
│   │   └── index.html
│   └── server/                 # Node + Express + TS backend
│       └── src/
│           ├── index.ts
│           ├── routes/         # chat, embed, judge
│           └── providers/      # openai.ts (swappable)
├── benchmarks/
│   └── workload.json           # 16 fixed viability prompts
├── scripts/
│   └── bench.ts                # CLI benchmark runner
├── results/                    # gitignored output directory
└── report/
    └── report_template.md      # Final report template
```

---

## Reproducing Results on Different Machines

1. Clone repo, install dependencies, set `.env`
2. Open the web UI on each machine
3. Load the same edge model (e.g., "Llama 3.1 8B 4-bit")
4. Enable the same systems, set runs = 3
5. Click **Start Benchmark**
6. Export results → compare across machines
7. Device metadata (platform, adapter, user agent) is captured automatically

For cloud-only (headless) benchmarks, use `npm run bench` on each machine.

---

## Troubleshooting

| Issue               | Solution                                        |
| ------------------- | ----------------------------------------------- |
| WebGPU not detected | Enable in `chrome://flags`, use Chrome ≥ 113    |
| Model download slow | Try TinyLlama (0.6 GB) or Phi 3.5 Mini (2.2 GB) |
| Out of memory       | Use a smaller model or close other tabs         |
| Backend 500 errors  | Check `.env` API key, check console for details |
| CORS errors         | Ensure Vite proxy is running (`npm run dev`)    |

---

## License

MIT — Academic project use only.
