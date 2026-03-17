// find-skill.js — finds the SKILL.md path for a given skill
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = path.resolve(__dirname, '..');

let _catalog = null;

function getCatalog() {
  if (_catalog) return _catalog;
  const p = path.join(PROJECT_DIR, 'augmented-catalog', 'skills-augmented.json');
  _catalog = JSON.parse(readFileSync(p, 'utf8'));
  return _catalog;
}

/**
 * Find SKILL.md path for a skill by skillId or skillName.
 * Returns absolute path to SKILL.md, or null if not found.
 */
export function findSkillPath(skillId, skillName) {
  // First try direct path in skills-marketplace/skills/<skillName>/SKILL.md
  if (skillName) {
    const directPath = path.join(PROJECT_DIR, 'skills-marketplace', 'skills', skillName, 'SKILL.md');
    if (existsSync(directPath)) return directPath;
  }

  // Look up in catalog
  const catalog = getCatalog();
  const entry = catalog.find(s =>
    (skillId && (s.id === skillId || s.skillId === skillId)) ||
    (skillName && (s.name === skillName || s.skillName === skillName || s.id === skillName))
  );

  if (!entry) return null;

  // Try skills-marketplace/skills/<name>/SKILL.md
  const name = entry.name || entry.skillName || entry.id;
  if (name) {
    const p = path.join(PROJECT_DIR, 'skills-marketplace', 'skills', name, 'SKILL.md');
    if (existsSync(p)) return p;
  }

  // Try skillFile field
  if (entry.skillFile) {
    const p = path.join(PROJECT_DIR, 'skills-marketplace', entry.skillFile);
    if (existsSync(p)) return p;
  }

  return null;
}

/**
 * Read SKILL.md content for a skill. Returns string or null.
 */
export function readSkillContent(skillId, skillName) {
  const p = findSkillPath(skillId, skillName);
  if (!p) return null;
  try { return readFileSync(p, 'utf8'); } catch { return null; }
}
