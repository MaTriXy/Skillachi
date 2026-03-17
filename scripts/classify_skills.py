#!/usr/bin/env python3

from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from pathlib import Path


ROOT = Path("/Users/matrixy/Dev/bpro.dev/skills-marketplace")
RAW_SKILLS_DIR = ROOT / "skills"
MARKETPLACE_DIR = ROOT / "marketplace"
CATALOG_DIR = MARKETPLACE_DIR / "catalog"
CATEGORIES_DIR = MARKETPLACE_DIR / "categories"


CATEGORIES = [
    {
        "slug": "swift-ios-apple",
        "title": "Swift / Apple",
        "description": "Swift, SwiftUI, iOS, macOS, visionOS, and Apple platform development.",
        "signals": {
            "swift": 6,
            "swiftui": 7,
            "ios": 6,
            "macos": 6,
            "xcode": 6,
            "appkit": 6,
            "uikit": 6,
            "visionos": 6,
            "cocoapods": 4,
            "sfsymbols": 4,
            "core data": 4,
            "swiftdata": 7,
        },
    },
    {
        "slug": "android-kotlin",
        "title": "Android / Kotlin",
        "description": "Android, Kotlin, Jetpack Compose, and mobile Android engineering.",
        "signals": {
            "android": 7,
            "kotlin": 7,
            "jetpack": 5,
            "compose": 4,
            "gradle": 4,
            "adb": 4,
            "android studio": 5,
        },
    },
    {
        "slug": "frontend-web",
        "title": "Frontend / Web",
        "description": "Frontend engineering, web apps, UI systems, and browser-facing client code.",
        "signals": {
            "frontend": 7,
            "react": 6,
            "nextjs": 6,
            "next.js": 6,
            "tailwind": 5,
            "css": 5,
            "html": 5,
            "javascript": 5,
            "typescript": 5,
            "vue": 5,
            "svelte": 5,
            "angular": 5,
            "shadcn": 4,
            "vite": 4,
            "web ui": 4,
            "ui pattern": 4,
            "component": 3,
        },
    },
    {
        "slug": "backend-api-services",
        "title": "Backend / APIs",
        "description": "Backend services, APIs, server-side applications, and distributed systems.",
        "signals": {
            "backend": 7,
            "api": 6,
            "graphql": 5,
            "rest": 5,
            "server": 5,
            "microservice": 5,
            "websocket": 4,
            "express": 4,
            "fastapi": 4,
            "django": 4,
            "flask": 4,
            "rails": 4,
            "node.js": 4,
            "nodejs": 4,
        },
    },
    {
        "slug": "ai-llm-agents",
        "title": "AI / LLM / Agents",
        "description": "LLMs, prompts, RAG, agent workflows, and AI application engineering.",
        "signals": {
            "agent": 7,
            "agents": 7,
            "llm": 7,
            "prompt": 6,
            "rag": 6,
            "embedding": 5,
            "model": 4,
            "inference": 4,
            "fine-tun": 4,
            "ai": 3,
            "claude": 6,
            "codex": 6,
            "gemini": 6,
            "openai": 5,
            "anthropic": 5,
            "tool calling": 4,
            "subagent": 5,
            "mcp": 5,
        },
    },
    {
        "slug": "devops-cloud-infra",
        "title": "DevOps / Cloud / Infra",
        "description": "CI/CD, containers, infrastructure, cloud platforms, and deployment tooling.",
        "signals": {
            "devops": 7,
            "docker": 6,
            "kubernetes": 6,
            "terraform": 6,
            "aws": 5,
            "gcp": 5,
            "azure": 5,
            "cloudflare": 4,
            "deployment": 5,
            "infrastructure": 5,
            "ci/cd": 5,
            "github actions": 5,
            "linux": 4,
            "shell": 3,
        },
    },
    {
        "slug": "data-ml-analytics",
        "title": "Data / ML / Analytics",
        "description": "Data engineering, analytics, machine learning, databases, and pipelines.",
        "signals": {
            "data": 4,
            "analytics": 6,
            "machine learning": 6,
            "ml": 4,
            "sql": 5,
            "database": 5,
            "clickhouse": 7,
            "dbt": 6,
            "etl": 5,
            "airflow": 5,
            "spark": 5,
            "warehouse": 5,
            "pipeline": 4,
            "postgres": 4,
            "mysql": 4,
            "bigquery": 4,
        },
    },
    {
        "slug": "security",
        "title": "Security",
        "description": "Security engineering, red/blue teaming, vulnerability analysis, and hardening.",
        "signals": {
            "security": 7,
            "cybersecurity": 8,
            "vulnerability": 7,
            "pentest": 7,
            "red-team": 7,
            "red team": 7,
            "blue team": 7,
            "intrusion": 7,
            "forensics": 6,
            "malware": 6,
            "auth": 4,
            "oauth": 5,
            "incident": 5,
            "threat": 5,
            "exploit": 6,
            "cryptography": 6,
        },
    },
    {
        "slug": "browser-automation",
        "title": "Browser Automation",
        "description": "Playwright, browser control, scraping, CDP, and UI automation.",
        "signals": {
            "browser": 7,
            "playwright": 7,
            "puppeteer": 7,
            "selenium": 7,
            "scraping": 6,
            "scraper": 6,
            "cdp": 6,
            "crawl": 5,
            "crawler": 5,
            "web automation": 6,
        },
    },
    {
        "slug": "design-media-creative",
        "title": "Design / Media",
        "description": "Design systems, video, audio, graphics, and creative tooling.",
        "signals": {
            "design": 5,
            "video": 6,
            "audio": 6,
            "remotion": 7,
            "animation": 5,
            "figma": 6,
            "graphic": 5,
            "media": 5,
            "ux": 5,
            "ui/ux": 6,
            "image": 4,
            "artifacts": 4,
        },
    },
    {
        "slug": "docs-content-writing",
        "title": "Docs / Content / Writing",
        "description": "Documentation, technical writing, SEO, localization, and content generation.",
        "signals": {
            "documentation": 7,
            "docs": 6,
            "writer": 6,
            "writing": 5,
            "changelog": 5,
            "seo": 5,
            "blog": 4,
            "localization": 5,
            "translation": 5,
            "grant": 4,
            "paper": 4,
            "manuscript": 4,
            "academic": 4,
        },
    },
    {
        "slug": "product-growth-operations",
        "title": "Product / Growth / Ops",
        "description": "Product management, growth, marketing, business operations, and PM tooling.",
        "signals": {
            "product management": 7,
            "product manager": 7,
            "roadmap": 5,
            "growth": 6,
            "marketing": 6,
            "sales": 5,
            "pricing": 5,
            "customer": 4,
            "pm": 4,
            "operations": 4,
        },
    },
    {
        "slug": "testing-debugging-quality",
        "title": "Testing / Debugging / Quality",
        "description": "Testing, QA, performance, debugging, accessibility, and review workflows.",
        "signals": {
            "test": 6,
            "testing": 6,
            "debug": 7,
            "debugger": 7,
            "qa": 6,
            "quality": 5,
            "benchmark": 5,
            "performance": 6,
            "review": 5,
            "lint": 4,
            "accessibility": 5,
            "a11y": 5,
            "bug": 5,
        },
    },
    {
        "slug": "app-store-publishing",
        "title": "App Store / Publishing",
        "description": "App Store Connect, TestFlight, screenshots, metadata, and store operations.",
        "signals": {
            "app store": 8,
            "app-store": 8,
            "testflight": 8,
            "google play": 8,
            "store listing": 6,
            "metadata": 6,
            "screenshots": 6,
            "notarization": 6,
            "localization": 4,
            "bundle id": 5,
            "asc": 4,
            "gpd": 4,
        },
    },
    {
        "slug": "hardware-science-engineering",
        "title": "Hardware / Science",
        "description": "FPGA, robotics, electronics, scientific workflows, and domain engineering.",
        "signals": {
            "fpga": 8,
            "embedded": 6,
            "robot": 6,
            "hardware": 6,
            "electronic": 6,
            "science": 5,
            "scientific": 5,
            "aerospace": 7,
            "physics": 6,
            "chemistry": 6,
            "biology": 6,
            "medical": 5,
            "fatigue": 4,
        },
    },
    {
        "slug": "general-dev-tooling",
        "title": "General Dev Tooling",
        "description": "General engineering skills that do not strongly fit a narrower category.",
        "signals": {
            "cli": 3,
            "tooling": 4,
            "workflow": 4,
            "plugin": 4,
            "library": 3,
            "developer": 3,
        },
    },
]


