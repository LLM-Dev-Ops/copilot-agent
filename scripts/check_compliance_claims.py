#!/usr/bin/env python3
"""ADR-0001 Verification 2: no unbacked compliance claim ships.

Greps README.md and docs/ for compliance claim keywords and fails unless each hit
sits within 3 lines of a resolvable repo path or an explicit "design stage" qualifier.

docs/adr/ is exempt: an ADR is the record of a decision about these claims (and
quotes the offending text as evidence), not an assertion of them.
"""
import os
import re
import subprocess
import sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASELINE = os.path.join(REPO, "docs", "compliance-claims-baseline.txt")
CLAIM = re.compile(r"SOC 2|SOC2|HIPAA compliant|BAA|GDPR compliant|certified", re.IGNORECASE)
QUALIFIER = re.compile(
    r"design stage|design specification|no audit performed|\|\s*Design\b", re.IGNORECASE
)
LINK = re.compile(r"\[[^\]]*\]\(([^)]+)\)|`([^`]+)`")
# Bare paths in directory-tree listings, e.g. "├── hipaaService.ts   # PHI logging"
BARE = re.compile(r"[\w./-]+\.(?:ts|tf|sql|ya?ml|md|json)\b")
CONTEXT = 3

BASELINE_HEADER = """\
# Pre-existing unbacked compliance claims, recorded by ADR-0001.
#
# These predate the ADR and live in documents its Phase 1 did not scope. They are
# recorded here so scripts/check_compliance_claims.py can block NEW unbacked claims
# without failing CI on the existing backlog. Entries are matched on file + exact
# text, so editing a line surfaces it again as new.
#
# This file is a backlog, not an exemption list. Do NOT add entries by hand to
# silence the check -- fix the claim instead. Draining it is ADR-0001 Phase 4 work.
"""


def tracked_basenames():
    """Basenames of every git-tracked file, for resolving directory-tree listings."""
    if not hasattr(tracked_basenames, "cache"):
        out = subprocess.run(
            ["git", "-C", REPO, "ls-files"], capture_output=True, text=True, check=True
        ).stdout
        tracked_basenames.cache = {os.path.basename(p) for p in out.split("\n") if p}
    return tracked_basenames.cache


def resolves(candidate):
    candidate = candidate.split("#")[0].strip()
    if not candidate or candidate.startswith(("http://", "https://", "s3://")):
        return False
    # Strip a trailing :line or :line,line citation, e.g. main.tf:243,298-299
    candidate = re.sub(r":[\d,\-]+$", "", candidate)
    return os.path.exists(os.path.join(REPO, candidate))


def backed(lines, idx):
    lo, hi = max(0, idx - CONTEXT), min(len(lines), idx + CONTEXT + 1)
    for line in lines[lo:hi]:
        if QUALIFIER.search(line):
            return True
        for m in LINK.finditer(line):
            if resolves(m.group(1) or m.group(2) or ""):
                return True
        for m in BARE.finditer(line):
            if resolves(m.group(0)) or m.group(0) in tracked_basenames():
                return True
    return False


def targets():
    yield os.path.join(REPO, "README.md")
    for root, dirs, files in os.walk(os.path.join(REPO, "docs")):
        if os.path.join("docs", "adr") in root:
            dirs[:] = []
            continue
        for f in files:
            if f.endswith(".md"):
                yield os.path.join(root, f)


def load_baseline():
    """Pre-existing unbacked claims, keyed by text rather than line number so the
    baseline does not silently absorb a new claim when a file is edited."""
    if not os.path.exists(BASELINE):
        return set()
    entries = set()
    for line in open(BASELINE, encoding="utf-8"):
        line = line.strip()
        if line and not line.startswith("#"):
            entries.add(line)
    return entries


def main():
    found = []
    for path in targets():
        if not os.path.exists(path):
            continue
        lines = open(path, encoding="utf-8").read().split("\n")
        for i, line in enumerate(lines):
            if CLAIM.search(line) and not backed(lines, i):
                rel = os.path.relpath(path, REPO)
                found.append((f"{rel}::{line.strip()}", f"{rel}:{i + 1}: {line.strip()}"))

    if "--update-baseline" in sys.argv:
        with open(BASELINE, "w", encoding="utf-8") as fh:
            fh.write(BASELINE_HEADER)
            for key, _ in sorted(found):
                fh.write(key + "\n")
        print(f"Wrote {len(found)} entries to {os.path.relpath(BASELINE, REPO)}")
        return 0

    baseline = load_baseline()
    new = [display for key, display in found if key not in baseline]

    if new:
        print("New unbacked compliance claims (need a resolvable link or a 'design stage'")
        print("qualifier within 3 lines) -- see docs/adr/ADR-0001-compliance-claims-remediation.md:\n")
        for v in sorted(new):
            print(f"  {v}")
        print("\nIf the claim is genuinely backed, add the link. Do not add it to the baseline.")
        return 1

    stale = len(baseline) - (len(found) - len(new))
    print(f"check_compliance_claims: OK -- no new unbacked claims ({len(baseline)} baselined).")
    if stale > 0:
        print(f"  {stale} baseline entries no longer match; run --update-baseline to prune.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
