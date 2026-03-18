#!/usr/bin/env node
/**
 * skillachi-runner — Run Skillachi benchmarks and auto-contribute results
 *
 * Usage:
 *   npx skillachi-runner --contribute         # pick uncovered slot, run, open PR
 *   npx skillachi-runner --gaps               # show gap report
 *   npx skillachi-runner --slot <id>          # run specific slot (benchmarkId:skillId)
 *   npx skillachi-runner --dry-run            # preview without executing
 *   npx skillachi-runner --help               # show this help
 */

import { fetchAndPrintGaps } from '../lib/gaps.js';
import { contributeFlow } from '../lib/contribute.js';

const args = process.argv.slice(2);

if (args.includes('--help') || args.length === 0) {
  console.log(`
skillachi-runner — Run Skillachi benchmarks and contribute results

Usage:
  npx skillachi-runner --contribute         Pick an uncovered slot, run all 3 CLIs, open PR
  npx skillachi-runner --gaps               Show coverage gap report
  npx skillachi-runner --slot <id>          Run a specific slot (benchmarkId:skillId)
  npx skillachi-runner --dry-run            Preview what would run, no CLIs invoked
  npx skillachi-runner --help               Show this help

Prerequisites:
  - claude, codex, and gemini CLIs installed and authenticated
  - gh CLI installed and authenticated (gh auth login)

Examples:
  npx skillachi-runner --contribute
  npx skillachi-runner --slot my-benchmark-id:my-skill-id --dry-run
  npx skillachi-runner --gaps
`);
  process.exit(0);
}

const DRY_RUN = args.includes('--dry-run');
const SLOT_IDX = args.indexOf('--slot');
const SLOT = SLOT_IDX >= 0 ? args[SLOT_IDX + 1] : null;

if (args.includes('--gaps')) {
  await fetchAndPrintGaps();
  process.exit(0);
}

if (args.includes('--contribute') || SLOT) {
  await contributeFlow({ slotKey: SLOT, dryRun: DRY_RUN });
  process.exit(0);
}

console.error('Unknown arguments. Run with --help for usage.');
process.exit(1);
