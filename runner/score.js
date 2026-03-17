/**
 * Skillachi Multi-Model Scorer
 * Scores a benchmark run against 5 judging criteria using claude, codex, and gemini.
 */
import { spawnSync } from 'child_process';

/**
 * Build the scoring prompt for a benchmark + diff pair.
 */
function buildScoringPrompt(benchmark, diff) {
  const criteria = (benchmark.judgingCriteria || []).slice(0, 5);
  const criteriaText = criteria.map((c, i) => `${i + 1}. ${c}`).join('\n');
  const truncatedDiff = diff?.slice(0, 8000) || '(no diff — implementation produced no changes)';

  return `You are a code review judge. Score this implementation on each of 5 criteria (1-10 each).

TASK: ${benchmark.requestedChange}

IMPLEMENTATION (git diff):
${truncatedDiff}

JUDGING CRITERIA:
${criteriaText}

Respond ONLY with valid JSON, no other text:
{"scores": [s1, s2, s3, s4, s5], "overall": <average of scores>, "notes": "<one sentence observation>"}`;
}

/**
 * Parse JSON score response from an LLM. Returns null on failure.
 */
function parseScoreResponse(raw) {
  if (!raw) return null;
  // Try to extract JSON from the response
  const match = raw.match(/\{[\s\S]*"scores"[\s\S]*\}/);
  if (!match) return null;
  try {
    const obj = JSON.parse(match[0]);
    if (!Array.isArray(obj.scores) || obj.scores.length !== 5) return null;
    // Ensure overall is calculated
    if (typeof obj.overall !== 'number') {
      obj.overall = obj.scores.reduce((a, b) => a + b, 0) / obj.scores.length;
    }
    return obj;
  } catch {
    return null;
  }
}

/**
 * Run a single LLM scorer non-interactively.
 * Returns { scores, overall, notes } or null on failure.
 */
async function runScorer(cliName, prompt) {
  let result;
  const promptEscaped = prompt;

  try {
    if (cliName === 'claude') {
      result = spawnSync(
        'claude',
        ['-p', promptEscaped, '--no-session-persistence'],
        { encoding: 'utf8', maxBuffer: 5 * 1024 * 1024 }
      );
    } else if (cliName === 'codex') {
      result = spawnSync(
        'codex',
        ['exec', promptEscaped, '--approval-mode=full-auto'],
        { encoding: 'utf8', maxBuffer: 5 * 1024 * 1024 }
      );
    } else if (cliName === 'gemini') {
      result = spawnSync(
        'gemini',
        ['-p', promptEscaped, '--sandbox=false'],
        { encoding: 'utf8', maxBuffer: 5 * 1024 * 1024 }
      );
    }
  } catch (e) {
    console.warn(`    scorer ${cliName} error: ${e.message}`);
    return null;
  }

  if (!result) return null;

  const raw = (result.stdout || '') + (result.stderr || '');
  let parsed = parseScoreResponse(raw);

  // Retry once on parse failure
  if (!parsed && raw.length > 0) {
    console.warn(`    scorer ${cliName}: parse failed, retrying...`);
    // Try again with a slightly different approach
    try {
      let retryResult;
      if (cliName === 'claude') {
        retryResult = spawnSync('claude', ['-p', promptEscaped, '--no-session-persistence'], {
          encoding: 'utf8', timeout: 120_000, maxBuffer: 5 * 1024 * 1024
        });
      }
      if (retryResult) {
        const retryRaw = (retryResult.stdout || '') + (retryResult.stderr || '');
        parsed = parseScoreResponse(retryRaw);
      }
    } catch {}
  }

  return parsed;
}

/**
 * Score a benchmark slot using all 3 LLM scorers.
 *
 * @param {object} opts
 * @param {object} opts.benchmark - full benchmark object (requestedChange, judgingCriteria, etc.)
 * @param {object} opts.diffs - { claude: string, codex: string, gemini: string }
 * @param {object} opts.outputs - { claude: string, codex: string, gemini: string }
 * @returns {{ claude, codex, gemini, average, scoredAt }}
 */
export async function scoreSlot({ benchmark, diffs, outputs }) {
  const results = {};

  for (const cli of ['claude', 'codex', 'gemini']) {
    const diff = diffs[cli] || '';
    const prompt = buildScoringPrompt(benchmark, diff);
    console.log(`    Scoring ${cli}'s implementation with ${cli}...`);
    const score = await runScorer(cli, prompt);
    results[cli] = score;
  }

  // Calculate average across available scorers
  const available = ['claude', 'codex', 'gemini'].filter(c => results[c] !== null);
  let average = null;

  if (available.length > 0) {
    const avgScores = [0, 0, 0, 0, 0];
    for (const cli of available) {
      const s = results[cli];
      if (s?.scores?.length === 5) {
        s.scores.forEach((v, i) => { avgScores[i] += v; });
      }
    }
    avgScores.forEach((_, i) => { avgScores[i] /= available.length; });
    const avgOverall = avgScores.reduce((a, b) => a + b, 0) / 5;
    average = { scores: avgScores.map(v => parseFloat(v.toFixed(2))), overall: parseFloat(avgOverall.toFixed(2)) };
  }

  return {
    claude: results.claude,
    codex: results.codex,
    gemini: results.gemini,
    average,
    scoredAt: new Date().toISOString(),
  };
}
