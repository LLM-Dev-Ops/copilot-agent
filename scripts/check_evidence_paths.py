#!/usr/bin/env python3
"""ADR-0001 Verification 3: evidence-path integrity.

Resolves every `path:` entry in deployment/compliance/soc2-evidence-collection.yaml
and fails on any that does not exist and is not explicitly marked `# TODO`.
"""
import os
import re
import sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MANIFEST = os.path.join(REPO, "deployment", "compliance", "soc2-evidence-collection.yaml")
ENTRY = re.compile(r'^\s*path:\s*"([^"]+)"\s*(#.*)?$')


def main():
    violations = []
    checked = 0
    for i, line in enumerate(open(MANIFEST, encoding="utf-8").read().split("\n"), 1):
        m = ENTRY.match(line)
        if not m:
            continue
        checked += 1
        path, comment = m.group(1), m.group(2) or ""
        if "TODO" in comment:
            continue
        # External URIs cannot be resolved from the repo and must be marked TODO.
        if os.path.exists(os.path.join(REPO, path)):
            continue
        violations.append(f"soc2-evidence-collection.yaml:{i}: {path}")

    if violations:
        print("Evidence paths that do not resolve and are not marked '# TODO':\n")
        for v in violations:
            print(f"  {v}")
        return 1
    print(f"check_evidence_paths: OK -- {checked} path entries, all resolvable or marked TODO.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
