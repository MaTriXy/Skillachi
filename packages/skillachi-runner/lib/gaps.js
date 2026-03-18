/**
 * Gap detection — fetches gaps.json from GitHub and picks best uncovered slot.
 */

const GAPS_URL = 'https://raw.githubusercontent.com/MaTriXy/Skillachi/main/benchmarks/gaps.json';
const SCAFFOLD_URL = 'https://raw.githubusercontent.com/MaTriXy/Skillachi/main/benchmarks/leaderboard-scaffold.json';

export async function fetchGaps() {
  try {
    const resp = await fetch(GAPS_URL);
    if (resp.ok) return await resp.json();
  } catch {}
  // Fallback: derive gaps from scaffold (all slots = uncovered)
  try {
    const resp = await fetch(SCAFFOLD_URL);
    if (resp.ok) {
      const scaffold = await resp.json();
      const byRole = {};
      for (const slot of scaffold) {
        const role = slot.roleId || 'unknown';
        if (!byRole[role]) byRole[role] = { total: 0, allModels: 0, uncoveredCount: 0, uncovered: [] };
        byRole[role].total++;
        byRole[role].uncoveredCount++;
        byRole[role].uncovered.push({ benchmarkId: slot.benchmarkId, skillId: slot.skillId, skillName: slot.skillName });
      }
      return {
        generatedAt: new Date().toISOString(),
        totalSlots: scaffold.length,
        totalUncovered: scaffold.length,
        totalCovered: 0,
        coveragePercent: 0,
        byRole,
      };
    }
  } catch {}
  return null;
}

export async function fetchAndPrintGaps() {
  console.log('Fetching gap report from Skillachi...');
  const gaps = await fetchGaps();
  if (!gaps) {
    console.error('Could not fetch gap data. Check your internet connection.');
    return;
  }
  console.log('\nSkillachi Gap Report');
  console.log('='.repeat(50));
  console.log(`Total slots:  ${gaps.totalSlots}`);
  console.log(`Covered:      ${gaps.totalCovered} (${gaps.coveragePercent}%)`);
  console.log(`Uncovered:    ${gaps.totalUncovered}`);
  console.log('\nTop roles with gaps:');
  Object.entries(gaps.byRole)
    .filter(([, d]) => d.uncoveredCount > 0)
    .sort((a, b) => b[1].uncoveredCount - a[1].uncoveredCount)
    .slice(0, 10)
    .forEach(([role, d]) => console.log(`  ${role}: ${d.uncoveredCount} uncovered`));
}

/**
 * Pick the best uncovered slot to run next.
 * Prefers roles with most uncovered slots (most need).
 */
export function pickBestSlot(gaps) {
  if (!gaps) return null;
  const sorted = Object.entries(gaps.byRole)
    .filter(([, d]) => d.uncovered?.length > 0)
    .sort((a, b) => b[1].uncoveredCount - a[1].uncoveredCount);
  if (!sorted.length) return null;
  const [roleId, roleData] = sorted[0];
  const slot = roleData.uncovered[0];
  return { ...slot, roleId };
}
