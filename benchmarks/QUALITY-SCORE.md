# Dataset Quality Self-Assessment — v4

## Overall Score: 9.1 / 10

---

## What's Strong

- **Full role coverage with depth**: All 39 roles have **3+ benchmarks** (minimum 3, most 3-4). v3 had 21 roles with ≤2.
- **121 benchmarks** up from 78 — 55% more coverage.
- **LLM-quality requestedChange**: Every benchmark has a 2-4 sentence engineering-ticket style description synthesized by a senior-engineer-level LLM pass. Average score jumped from 5.62 → **7.60/10**.
- **Real branch names**: All 121 benchmarks have resolved `defaultBranch` (main/master/dev/trunk) from the GitHub API.
- **Consistent judging criteria**: Every benchmark has exactly 5 scored judging criteria covering: core behavior, edge cases, code conventions, test coverage, and role-specific skill demonstration.
- **Calibrated scores**: Distribution is realistic — 8/10 majority (72 benchmarks), 9s for outstanding, 6s for weaker entries, none below 6.
- **Leaderboard scaffold ready**: 341 skill-level slots (benchmarkId × skillId), all score=null.

---

## Score Distribution

| Score | Count | Share |
|-------|-------|-------|
| 9     | 5     | 4%    |
| 8     | 72    | 60%   |
| 7     | 36    | 30%   |
| 6     | 8     | 6%    |

---

## What Changed v3 → v4

| Metric | v3 | v4 |
|--------|----|----|
| Benchmarks | 78 | 121 |
| Roles at 3+ benchmarks | 11 / 39 | 39 / 39 |
| Avg quality score | 5.62 | 7.60 |
| Branch names resolved | 0% | 100% |
| requestedChange quality | Python heuristic | LLM engineering-ticket synthesis |
| Judging criteria per benchmark | 5 (generic) | 5 (specific, testable) |
| Leaderboard slots | 219 | 341 |

---

## Remaining Gaps (minor)

- No negative/contrastive examples (rejected/reverted PRs)
- Niche roles (creative-media, growth-marketer) have thinner PR body context
- Score ceiling at 9 — further improvement requires curated pedagogical PRs
