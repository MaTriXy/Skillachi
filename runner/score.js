/**
 * Skillachi Multi-Model Scorer
 * Scores a benchmark run against 4 judging criteria (C1-C3, C5) using claude, codex, and gemini.
 * C4 (test coverage) is excluded — it scores near-zero universally and adds noise, not signal.
 * See: https://github.com/MaTriXy/Skillachi/issues/7
 *
 * Aggregation uses median-of-model-overalls rather than mean, to suppress per-model bias.
 */
import { spawnSync } from 'child_process';

// C4 (index 3) is excluded from scoring — see issue #7
const SKIP_CRITERIA = new Set([3]);
const SCORE_COUNT = 4; // C1, C2, C3, C5

/**
 * Build the scoring prompt for a benchmark + diff pair.
 * Uses 4 criteria: C1, C2, C3, C5 (C4 / test coverage excluded).
 */
function buildScoringPrompt(benchmark, diff) {
  const allCriteria = (benchmark.judgingCriteria || []).slice(0, 5);
  const criteria = allCriteria.filter((_, i) => !SKIP_CRITERIA.has(i));
  const criteriaText = criteria.map((c, i) => `${i + 1}. ${c}`).join('\n');
  const truncatedDiff = diff?.slice(0, 8000) || '(no diff — implementation produced no changes)';

  return `You are a code review judge. Score this implementation on each of ${SCORE_COUNT} criteria (1-10 each).

TASK: ${benchmark.requestedChange}

IMPLEMENTATION (git diff):
${truncatedDiff}

JUDGING CRITERIA:
${criteriaText}

Respond ONLY with valid JSON, no other text:
{"scores": [s1, s2, s3, s4], "overall": <average of scores>, "notes": "<one sentence observation>"}`;
}

/**
 * Extract the actual model response from codex's session-log output format.
 * Codex wraps responses in a session log — try multiple patterns to be robust.
 */
function extractCodexResponse(raw) {
  // Pattern 1: "codex\n<response>\ntokens used"
  const m1 = raw.match(/^codex\n([\s\S]*?)(?:\ntokens used|\nNo JSON)/m);
  if (m1) return m1[1].trim();

  // Pattern 2: any JSON block with "scores" key (last resort)
  return raw;
}

/**
 * Parse JSON score response from an LLM. Returns null on failure.
 */
