# Skillachi

**A benchmark dataset for evaluating AI coding skills across 39 engineering roles.**

121 real-world coding tasks sourced from merged GitHub PRs — each one a reproducible starting point for testing how well an AI agent can implement a specific change.

---

## What's in the dataset

Each benchmark contains:
- **Base commit** — the exact repo state before the fix (checkout and go)
- **`requestedChange`** — a 2-4 sentence engineering-ticket description of what to implement
- **`judgingCriteria`** — 5 specific, testable criteria to score the output
- **`candidateSkillIds`** — the top 3 AI skills expected to solve it
- **Issue reference** — the original GitHub issue or PR description

---

## Structure

```
benchmarks/
  benchmarks.json          # 121 benchmarks, v4
  leaderboard-scaffold.json  # 341 slots (benchmark × skill), score=null
  coverage-report.md       # per-role breakdown
  QUALITY-SCORE.md         # self-assessment of dataset quality

ontology/
  ontology.json            # 39 roles across 7 domains
  ontology-summary.md

roles/
  deep-skill-matching-v2.json  # top skills per role (scored + deduplicated)

augmented-catalog/
  skills-augmented.json    # ~4,700 skills with metadata

skills-marketplace/
  inventory/               # repo + skill discovery data
  marketplace/catalog/     # skills.json, categories.json, taxonomy.json
```

---

## Coverage

| Domain | Roles | Benchmarks |
|--------|-------|-----------|
| Software Engineering | 9 | ~30 |
| Data & AI | 8 | ~27 |
| Security & Compliance | 5 | ~17 |
| DevOps & Infrastructure | 4 | ~13 |
| Design & Product | 7 | ~23 |
| Quality & Testing | 3 | ~10 |
| Hardware & Science | 3 | ~10 |

All 39 roles have **3+ benchmarks** each. Average quality score: **7.6 / 10**.

---

## Running the benchmark

The runner executes each (benchmark × skill) slot in the leaderboard: it shallow-clones the repo at the exact base commit, installs the target skill in isolation, invokes Claude, Codex, and Gemini non-interactively with the `requestedChange` prompt, captures the resulting git diff, and scores it against the 5 `judgingCriteria` using all three models. Progress is saved after every slot so you can stop and resume at any time.

### Prerequisites

Make sure all three CLIs are installed and authenticated before running:

```bash
claude --version
codex --version
gemini --version
```

### Calibration run (recommended first step)

Run 3 slots end-to-end to get a real time estimate before committing to the full dataset:

```bash
node runner/run.js --limit 3
```

Each slot clones the repo, runs claude + codex + gemini sequentially, scores the diffs, and writes results to `benchmarks/leaderboard.json`. Expect **5–15 minutes per slot** depending on task complexity.

### Full run

```bash
node runner/run.js
```

341 slots total. At 5–15 min/slot that's roughly **30–85 hours** — leave it running overnight or across multiple sessions. The runner is resume-safe: if you Ctrl+C and restart, it picks up from where it left off (`runner/progress.json` tracks completed slots).

### Other flags

```bash
node runner/run.js --dry-run          # preview what would run, no CLIs invoked
node runner/run.js --limit 20         # run only the first N pending slots
node runner/run.js --slot bm123:sk456 # run a single specific slot
```

### Leaderboard

Scores are written to `benchmarks/leaderboard.json` after each slot and auto-published to GitHub Pages on push. To enable Pages: repo Settings → Pages → Source: `main` branch, `/docs` folder.

---

## Related datasets

- [SWE-bench](https://huggingface.co/datasets/princeton-nlp/SWE-bench_Verified)
- [AgentPack](https://huggingface.co/datasets/nuprl/AgentPack)
- [CommitPack](https://huggingface.co/datasets/bigcode/commitpack)
