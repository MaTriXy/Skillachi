#!/usr/bin/env node
/**
 * Skillachi Benchmark Runner
 * Runs AI coding benchmarks for each (benchmark, skill) slot in the leaderboard.
 *
 * Usage:
 *   node runner/run.js                    # run all pending slots
 *   node runner/run.js --dry-run          # skip CLI execution, log what would happen
 *   node runner/run.js --limit 5          # run only 5 slots
 *   node runner/run.js --slot sk123:bm456 # run single slot by benchmarkId:skillId
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, copyFileSync } from 'fs';
import { createHash } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync, spawnSync } from 'child_process';
import { findSkillPath, readSkillContent } from './find-skill.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = path.resolve(__dirname, '..');

// --- CLI args ---
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const LIMIT_IDX = args.indexOf('--limit');
const LIMIT = LIMIT_IDX >= 0 ? parseInt(args[LIMIT_IDX + 1], 10) : Infinity;
const SLOT_IDX = args.indexOf('--slot');
const SLOT_FILTER = SLOT_IDX >= 0 ? args[SLOT_IDX + 1] : null; // "benchmarkId:skillId"

// --- Paths ---
const SCAFFOLD_PATH = path.join(PROJECT_DIR, 'benchmarks', 'leaderboard-scaffold.json');
const BENCHMARKS_PATH = path.join(PROJECT_DIR, 'benchmarks', 'benchmarks.json');
const LEADERBOARD_PATH = path.join(PROJECT_DIR, 'benchmarks', 'leaderboard.json');
const PROGRESS_PATH = path.join(PROJECT_DIR, 'runner', 'progress.json');

// --- Load data ---
const scaffold = JSON.parse(readFileSync(SCAFFOLD_PATH, 'utf8'));
const benchmarks = JSON.parse(readFileSync(BENCHMARKS_PATH, 'utf8'));
const benchmarkMap = Object.fromEntries(benchmarks.map(b => [b.benchmarkId, b]));

// Resume-safe progress
let progress = {};
if (existsSync(PROGRESS_PATH)) {
  try { progress = JSON.parse(readFileSync(PROGRESS_PATH, 'utf8')); } catch {}
}

// Leaderboard (start from scaffold or existing)
let leaderboard = [];
if (existsSync(LEADERBOARD_PATH)) {
  try { leaderboard = JSON.parse(readFileSync(LEADERBOARD_PATH, 'utf8')); } catch {}
}
if (!leaderboard.length) leaderboard = JSON.parse(JSON.stringify(scaffold));

function saveProgress() {
  writeFileSync(PROGRESS_PATH, JSON.stringify(progress, null, 2));
}
function saveLeaderboard() {
  writeFileSync(LEADERBOARD_PATH, JSON.stringify(leaderboard, null, 2));
}

// --- Filter pending slots ---
let slots = scaffold.filter(slot => {
  const key = `${slot.benchmarkId}:${slot.skillId}`;
  if (SLOT_FILTER && key !== SLOT_FILTER) return false;
  if (progress[key]?.status === 'done') return false;
  return true;
});
if (Number.isFinite(LIMIT)) slots = slots.slice(0, LIMIT);

console.log(`\nSkillachi Runner ${DRY_RUN ? '[DRY RUN] ' : ''}--- ${slots.length} slots pending\n`);

// --- Timing ---
const times = [];
const startAll = Date.now();

// --- Run each slot ---
for (let i = 0; i < slots.length; i++) {
  const slot = slots[i];
  const slotKey = `${slot.benchmarkId}:${slot.skillId}`;
  const benchmark = benchmarkMap[slot.benchmarkId];

  if (!benchmark) {
    console.warn(`  Benchmark not found: ${slot.benchmarkId} --- skipping`);
    progress[slotKey] = { status: 'error', error: 'benchmark not found', at: new Date().toISOString() };
    saveProgress();
    continue;
  }

  const skillContent = readSkillContent(slot.skillId, slot.skillName);
  if (!skillContent) {
    console.warn(`  SKILL.md not found: ${slot.skillId} / ${slot.skillName} --- skipping`);
    progress[slotKey] = { status: 'skipped', error: 'skill not found', at: new Date().toISOString() };
    saveProgress();
    continue;
  }

  const slotStart = Date.now();
  const slotHash = createHash('sha1').update(`${slot.benchmarkId}:${slot.skillId}`).digest('hex').slice(0, 8);
  const tmpDir = `/tmp/skillachi-${slotHash}`;
  const repoDir = path.join(tmpDir, 'repo');

  console.log(`\n[${i + 1}/${slots.length}] ${slot.skillName} x ${slot.benchmarkId}`);
  console.log(`  repo: ${benchmark.repo}  commit: ${benchmark.baseCommit?.slice(0, 8)}`);

  if (DRY_RUN) {
    console.log(`  [dry-run] would clone ${benchmark.repo} -> ${repoDir}`);
    console.log(`  [dry-run] would install skill: ${slot.skillName}`);
    console.log(`  [dry-run] would run: claude, codex, gemini`);
    progress[slotKey] = { status: 'dry-run', at: new Date().toISOString() };
    saveProgress();
    continue;
  }

  try {
    // Clean any prior temp dir
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch {}
    mkdirSync(tmpDir, { recursive: true });

    // Clone
    console.log(`  Cloning...`);
    execSync(
      `git clone --filter=blob:none --no-checkout https://github.com/${benchmark.repo}.git "${repoDir}"`,
      { stdio: 'pipe', timeout: 120_000 }
    );
    execSync(`git -C "${repoDir}" checkout ${benchmark.baseCommit}`, { stdio: 'pipe', timeout: 60_000 });

    const diffs = {};
    const outputs = {};

    // Run each CLI
    for (const cli of ['claude', 'codex', 'gemini']) {
      console.log(`  Running ${cli}...`);

      // Install skill into isolated locations
      const skillDirs = {
        claude: path.join(repoDir, '.claude', 'skills', slot.skillName),
        codex: path.join(repoDir, '.codex', 'skills', slot.skillName),
        gemini: path.join(repoDir, '.gemini', 'skills', slot.skillName),
      };
      const skillDir = skillDirs[cli];
      mkdirSync(skillDir, { recursive: true });
      writeFileSync(path.join(skillDir, 'SKILL.md'), skillContent, 'utf8');

      // Reset repo to clean state before each CLI run
      try { execSync(`git -C "${repoDir}" checkout -- .`, { stdio: 'pipe' }); } catch {}
      try { execSync(`git -C "${repoDir}" clean -fd`, { stdio: 'pipe' }); } catch {}

      // Build prompt
      const prompt = benchmark.requestedChange;

      // Run CLI
      const cliStart = Date.now();
      let cliResult;
      try {
        if (cli === 'claude') {
          cliResult = spawnSync(
            'claude',
            ['-p', prompt, '--dangerously-skip-permissions', '--no-session-persistence'],
            { cwd: repoDir, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
          );
        } else if (cli === 'codex') {
          cliResult = spawnSync(
            'codex',
            ['exec', prompt, '--approval-mode=full-auto'],
            { cwd: repoDir, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
          );
        } else if (cli === 'gemini') {
          cliResult = spawnSync(
            'gemini',
            ['-p', prompt, '--sandbox=false'],
            { cwd: repoDir, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
          );
        }
      } catch (e) {
        console.warn(`    ${cli} crashed: ${e.message}`);
        outputs[cli] = `ERROR: ${e.message}`;
        diffs[cli] = '';
        continue;
      }

      const elapsed = ((Date.now() - cliStart) / 1000).toFixed(1);
      console.log(`    ${cli}: done in ${elapsed}s (exit=${cliResult?.status})`);

      outputs[cli] = (cliResult?.stdout || '') + (cliResult?.stderr || '');

      // Capture diff
      try {
        const diffResult = spawnSync(
          'git', ['-C', repoDir, 'diff', 'HEAD'],
          { encoding: 'utf8', timeout: 30_000 }
        );
        diffs[cli] = diffResult.stdout || '';
      } catch {
        diffs[cli] = '';
      }

      // Save raw output files
      try {
        writeFileSync(path.join(tmpDir, `${cli}-output.txt`), outputs[cli], 'utf8');
        writeFileSync(path.join(tmpDir, `${cli}-diff.txt`), diffs[cli], 'utf8');
      } catch {}
    }

    // Score the run
    let scoreResult = null;
    try {
      const { scoreSlot } = await import('./score.js');
      scoreResult = await scoreSlot({ benchmark, diffs, outputs });
    } catch (e) {
      console.warn(`  Scoring failed: ${e.message}`);
    }

    // Update leaderboard
    const lbIdx = leaderboard.findIndex(s =>
      s.benchmarkId === slot.benchmarkId && s.skillId === slot.skillId
    );
    if (lbIdx >= 0 && scoreResult) {
      leaderboard[lbIdx] = {
        ...leaderboard[lbIdx],
        score: scoreResult.average?.overall ?? null,
        scoreDetail: scoreResult,
        runAt: new Date().toISOString(),
      };
    }
    saveLeaderboard();

    progress[slotKey] = { status: 'done', at: new Date().toISOString() };
    saveProgress();

    const elapsed = ((Date.now() - slotStart) / 1000).toFixed(1);
    times.push(parseFloat(elapsed));
    const avgTime = (times.reduce((a, b) => a + b, 0) / times.length).toFixed(0);
    const remaining = slots.length - i - 1;
    const etaMin = ((remaining * avgTime) / 60).toFixed(0);
    console.log(`  done in ${elapsed}s | avg: ${avgTime}s | ETA: ${etaMin}min`);

  } catch (err) {
    console.error(`  Error: ${err.message}`);
    progress[slotKey] = { status: 'error', error: err.message, at: new Date().toISOString() };
    saveProgress();
  } finally {
    // Cleanup temp dir
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
}

// --- Summary ---
const totalMin = ((Date.now() - startAll) / 60000).toFixed(1);
const done = Object.values(progress).filter(p => p.status === 'done').length;
const errors = Object.values(progress).filter(p => p.status === 'error').length;
const skipped = Object.values(progress).filter(p => p.status === 'skipped').length;

console.log(`\n---------------------------------------------`);
console.log(`Done: ${done}  Errors: ${errors}  Skipped: ${skipped}`);
console.log(`Total time: ${totalMin}min`);
console.log(`Leaderboard: ${LEADERBOARD_PATH}`);