LOCALE_RE = re.compile(r"^[a-z]{2}(?:-[A-Z]{2})?$")


def normalize_for_match(value: str) -> str:
    value = value.lower()
    value = re.sub(r"[^a-z0-9]+", " ", value)
    value = re.sub(r"\s+", " ", value).strip()
    return value


def slugify(value: str) -> str:
    value = value.lower().strip()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-") or "skill"


def parse_skill_file(path: Path) -> dict:
    text = path.read_text(errors="ignore")
    lines = text.splitlines()
    frontmatter = {}
    body_lines = lines

    if lines[:1] == ["---"]:
        try:
            end = lines[1:].index("---") + 1
        except ValueError:
            end = None
        if end is not None:
            for raw in lines[1:end]:
                if ":" not in raw:
                    continue
                key, value = raw.split(":", 1)
                frontmatter[key.strip().lower()] = value.strip().strip('"').strip("'")
            body_lines = lines[end + 1 :]

    heading = ""
    for line in body_lines:
        if line.startswith("#"):
            heading = line.lstrip("#").strip()
            break

    name = frontmatter.get("name") or heading or path.parent.name
    description = frontmatter.get("description", "")
    domain = frontmatter.get("domain", "")
    tags = frontmatter.get("tags", "")

    return {
        "frontmatter": frontmatter,
        "name": name,
        "description": description,
        "domain": domain,
        "tags": tags,
        "heading": heading,
        "body_preview": "\n".join(body_lines[:20]),
    }


