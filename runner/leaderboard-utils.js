/**
 * Leaderboard utilities — read/write/aggregate scores in benchmarks/leaderboard.json
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = path.resolve(__dirname, '..');

const LEADERBOARD_PATH = path.join(PROJECT_DIR, 'benchmarks', 'leaderboard.json');
const SCAFFOLD_PATH = path.join(PROJECT_DIR, 'benchmarks', 'leaderboard-scaffold.json');

/**
 * Read leaderboard.json, falling back to leaderboard-scaffold.json.
 */
export function readLeaderboard() {
  if (existsSync(LEADERBOARD_PATH)) {
    try { return JSON.parse(readFileSync(LEADERBOARD_PATH, 'utf8')); } catch {}
  }
  return JSON.parse(readFileSync(SCAFFOLD_PATH, 'utf8'));
}

/**
 * Write leaderboard to disk.
 */
export function writeLeaderboard(data) {
  writeFileSync(LEADERBOARD_PATH, JSON.stringify(data, null, 2));
}

/**
 * Update a single slot's score in the leaderboard.
 */
export function writeScore(benchmarkId, skillId, cliName, scoreResult) {
  const lb = readLeaderboard();
  const idx = lb.findIndex(s => s.benchmarkId === benchmarkId && s.skillId === skillId);
  if (idx < 0) return;

  if (!lb[idx].scores) lb[idx].scores = {};
  lb[idx].scores[cliName] = scoreResult;

  // Update overall score (average across available models)
  const models = ['claude', 'codex', 'gemini'];
  const available = models.filter(m => lb[idx].scores?.[m]?.overall != null);
  if (available.length > 0) {
    lb[idx].score = parseFloat(
      (available.reduce((sum, m) => sum + lb[idx].scores[m].overall, 0) / available.length).toFixed(2)
    );
  }
  lb[idx].runAt = new Date().toISOString();

  writeLeaderboard(lb);
}

/**
 * Get aggregate stats: per-role and per-skill summaries.
 */
export function getStats() {
  const lb = readLeaderboard();
  const scored = lb.filter(s => s.score != null);

  const byRole = {};
  const bySkill = {};

  for (const slot of scored) {
    // By role
    if (!byRole[slot.roleId]) byRole[slot.roleId] = { count: 0, totalScore: 0 };
    byRole[slot.roleId].count++;
    byRole[slot.roleId].totalScore += slot.score;

    // By skill
    const key = slot.skillId || slot.skillName;
    if (!bySkill[key]) bySkill[key] = { skillName: slot.skillName, count: 0, totalScore: 0 };
    bySkill[key].count++;
    bySkill[key].totalScore += slot.score;
  }

  // Calculate averages
  for (const role of Object.values(byRole)) role.avgScore = parseFloat((role.totalScore / role.count).toFixed(2));
  for (const skill of Object.values(bySkill)) skill.avgScore = parseFloat((skill.totalScore / skill.count).toFixed(2));

  return {
    totalSlots: lb.length,
    scoredSlots: scored.length,
    pendingSlots: lb.length - scored.length,
    byRole,
    bySkill,
  };
}
