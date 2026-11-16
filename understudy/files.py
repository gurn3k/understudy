"""Small file helpers shared by the tools: locked-file checks and JSON I/O."""
import hashlib
import json
from pathlib import Path

DOCS = Path(__file__).resolve().parent.parent / "docs"


class LockedFileChanged(Exception):
    pass


def verify(path, lock_name):
    """Raise if a locked data file no longer matches its hash in docs/<lock_name>."""
    want = (DOCS / lock_name).read_text().split()[0]
    got = hashlib.sha256(Path(path).read_bytes()).hexdigest()
    if got != want:
        raise LockedFileChanged(f"{Path(path).name} changed: {got} != {want}")


def load_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def save_json(obj, path, **kw):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, **kw)
