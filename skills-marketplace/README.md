# Skills Marketplace Workspace

This workspace pulls together your GitHub skill sources for curation.

Current snapshot:
- `8,297` GitHub repos inventoried
- `86` skill repos cloned after exclusions
- `4,561` skill directories aggregated into one folder

Key paths:
- Aggregated skills: `./skills`
- Source repos: `./sources`
- Inventory files: `./inventory`

Exclusions applied:
- `MaTriXy/auto-skill`
- `MaTriXy/Agent-Registry`

Useful inventory files:
- `./inventory/summary.json`
- `./inventory/all-repos.json`
- `./inventory/skill-repos.json`
- `./inventory/skills-manifest.json`
- `./inventory/repo-skill-counts.tsv`

Aggregation layout:
- Each repo is cloned into `./sources/<repo>`
- Each discovered skill directory is copied into `./skills/<repo>/<path-in-repo>`

Notes:
- This is a raw import for cleanup and curation, not a deduplicated marketplace yet.
- Some upstream repos are very large or noisy and may contain many generated or overlapping skill folders.
