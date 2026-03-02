# Edge AI Benchmark Report

## Running Quantized LLMs in the Browser (WebGPU)

**Team:** Ethan Nguyen, Varesh Patel, Najeeb Quadri  
**Date:** _YYYY-MM-DD_  
**Course:** CS553

---

## 1. Abstract

This report presents a comparative benchmark of edge (in-browser, WebGPU-accelerated, 4-bit quantized) vs. cloud LLM inference. We measure latency (TTFT, TPS), memory footprint, and output quality across a fixed workload of 24 prompts spanning math, code, JSON generation, reasoning, summarization, and instruction following.

## 2. Methodology

### 2.1 Systems Under Test

| System      | Model                         | Inference Location | Quantization |
| ----------- | ----------------------------- | ------------------ | ------------ |
| Edge        | Llama-3.1-8B-Instruct (q4f16) | Browser (WebGPU)   | 4-bit        |
| Cloud Small | gpt-4o-mini                   | OpenAI API         | N/A          |
| Cloud Large | gpt-4o                        | OpenAI API         | N/A          |

### 2.2 Workload

- **24 prompts** across 8 categories
- **12 objective** (exact match, numeric tolerance, JSON schema, regex)
- **12 subjective** (embedding similarity + LLM-as-judge)
- Fixed generation: `temperature=0`, `top_p=1`, `max_new_tokens=256`

### 2.3 Metrics Collected

- **TTFT (ms):** Time from prompt submission to first token
- **TPS:** Tokens per second after first token
- **Total Latency (ms):** End-to-end completion time
- **Memory (MB):** JS heap + estimated model size
- **Quality Score [0,1]:** Objective or subjective per scoring type

### 2.4 Quality Evaluation

- **Objective:** exact match, numeric tolerance, JSON schema validation, regex
- **Subjective:** 50% embedding cosine similarity + 50% LLM-as-judge score
- **Judge rubric:** correctness (0-1), instruction following (0-1), clarity (0-1) → averaged

### 2.5 Derived Metrics

- **Quality Penalty:** `penalty_vs_large = quality_large − quality_edge`
- **PQR:** `normalized_TPS × avg_quality` (throughput-weighted quality)
- **PQR2:** `avg_quality / (TTFT_seconds + 1e-6)` (responsiveness-weighted quality)

## 3. Device Specifications

| Device     | OS           | Browser      | GPU        | RAM     |
| ---------- | ------------ | ------------ | ---------- | ------- |
| _Device 1_ | _macOS 15_   | _Chrome 130_ | _M-series_ | _XX GB_ |
| _Device 2_ | _Windows 11_ | _Edge 130_   | _RTX XXXX_ | _XX GB_ |

## 4. Results

### 4.1 Latency Summary

<!-- INSERT TABLE: avg_ttft_ms, p50_ttft_ms, p95_ttft_ms, avg_tps per system -->

| System      | Avg TTFT (ms) | P50 TTFT (ms) | P95 TTFT (ms) | Avg TPS |
| ----------- | ------------- | ------------- | ------------- | ------- |
| Edge        |               |               |               |         |
| Cloud Small |               |               |               |         |
| Cloud Large |               |               |               |         |

### 4.2 Quality Summary

<!-- INSERT TABLE: avg_quality, penalty_vs_large, penalty_vs_small per system -->

| System      | Avg Quality | Penalty vs Large | Penalty vs Small |
| ----------- | ----------- | ---------------- | ---------------- |
| Edge        |             | —                |                  |
| Cloud Small |             |                  | —                |
| Cloud Large | —           | —                | —                |

### 4.3 Performance-to-Quality Ratio

| System      | PQR | PQR2 |
| ----------- | --- | ---- |
| Edge        |     |      |
| Cloud Small |     |      |
| Cloud Large |     |      |

### 4.4 Memory Footprint

| System      | Avg JS Heap (MB) | Model Artifact Size (MB) |
| ----------- | ---------------- | ------------------------ |
| Edge        |                  |                          |
| Cloud Small | N/A              | N/A                      |
| Cloud Large | N/A              | N/A                      |

## 5. Per-Prompt Breakdown

<!-- INSERT DETAILED TABLE or reference results/*.csv -->

## 6. Charts

<!-- INSERT: TTFT comparison bar chart -->
<!-- INSERT: TPS comparison bar chart -->
<!-- INSERT: Quality score heatmap / grouped bar -->
<!-- INSERT: PQR comparison -->

## 7. Discussion

### 7.1 Latency Analysis

_Discuss edge TTFT advantage/disadvantage, TPS differences, network dependency._

### 7.2 Quality Analysis

_Discuss where edge quality degrades vs. cloud. Identify prompt categories most affected._

### 7.3 Memory & Feasibility

_Discuss browser memory constraints, model download time, practical considerations._

### 7.4 Trade-offs

_When is edge inference worth the quality penalty? Use PQR/PQR2 to argue._

## 8. Limitations

- WebGPU VRAM not directly measurable; JS heap + model artifact size used as proxy
- Embedding similarity scale depends on model choice
- Judge scores subject to LLM bias
- Browser performance varies by hardware / thermal throttling

## 9. Conclusion

_Summarize key findings. Recommendation on when to use edge vs cloud._

## 10. Appendix

- Full workload: `benchmarks/workload.json`
- Raw results: `results/run_*.json`
- Summary CSV: `results/summary_*.csv`
