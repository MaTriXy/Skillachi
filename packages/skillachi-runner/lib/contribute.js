/**
 * Main contribute flow — runs a benchmark slot and opens a PR with results.
 */
import { spawnSync, execSync } from 'child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'fs';
import { createHash } from 'crypto';
import path from 'path';
import { tmpdir } from 'os';
import { fetchGaps, pickBestSlot } from './gaps.js';
import { forkAndPR } from './pr.js';

const SCAFFOLD_URL = 'https://raw.githubusercontent.com/MaTriXy/Skillachi/main/benchmarks/leaderboard-scaffold.json';
const BENCHMARKS_URL = 'https://raw.githubusercontent.com/MaTriXy/Skillachi/main/benchmarks/benchmarks.json';
const SKILLS_URL = 'https://raw.githubusercontent.com/MaTriXy/Skillachi/main/augmented-catalog/skills-augmented.json';

async function fetchJson(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to fetch ${url}: ${resp.status}`);
  return resp.json();
}

function buildScoringPrompt(benchmark, diff) {
  const criteria = (benchmark.judgingCriteria || []).slice(0, 5);
  const criteriaText = criteria.map((c, i) => `${i + 1}. ${c}`).join('\n');
  const truncatedDiff = diff?.slice(0, 8000) || '(no changes)';
  return `You are a code review judge. Score this implementation on each of 5 criteria (1-10 each).

TASK: ${benchmark.requestedChange}

IMPLEMENTATION (git diff):
${truncatedDiff}

JUDGING CRITERIA:
${criteriaText}

Respond ONLY with valid JSON:
{"scores": [s1, s2, s3, s4, s5], "overall": <average>, "notes": "<one sentence>"}`;
}

function parseScore(raw) {
  if (!raw) return null;
  const match = raw.match(/\{"scores"[\s\S]*?\}/);
  if (!match) return null;
  try {
    const obj = JSON.parse(match[0]);
    if (!Array.isArray(obj.scores) || obj.scores.length !== 5) return null;
    if (typeof obj.overall !== 'number') obj.overall = obj.scores.reduce((a, b) => a + b, 0) / 5;
    return obj;
  } catch { return null; }
}

function runCLI(cli, prompt, cwd) {
  const cmds = {
    claude: ['claude', ['-p', prompt, '--dangerously-skip-permissions', '--no-session-persistence']],
    codex: ['codex', ['exec', '--full-auto', prompt]],
    gemini: ['gemini', ['-p', prompt, '-y']],
  };
  const [cmd, args] = cmds[cli];
  const result = spawnSync(cmd, args, { cwd, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  return { output: (result.stdout || '') + (result.stderr || ''), exit: result.status };
}

function captureGitDiff(repoDir) {
  const result = spawnSync('git', ['-C', repoDir, 'diff', 'HEAD'], { encoding: 'utf8' });
  return result.stdout || '';
}

export async function contributeFlow({ slotKey, dryRun = false }) {
  console.log('\nskillachi-runner --contribute');
  console.log('='.repeat(50));

  // 1. Fetch data
  console.log('Fetching benchmark data...');
  const [scaffold, benchmarks, skillsCatalog] = await Promise.all([
    fetchJson(SCAFFOLD_URL),
    fetchJson(BENCHMARKS_URL),
    fetchJson(SKILLS_URL),
  ]);

  // 2. Resolve slot
  let slot;
  if (slotKey) {
    const [benchmarkId, skillId] = slotKey.split(':');
    slot = scaffold.find(s => s.benchmarkId === benchmarkId && s.skillId === skillId);
    if (!slot) { console.error(`Slot not found: ${slotKey}`); process.exit(1); }
  } else {
    const gaps = await fetchGaps();
    slot = pickBestSlot(gaps);
    if (!slot) { console.log('All slots are covered! Nothing to contribute.'); return; }
  }

  const fullSlotKey = `${slot.benchmarkId}:${slot.skillId}`;
  console.log(`\nSelected slot: ${slot.skillName} x ${slot.roleId}`);
  console.log(`  benchmarkId: ${slot.benchmarkId}`);
  console.log(`  skillId:     ${slot.skillId}`);

  // 3. Resolve benchmark
  const benchmark = benchmarks.find(b => b.benchmarkId === slot.benchmarkId);
  if (!benchmark) { console.error('Benchmark not found'); process.exit(1); }

  // 4. Resolve skill content
  const skillEntry = skillsCatalog.find(s => s.id === slot.skillId || s.name === slot.skillName);
  let skillContent = null;
  if (skillEntry?.skillFile) {
    try {
      const rawUrl = `https://raw.githubusercontent.com/${skillEntry.sourceRepo}/main/${skillEntry.skillFile}`;
      const resp = await fetch(rawUrl);
      if (resp.ok) skillContent = await resp.text();
    } catch {}
  }
  if (!skillContent) {
    console.warn('  SKILL.md not found remotely — will run without skill context');
    skillContent = `# ${slot.skillName}\n\nNo SKILL.md available.`;
  }

  if (dryRun) {
    console.log('\n[dry-run] Would:');
    console.log(`  1. Clone ${benchmark.repo} at ${benchmark.baseCommit?.slice(0, 8)}`);
    console.log(`  2. Install skill: ${slot.skillName}`);
    console.log(`  3. Run: claude, codex, gemini`);
    console.log(`  4. Score diffs with all 3 models`);
    console.log(`  5. Fork MaTriXy/Skillachi and open PR`);
    return;
  }

  // 5. Clone repo
  const hash = createHash('sha1').update(fullSlotKey).digest('hex').slice(0, 8);
  const tmpDir = path.join(tmpdir(), `skillachi-${hash}`);
  const repoDir = path.join(tmpDir, 'repo');
  try { rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  mkdirSync(tmpDir, { recursive: true });

  console.log(`\nCloning ${benchmark.repo}...`);
  try {
    execSync(
      `git clone --filter=blob:none --no-checkout https://github.com/${benchmark.repo}.git "${repoDir}"`,
      { stdio: 'pipe', timeout: 120_000 }
    );
    execSync(`git -C "${repoDir}" checkout ${benchmark.baseCommit}`, { stdio: 'pipe', timeout: 60_000 });
  } catch (e) {
    console.error(`Clone failed: ${e.message}`);
    process.exit(1);
  }

  // 6. Run CLIs
  const diffs = {};
  const outputs = {};

  for (const cli of ['claude', 'codex', 'gemini']) {
    console.log(`Running ${cli}...`);

    // Install skill
    const skillDir = path.join(repoDir, `.${cli}`, 'skills', slot.skillName);
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(path.join(skillDir, 'SKILL.md'), skillContent, 'utf8');

    // Reset repo
    try { execSync(`git -C "${repoDir}" checkout -- .`, { stdio: 'pipe' }); } catch {}
    try { execSync(`git -C "${repoDir}" clean -fd`, { stdio: 'pipe' }); } catch {}

    const { output, exit: exitCode } = runCLI(cli, benchmark.requestedChange, repoDir);
    console.log(`  ${cli}: exit=${exitCode}`);
    outputs[cli] = output;
    diffs[cli] = captureGitDiff(repoDir);
  }

  // 7. Score
  console.log('\nScoring...');
  const scores = {};
  for (const cli of ['claude', 'codex', 'gemini']) {
    const prompt = buildScoringPrompt(benchmark, diffs[cli]);
    const { output } = runCLI('claude', prompt, process.cwd());
    scores[cli] = parseScore(output);
    console.log(`  ${cli} score: ${scores[cli]?.overall ?? 'parse failed'}`);
  }

  const available = ['claude', 'codex', 'gemini'].filter(c => scores[c]);
  const avgOverall = available.length
    ? available.reduce((s, c) => s + scores[c].overall, 0) / available.length
    : null;

  const scoreResult = {
    claude: scores.claude,
    codex: scores.codex,
    gemini: scores.gemini,
    average: avgOverall != null ? { overall: parseFloat(avgOverall.toFixed(2)) } : null,
    scoredAt: new Date().toISOString(),
  };

  // 8. Open PR
  console.log('\nOpening PR...');
  const { prUrl, success } = await forkAndPR({
    benchmarkId: slot.benchmarkId,
    skillId: slot.skillId,
    skillName: slot.skillName,
    roleId: slot.roleId,
    scoreResult,
    diffs,
  });

  // 9. Cleanup
  try { rmSync(tmpDir, { recursive: true, force: true }); } catch {}

  if (success) {
    console.log(`\nDone! PR: ${prUrl}`);
  } else {
    console.log('\nBenchmark complete but PR could not be opened automatically.');
    console.log('Score:', JSON.stringify(scoreResult.average));
  }
}
