/**
 * Skillachi Claim System
 * Coordinates benchmark slot claims via GitHub Issues to prevent duplicate work.
 * All functions are best-effort — errors are caught and ignored so the claim
 * system never blocks a benchmark run.
 */
import { spawnSync } from 'child_process';

const REPO = 'MaTriXy/Skillachi';

function gh(args, opts = {}) {
  const result = spawnSync('gh', args, {
    encoding: 'utf8',
    timeout: 30_000,
    ...opts,
  });
  if (result.error || result.status !== 0) return null;
  return result.stdout?.trim() || '';
}

/**
 * Check if a slot is already claimed (open [claim] issue exists).
 * Returns the issue number if claimed, null otherwise.
 */
export function isSlotClaimed(slotKey) {
  try {
    const out = gh([
      'issue', 'list',
      '--repo', REPO,
      '--label', 'benchmark-claim',
      '--state', 'open',
      '--json', 'number,title',
      '--limit', '200',
    ]);
    if (!out) return null;
    const issues = JSON.parse(out);
    const found = issues.find(i => i.title.includes(slotKey));
    return found ? found.number : null;
  } catch {
    return null;
  }
}

/**
 * Open a claim issue for a slot.
 * Returns the issue number, or null on failure.
 */
export function claimSlot(slotKey, skillName, runnerInfo = '') {
  try {
    const body = [
      `**Slot:** ${slotKey}`,
      `**Skill:** ${skillName}`,
      `**Runner:** ${runnerInfo || 'unknown'}`,
      '',
      'This claim will auto-expire in 48 hours if no PR is opened.',
    ].join('\n');

    const out = gh([
      'issue', 'create',
      '--repo', REPO,
      '--title', `[claim] ${slotKey}`,
      '--label', 'benchmark-claim',
      '--body', body,
    ]);
    if (!out) return null;
    const match = out.match(/issues\/(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  } catch {
    return null;
  }
}

/**
 * Close a claim issue after a PR is opened.
 */
export function releaseClaim(issueNumber, prUrl = '') {
  try {
    const comment = prUrl
      ? `PR opened: ${prUrl} — closing claim.`
      : 'Benchmark complete — closing claim.';
    gh([
      'issue', 'close', String(issueNumber),
      '--repo', REPO,
      '--comment', comment,
    ]);
  } catch {
    // best-effort
  }
}
