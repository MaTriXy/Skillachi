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

## Related datasets

- [SWE-bench](https://huggingface.co/datasets/princeton-nlp/SWE-bench_Verified)
- [AgentPack](https://huggingface.co/datasets/nuprl/AgentPack)
- [CommitPack](https://huggingface.co/datasets/bigcode/commitpack)
