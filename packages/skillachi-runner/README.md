# skillachi-runner

Run [Skillachi](https://github.com/MaTriXy/Skillachi) benchmarks and auto-contribute results.

## Prerequisites

- **claude** CLI — installed and authenticated
- **codex** CLI — installed and authenticated  
- **gemini** CLI — installed and authenticated
- **gh** CLI — installed and authenticated (`gh auth login`)

## Usage

```bash
# Pick an uncovered slot, run all 3 CLIs, score, and open a PR automatically
npx skillachi-runner --contribute

# See what's uncovered without running
npx skillachi-runner --gaps

# Run a specific slot
npx skillachi-runner --slot my-benchmark-id:my-skill-id

# Preview what would happen without executing
npx skillachi-runner --contribute --dry-run
```

## How it works

1. Fetches `gaps.json` from the Skillachi repo to find uncovered slots
2. Picks the slot from the role with the most gaps
3. Clones the benchmark repo at the exact base commit
4. Installs the skill into `.claude/skills/`, `.codex/skills/`, `.gemini/skills/`
5. Runs Claude, Codex, and Gemini non-interactively on the task
6. Scores each diff against 5 judging criteria using Claude
7. Forks MaTriXy/Skillachi, patches `leaderboard.json`, opens a PR
