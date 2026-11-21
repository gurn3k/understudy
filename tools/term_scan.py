"""Fail if a committed file contains a term that must not appear in this repository.

The terms themselves are not written here, so that this file does not break its own rule: each is stored as the
HMAC-SHA256 of its lowercase form, keyed with the secret in the UNDERSTUDY_TERM_KEY environment variable, with how it
is matched. The key is never committed (CI reads it from a repository secret), so the list cannot be checked against
guesses. Text is lowercased and split into runs of letters and digits.
- "sub":   the term may sit inside a longer word (any substring of a word is checked).
- "token": the term must be a whole word (for short terms).
- "words": a phrase of several words, matched on consecutive words.

Usage: python tools/term_scan.py   (scans `git ls-files`; exit 1 on any hit, naming the file and line, not the term;
       exit 2 if the key is not set)
       python tools/term_scan.py --hash-list FILE   (FILE kept outside the repo, one "term<TAB>mode" a line: prints the
       keyed entries for tools/term_hashes.txt)
Standard library only.
"""
import hmac
import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

def load_terms(path=ROOT / "tools" / "term_hashes.txt"):
    """Each line of the list: keyed hash of the lowercase term, mode, number of characters (or words, for "words")."""
    out = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#"):
            h, mode, n = line.split()
            out.append((h, mode, int(n)))
    return out


KEY_VAR = "UNDERSTUDY_TERM_KEY"


class NoKey(Exception):
    pass


def key():
    k = os.environ.get(KEY_VAR, "")
    if not k:
        raise NoKey(f"{KEY_VAR} is not set: the term list is keyed, so the scan cannot run without it. "
                    "Locally, set it from the key file kept outside the repo; in CI, add it as a repository secret.")
    return k.encode("utf-8")


def sha(s):
    return hmac.new(key(), s.encode("utf-8"), "sha256").hexdigest()


def term(text, mode):
    """A term entry for a plain term (used by the tests and to make the hash list; never stored in plain text)."""
    t = " ".join(re.findall(r"[a-z0-9]+", text.lower()))
    return (sha(t), mode, len(t.split()) if mode == "words" else len(t))


def scan_text(text, terms):
    """Return the 1-based line numbers that hold a term."""
    sub = {h for h, m, _ in terms if m == "sub"}
    sub_lens = sorted({n for _, m, n in terms if m == "sub"})
    tok = {h for h, m, _ in terms if m == "token"}
    words = {h for h, m, _ in terms if m == "words"}
    word_ns = sorted({n for _, m, n in terms if m == "words"})
    hits = []
    for i, line in enumerate(text.splitlines(), 1):
        ws = re.findall(r"[a-z0-9]+", line.lower())
        found = False
        for w in ws:
            if sha(w) in tok:
                found = True
                break
            for L in sub_lens:
                if any(sha(w[j:j + L]) in sub for j in range(len(w) - L + 1)):
                    found = True
                    break
            if found:
                break
        if not found and words:
            found = any(sha(" ".join(ws[j:j + n])) in words for n in word_ns for j in range(len(ws) - n + 1))
        if found:
            hits.append(i)
    return hits


def tracked_files():
    out = subprocess.run(["git", "ls-files", "-z"], cwd=ROOT, capture_output=True, check=True).stdout
    return [ROOT / p for p in out.decode("utf-8").split("\0") if p]


def hash_list(path):
    """Print the keyed entries for a local plain list ("term<TAB>mode" a line), for tools/term_hashes.txt."""
    for line in Path(path).read_text(encoding="utf-8").splitlines():
        if line.strip():
            text, mode = line.rsplit("\t", 1)
            print("%s %s %d" % term(text, mode.strip()))


def main():
    try:
        key()
    except NoKey as e:
        print(f"term scan: {e}")
        return 2
    if sys.argv[1:2] == ["--hash-list"]:
        hash_list(sys.argv[2])
        return 0
    terms = load_terms()
    bad = 0
    for p in tracked_files():
        if not p.is_file():
            continue
        data = p.read_bytes()
        if b"\0" in data[:8192]:
            continue  # binary
        for n in scan_text(data.decode("utf-8", errors="replace"), terms):
            bad += 1
            print(f"TERM FOUND: {p.relative_to(ROOT).as_posix()}:{n}")
    print(f"term scan: {len(terms)} terms, {bad} hit{'s' if bad != 1 else ''}")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
