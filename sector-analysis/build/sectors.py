"""Sector registry: the list of sectors and their settings comes from config/sectors.json.

Each sector key (e.g. "Energy", "Banks", "Telecom") maps to a config block. Optional fields:
  name      display name (GICS industry group as used by the Saudi Exchange); default = key
  slug      data folder under data/ and file prefix under parsed/; default = key lower-cased
  template  "corporate" (non-financial companies, the Energy template), "bank", "reit",
            "insurance" or "finsvc"; default "corporate" ("bank" for Banks)
  archive   folder under <work>/archive/ holding the company folders; default = key
Usage from shell: python sectors.py <root> [field]  -> prints one line per sector (key and field).
"""
from __future__ import annotations

import json
import os
import sys


def load(root: str) -> list[dict]:
    cfg = json.load(open(os.path.join(root, "config", "sectors.json"), encoding="utf-8"))
    out = []
    for key, c in cfg.items():
        out.append({
            "key": key,
            "name": c.get("name", key),
            "slug": c.get("slug", key.lower()),
            "template": c.get("template", "bank" if key == "Banks" else "corporate"),
            "archive": c.get("archive", key),
        })
    return out


def raw(root: str) -> dict:
    """The sector config blocks as written in config/sectors.json."""
    return json.load(open(os.path.join(root, "config", "sectors.json"), encoding="utf-8"))


def by_key(root: str) -> dict:
    return {s["key"]: s for s in load(root)}


def template(root: str, key: str) -> str:
    s = by_key(root).get(key)
    return s["template"] if s else ("bank" if key == "Banks" else "corporate")


def facts_paths(root: str) -> list[tuple[str, str]]:
    """(sector key, path to data/<slug>/facts.csv) for every configured sector whose facts exist."""
    out = []
    for s in load(root):
        p = os.path.join(root, "data", s["slug"], "facts.csv")
        if os.path.exists(p):
            out.append((s["key"], p))
    return out


if __name__ == "__main__":
    root = sys.argv[1]
    field = sys.argv[2] if len(sys.argv) > 2 else "slug"
    for s in load(root):
        print(s["key"], s[field])