def detect_locale(relative_dir: str) -> str:
    for part in Path(relative_dir).parts:
        if LOCALE_RE.match(part):
            return part
    return "default"


def classify_skill(relative_dir: str, meta: dict) -> tuple[str, list[str], dict]:
    parts = relative_dir.split("/", 1)
    scoped_path = parts[1] if len(parts) > 1 else parts[0]
    combined = " ".join(
        [
            scoped_path.replace("/", " "),
            meta["name"],
            meta["description"],
            meta["domain"],
            meta["tags"],
            meta["heading"],
            meta["body_preview"],
        ]
    )
    normalized = f" {normalize_for_match(combined)} "

    scores = {}
    for category in CATEGORIES:
        score = 0
        matched = []
        for signal, weight in category["signals"].items():
            normalized_signal = normalize_for_match(signal)
            if not normalized_signal:
                continue
            if f" {normalized_signal} " in normalized:
                score += weight
                matched.append(signal)
        if score:
            scores[category["slug"]] = {
                "score": score,
                "matchedSignals": sorted(set(matched)),
            }

    if not scores:
        return "general-dev-tooling", [], {
            "general-dev-tooling": {"score": 1, "matchedSignals": ["fallback"]}
        }

    ranked = sorted(
        scores.items(),
        key=lambda item: (-item[1]["score"], item[0]),
    )
    primary = ranked[0][0]
    secondary = [slug for slug, data in ranked[1:] if data["score"] >= 6][:3]
    return primary, secondary, scores


def build_marketplace() -> None:
    skill_paths = sorted(RAW_SKILLS_DIR.rglob("SKILL.md"))

    CATALOG_DIR.mkdir(parents=True, exist_ok=True)
    CATEGORIES_DIR.mkdir(parents=True, exist_ok=True)

    for category in CATEGORIES:
        category_dir = CATEGORIES_DIR / category["slug"]
        category_dir.mkdir(parents=True, exist_ok=True)
        for child in category_dir.iterdir():
            if child.is_symlink() or child.is_file():
                child.unlink()
            elif child.is_dir():
                for nested in child.iterdir():
                    if nested.is_symlink() or nested.is_file():
                        nested.unlink()
                child.rmdir()

    skills = []
    category_counts = Counter()
    repo_counts = defaultdict(Counter)

    for skill_file in skill_paths:
        skill_dir = skill_file.parent
        relative_dir = skill_dir.relative_to(RAW_SKILLS_DIR).as_posix()
        repo = relative_dir.split("/", 1)[0]
        meta = parse_skill_file(skill_file)
        primary, secondary, score_details = classify_skill(relative_dir, meta)
        locale = detect_locale(relative_dir)
        skill_id = slugify(relative_dir.replace("/", "__"))

        link_path = CATEGORIES_DIR / primary / skill_id
        if link_path.exists() or link_path.is_symlink():
            link_path.unlink()
        link_path.symlink_to(skill_dir)

        entry = {
            "id": skill_id,
            "name": meta["name"],
            "description": meta["description"],
            "sourceRepo": repo,
            "relativePath": relative_dir,
            "skillFile": skill_file.relative_to(ROOT).as_posix(),
            "primaryCategory": primary,
            "secondaryCategories": secondary,
            "locale": locale,
            "tags": meta["tags"],
            "domain": meta["domain"],
            "scoreDetails": score_details,
        }
        skills.append(entry)
        category_counts[primary] += 1
        repo_counts[primary][repo] += 1

    categories_summary = []
    definitions = {item["slug"]: item for item in CATEGORIES}
    for slug, count in category_counts.most_common():
        categories_summary.append(
            {
                "slug": slug,
                "title": definitions[slug]["title"],
                "description": definitions[slug]["description"],
                "skillCount": count,
                "topSourceRepos": repo_counts[slug].most_common(10),
                "folder": (CATEGORIES_DIR / slug).relative_to(ROOT).as_posix(),
            }
        )

    skills.sort(key=lambda item: (item["primaryCategory"], item["sourceRepo"], item["relativePath"]))

    (CATALOG_DIR / "skills.json").write_text(json.dumps(skills, indent=2))
    (CATALOG_DIR / "categories.json").write_text(json.dumps(categories_summary, indent=2))
    (CATALOG_DIR / "taxonomy.json").write_text(json.dumps(CATEGORIES, indent=2))

    lines = [
        "# Marketplace Split",
        "",
        "This is the first structured split on top of the raw import.",
        "",
        f"- Skills classified: `{len(skills)}`",
        f"- Categories: `{len(categories_summary)}`",
        f"- Raw skills source: `{RAW_SKILLS_DIR.relative_to(ROOT).as_posix()}`",
        f"- Category views: `{CATEGORIES_DIR.relative_to(ROOT).as_posix()}`",
        f"- Catalog: `{CATALOG_DIR.relative_to(ROOT).as_posix()}`",
        "",
        "## Categories",
    ]
    for item in categories_summary:
        lines.append(f"- `{item['slug']}`: {item['skillCount']} skills")
    (MARKETPLACE_DIR / "README.md").write_text("\n".join(lines) + "\n")


if __name__ == "__main__":
    build_marketplace()
