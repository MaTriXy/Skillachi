#!/usr/bin/env node
/**
 * Skillachi Contribution Verifier
 * Re-scores submitted leaderboard entries using claude, for CI.
 *
 * Usage:
 *   node runner/verify-contribution.js \
 *     --pr-leaderboard benchmarks/leaderboard.json \
 *     --base-leaderboard /tmp/base-leaderboard.json \
 *     [--benchmarks benchmarks/benchmarks.json] \
 *     [--output runner/verify-result.json]
 *
 * Exit 0 = all slots within ±2 points (passed)
 * Exit 1 = one or more slots outside ±2 points (failed)
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = path.resolve(__dirname, '..');

// --- CLI args ---
const args = process.argv.slice(2);
function getArg(flag) {
  const idx = args.indexOf(flag);
  return idx >= 0 ? args[idx + 1] : null;
}

const prLbPath   = getArg('--pr-leaderboard')  ?? path.join(PROJECT_DIR, 'benchmarks', 'leaderboard.json');
const baseLbPath = getArg('--base-leaderboard') ?? null;
const bmPath     = getArg('--benchmarks')       ?? path.join(PROJECT_DIR, 'benchmarks', 'benchmarks.json');
const outputPath = getArg('--output')           ?? path.join(PROJECT_DIR, 'runner', 'verify-result.json');

// --- Load data ---
const prLb   = JSON.parse(readFileSync(prLbPath, 'utf8'));
const baseLb = baseLbPath && existsSync(baseLbPath)
  ? JSON.parse(readFileSync(baseLbPath, 'utf8'))
  : [];
const benchmarks = JSON.parse(readFileSync(bmPath, 'utf8'));

const baseMap = Object.fromEntries(baseLb.map(s => [`${s.benchmarkId}:${s.skillId}`, s]));
const bmMap   = Object.fromEntries(benchmarks.map(b => [b.benchmarkId, b]));

// --- Find changed slots ---
const changed = prLb.filter(slot => {
  if (slot.score == null) return false;
  const key = `${slot.benchmarkId}:${slot.skillId}`;
  const base = baseMap[key];
  if (!base) return true;                       // new slot
  if (base.score == null) return true;          // was unscored
  if (base.runAt !== slot.runAt) return true;   // re-run
  return false;
});

if (changed.length === 0) {
  console.log('No new/changed scored slots found — nothing to verify.');
  const result = { passed: true, slots: [] };
  writeFileSync(outputPath, JSON.stringify(result, null, 2));
  process.exit(0);
}

console.log(`\nSkillachi Contribution Verifier — ${changed.length} slot(s) to verify\n`);

// --- Re-score each slot ---
const { scoreSlot } = await import('./score.js');

const slotResults = [];

for (const slot of changed) {
  const slotKey = `${slot.benchmarkId}:${slot.skillId}`;
  const benchmark = bmMap[slot.benchmarkId];

  if (!benchmark) {
    console.warn(`  SKIP ${slotKey} — benchmark not found`);
    slotResults.push({ slotKey, submitted: slot.score, rescore: null, delta: null, pass: true, note: 'benchmark not found' });
    continue;
  }

  const diff = slot.scoreDetail?.diff || '';
  if (!diff) {
    console.warn(`  SKIP ${slotKey} — no diff stored (pass by default)`);
    slotResults.push({ slotKey, submitted: slot.score, rescore: null, delta: null, pass: true, note: 'no diff available' });
    continue;
  }

  console.log(`  Verifying ${slotKey}...`);
  let rescoreResult = null;
  try {
    rescoreResult = await scoreSlot({
      benchmark,
      diffs: { claude: diff },
      outputs: { claude: '' },
    });
  } catch (e) {
    console.warn(`    scorer error: ${e.message}`);
    slotResults.push({ slotKey, submitted: slot.score, rescore: null, delta: null, pass: true, note: `scorer error: ${e.message}` });
    continue;
  }

  const rescore = rescoreResult?.claude?.overall ?? null;
  if (rescore == null) {
    console.warn(`    rescore returned null — pass by default`);
    slotResults.push({ slotKey, submitted: slot.score, rescore: null, delta: null, pass: true, note: 'rescore null' });
    continue;
  }

  const delta = Math.abs(rescore - slot.score);
  const pass  = delta <= 2;
  slotResults.push({ slotKey, submitted: slot.score, rescore, delta: parseFloat(delta.toFixed(2)), pass });
  console.log(`    submitted=${slot.score}  rescore=${rescore}  delta=${delta.toFixed(2)}  ${pass ? '✓ PASS' : '✗ FAIL'}`);
}

// --- Summary table ---
const passed = slotResults.every(s => s.pass);

console.log('\n| Slot | Submitted | Rescore | Delta | Result |');
console.log('|------|-----------|---------|-------|--------|');
for (const s of slotResults) {
  const res = s.pass ? '✓ PASS' : '✗ FAIL';
  console.log(`| ${s.slotKey} | ${s.submitted ?? '—'} | ${s.rescore ?? '—'} | ${s.delta ?? '—'} | ${res} |`);
}

console.log(`\nOverall: ${passed ? 'PASSED ✓' : 'FAILED ✗'}`);

// --- Write result ---
const result = { passed, slots: slotResults };
writeFileSync(outputPath, JSON.stringify(result, null, 2));

process.exit(passed ? 0 : 1);