function parseScoreResponse(raw, cli) {
  if (!raw) return null;
  const text = cli === 'codex' ? extractCodexResponse(raw) : raw;

  // Try to find any JSON object containing "scores"
  const matches = [...text.matchAll(/\{[\s\S]*?"scores"[\s\S]*?\}/g)];
  for (const m of matches) {
    try {
      const obj = JSON.parse(m[0]);
      if (!Array.isArray(obj.scores)) continue;
      // Accept 4 or 5 scores — if 5, drop index 3 (C4)
      let scores = obj.scores;
      if (scores.length === 5) scores = scores.filter((_, i) => !SKIP_CRITERIA.has(i));
      if (scores.length !== SCORE_COUNT) continue;
      obj.scores = scores;
      if (typeof obj.overall !== 'number') {
        obj.overall = scores.reduce((a, b) => a + b, 0) / scores.length;
      } else if (obj.scores.length !== (obj.scores.length + (SKIP_CRITERIA.size > 0 ? 0 : 0))) {
        // Recalculate overall from the filtered scores
        obj.overall = scores.reduce((a, b) => a + b, 0) / scores.length;
      }
      return obj;
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Run a single LLM scorer non-interactively.
 * Returns { scores, overall, notes } or null on failure.
 */
async function runScorer(cliName, prompt) {
  let result;

  try {
    if (cliName === 'claude') {
      result = spawnSync(
        'claude',
        ['-p', prompt, '--no-session-persistence'],
        { encoding: 'utf8', maxBuffer: 5 * 1024 * 1024 }
      );
    } else if (cliName === 'codex') {
      result = spawnSync(
        'codex',
        ['exec', '--full-auto', prompt],
        { encoding: 'utf8', maxBuffer: 5 * 1024 * 1024 }
      );
    } else if (cliName === 'gemini') {
      result = spawnSync(
        'gemini',
        ['-p', prompt, '-y'],
        { encoding: 'utf8', maxBuffer: 5 * 1024 * 1024 }
      );
    }
  } catch (e) {
    console.warn(`    scorer ${cliName} error: ${e.message}`);
    return null;
  }

  if (!result) return null;

  const raw = (result.stdout || '') + (result.stderr || '');
  let parsed = parseScoreResponse(raw, cliName);

  // Retry once on parse failure (claude only — most reliable retrier)
  if (!parsed && raw.length > 0) {
    console.warn(`    scorer ${cliName}: parse failed, retrying...`);
    try {
      if (cliName === 'claude') {
        const retry = spawnSync('claude', ['-p', prompt, '--no-session-persistence'], {
          encoding: 'utf8', maxBuffer: 5 * 1024 * 1024,
        });
        if (retry) parsed = parseScoreResponse((retry.stdout || '') + (retry.stderr || ''), cliName);
      } else if (cliName === 'codex') {
        // Codex retry: ask for plain JSON directly
        const retryPrompt = prompt + '\n\nIMPORTANT: Output ONLY the JSON object, nothing else.';
        const retry = spawnSync('codex', ['exec', '--full-auto', retryPrompt], {
          encoding: 'utf8', maxBuffer: 5 * 1024 * 1024,
        });
        if (retry) parsed = parseScoreResponse((retry.stdout || '') + (retry.stderr || ''), cliName);
      }
    } catch {}
  }

  return parsed;
}

/**
 * Median of an array of numbers. With 3 values this naturally suppresses
 * the most biased model (high or low) and uses the middle ground.
 */
function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Score a benchmark slot using all 3 LLM scorers.
 *
 * Aggregation strategy — median-of-overalls:
 *   With 3 judges that have measurable bias (Gemini +1.3 vs Claude), a simple
 *   mean rewards whichever model is most generous. Median picks the middle judge
 *   regardless of who is outlying high or low, making the leaderboard score
 *   robust to single-model drift without needing per-model calibration.
 *
 * @param {object} opts
 * @param {object} opts.benchmark
 * @param {object} opts.diffs  - { claude, codex, gemini }
 * @param {object} opts.outputs - { claude, codex, gemini }
 * @returns {{ claude, codex, gemini, average, scoredAt }}
 */
export async function scoreSlot({ benchmark, diffs, outputs }) {
  const results = {};

  for (const cli of ['claude', 'codex', 'gemini']) {
    const diff = diffs[cli] || '';
    const prompt = buildScoringPrompt(benchmark, diff);
    console.log(`    Scoring ${cli}'s implementation with ${cli}...`);
    results[cli] = await runScorer(cli, prompt);
  }

  // Median-of-overalls across available scorers
  const available = ['claude', 'codex', 'gemini'].filter(c => results[c] != null);
  let average = null;

  if (available.length > 0) {
    const overalls = available.map(c => results[c].overall).filter(v => typeof v === 'number');
    const medianOverall = median(overalls);

    // Per-criterion median across available models
    const medianScores = Array.from({ length: SCORE_COUNT }, (_, i) => {
      const vals = available
        .map(c => results[c]?.scores?.[i])
        .filter(v => typeof v === 'number');
      return median(vals);
    });

    average = {
      scores: medianScores.map(v => parseFloat(v.toFixed(2))),
      overall: parseFloat(medianOverall.toFixed(2)),
      method: 'median',
      n: available.length,
    };
  }

  return {
    claude: results.claude,
    codex: results.codex,
    gemini: results.gemini,
    average,
    scoredAt: new Date().toISOString(),
  };
}
