/**
 * Skillachi Leaderboard — Data Loader
 * Fetches leaderboard.json and renders the sortable table.
 */

const LEADERBOARD_URLS = [
  '../benchmarks/leaderboard.json',
  '../benchmarks/leaderboard-scaffold.json',
];

async function fetchLeaderboard() {
  for (const url of LEADERBOARD_URLS) {
    try {
      const resp = await fetch(url);
      if (resp.ok) return await resp.json();
    } catch {}
  }
  return [];
}

function scoreColor(score) {
  if (score == null) return '#888';
  if (score >= 7) return '#4ade80';   // green
  if (score >= 5) return '#facc15';   // yellow
  return '#f87171';                    // red
}

function scoreDisplay(score) {
  if (score == null) return '<span style="color:#666">—</span>';
  const color = scoreColor(score);
  return `<span style="color:${color};font-weight:600">${score.toFixed(1)}</span>`;
}

function groupBySkill(slots) {
  const map = new Map();
  for (const slot of slots) {
    const key = slot.skillId || slot.skillName || '';
    if (!map.has(key)) {
      map.set(key, {
        skillId: key,
        skillName: slot.skillName || key,
        roleId: slot.roleId || '',
        slots: [],
        claude: null, codex: null, gemini: null, avg: null,
        runCount: 0, lastRun: null,
      });
    }
    const entry = map.get(key);
    entry.slots.push(slot);

    const s = slot.scores || {};
    if (s.claude?.overall != null) entry.claude = s.claude.overall;
    if (s.codex?.overall != null) entry.codex = s.codex.overall;
    if (s.gemini?.overall != null) entry.gemini = s.gemini.overall;
    if (slot.runAt) {
      if (!entry.lastRun || slot.runAt > entry.lastRun) entry.lastRun = slot.runAt;
    }
    if (slot.score != null) entry.runCount++;
  }

  // Calculate average
  for (const entry of map.values()) {
    const vals = [entry.claude, entry.codex, entry.gemini].filter(v => v != null);
    entry.avg = vals.length ? parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2)) : null;
  }

  return Array.from(map.values());
}

let allData = [];
let currentSort = { col: 'avg', dir: -1 };
let roleFilter = '';
let modelFilter = 'all';
let minScore = 0;

function applyFilters(data) {
  return data.filter(row => {
    if (roleFilter && row.roleId !== roleFilter) return false;
    if (minScore > 0 && (row.avg == null || row.avg < minScore)) return false;
    if (modelFilter !== 'all') {
      const v = row[modelFilter];
      if (v == null && minScore > 0) return false;
    }
    return true;
  });
}

function sortData(data) {
  const { col, dir } = currentSort;
  return [...data].sort((a, b) => {
    const va = a[col] ?? -999;
    const vb = b[col] ?? -999;
    if (typeof va === 'string') return dir * va.localeCompare(vb);
    return dir * (va - vb);
  });
}

function renderTable(data) {
  const tbody = document.getElementById('lb-tbody');
  if (!tbody) return;

  const filtered = applyFilters(data);
  const sorted = sortData(filtered);

  if (sorted.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#666;padding:2rem">No results match your filters</td></tr>';
    return;
  }

  tbody.innerHTML = sorted.map((row, i) => `
    <tr class="lb-row" data-skill="${row.skillId}" style="cursor:pointer">
      <td style="color:#e2e8f0">${row.skillName}</td>
      <td style="color:#94a3b8;font-size:0.85em">${row.roleId || '—'}</td>
      <td style="text-align:center">${scoreDisplay(row.claude)}</td>
      <td style="text-align:center">${scoreDisplay(row.codex)}</td>
      <td style="text-align:center">${scoreDisplay(row.gemini)}</td>
      <td style="text-align:center;font-size:1.1em">${scoreDisplay(row.avg)}</td>
      <td style="text-align:center;color:#94a3b8">${row.runCount}</td>
      <td style="text-align:center;color:#64748b;font-size:0.8em">${row.lastRun ? new Date(row.lastRun).toLocaleDateString() : '—'}</td>
    </tr>
    <tr class="lb-detail" id="detail-${i}" style="display:none">
      <td colspan="8" style="background:#0f172a;padding:1rem 2rem">
        <strong style="color:#94a3b8">Benchmarks for ${row.skillName}:</strong>
        <ul style="margin:0.5rem 0 0;color:#64748b;font-size:0.85em">
          ${row.slots.map(s => `<li>${s.benchmarkId} — score: ${s.score != null ? s.score.toFixed(1) : '—'} ${s.runAt ? '(' + new Date(s.runAt).toLocaleDateString() + ')' : ''}</li>`).join('')}
        </ul>
      </td>
    </tr>
  `).join('');

  // Row click expand
  document.querySelectorAll('.lb-row').forEach((row, i) => {
    row.addEventListener('click', () => {
      const detail = document.getElementById(`detail-${i}`);
      if (detail) detail.style.display = detail.style.display === 'none' ? '' : 'none';
    });
  });
}

function updateStats(data) {
  const scored = data.filter(r => r.avg != null);
  const avgScore = scored.length ? (scored.reduce((a, b) => a + (b.avg || 0), 0) / scored.length).toFixed(2) : '—';
  const el = document.getElementById('stats-bar');
  if (el) {
    el.innerHTML = `
      <span>${data.length} skills</span>
      <span>|</span>
      <span>${scored.length} scored</span>
      <span>|</span>
      <span>avg score: <strong style="color:#4ade80">${avgScore}</strong></span>
    `;
  }
}

function setupSortHeaders() {
  document.querySelectorAll('[data-sort]').forEach(th => {
    th.style.cursor = 'pointer';
    th.addEventListener('click', () => {
      const col = th.dataset.sort;
      if (currentSort.col === col) {
        currentSort.dir *= -1;
      } else {
        currentSort = { col, dir: -1 };
      }
      renderTable(allData);
    });
  });
}

function setupFilters(data) {
  // Populate role dropdown
  const roles = [...new Set(data.map(r => r.roleId).filter(Boolean))].sort();
  const roleSelect = document.getElementById('filter-role');
  if (roleSelect) {
    roleSelect.innerHTML = '<option value="">All roles</option>' +
      roles.map(r => `<option value="${r}">${r}</option>`).join('');
    roleSelect.addEventListener('change', e => { roleFilter = e.target.value; renderTable(allData); });
  }

  // Model filter
  document.querySelectorAll('[data-model-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      modelFilter = btn.dataset.modelFilter;
      document.querySelectorAll('[data-model-filter]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderTable(allData);
    });
  });

  // Min score slider
  const slider = document.getElementById('filter-score');
  const sliderLabel = document.getElementById('filter-score-label');
  if (slider) {
    slider.addEventListener('input', e => {
      minScore = parseFloat(e.target.value);
      if (sliderLabel) sliderLabel.textContent = minScore === 0 ? 'Any' : `≥ ${minScore}`;
      renderTable(allData);
    });
  }
}

async function init() {
  const raw = await fetchLeaderboard();
  allData = groupBySkill(raw);
  updateStats(allData);
  setupSortHeaders();
  setupFilters(allData);
  renderTable(allData);

  // Update last-updated
  const lastUpdated = document.getElementById('last-updated');
  if (lastUpdated) {
    const latest = allData.map(r => r.lastRun).filter(Boolean).sort().pop();
    lastUpdated.textContent = latest ? `Updated ${new Date(latest).toLocaleDateString()}` : 'No runs yet';
  }
}

document.addEventListener('DOMContentLoaded', init);
