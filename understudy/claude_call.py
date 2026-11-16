"""One way to ask Claude for JSON, in three modes.

- stub:   no call; a deterministic fake answer (free, for testing the pipeline)
- replay: read the saved response for this key; fail if there isn't one
- live:   headless Claude Code on the owner's plan; the response is saved

Every live response is saved under <store>/<key>.json before it's used, so
a rerun only fills keys that are missing. An empty or unreadable reply stops
the run (it may be a usage limit) with everything so far kept.
"""
import hashlib
import json
import subprocess
import time
from pathlib import Path

MODEL = "claude-opus-5-5"
# List prices per million tokens (Anthropic API, cached table dated 2026-11-03).
PRICES = {"claude-opus-5-5": {"input": 4.00, "output": 20.00}}
# Tokens the headless harness adds to every call, measured on an empty prompt
# (2026-11-15). A direct API call wouldn't carry them, so they're left out of
# the API-equivalent cost.
HARNESS_OVERHEAD_TOKENS = 12668


class StopRun(Exception):
    """Raised when a live call returns nothing usable. Saved work is kept."""


class CallCap(Exception):
    """Raised when a run reaches its live-call cap."""


class PromptChanged(Exception):
    """Raised when a saved response was made from a different prompt than the one asked now."""


def prompt_sha(system, prompt):
    return hashlib.sha256(json.dumps([system, prompt]).encode("utf-8")).hexdigest()


def api_equivalent_cost(usage, model=MODEL):
    p = PRICES[model]
    inp = (usage.get("input_tokens", 0) + usage.get("cache_creation_input_tokens", 0)
           + usage.get("cache_read_input_tokens", 0) - HARNESS_OVERHEAD_TOKENS)
    out = usage.get("output_tokens", 0)
    inp = max(inp, 0)
    return {"input_tokens": inp, "output_tokens": out,
            "usd": inp / 1e6 * p["input"] + out / 1e6 * p["output"]}


def extract_json(text):
    """Parse the first JSON object in a reply. Returns None if there isn't one."""
    if not text:
        return None
    start = text.find("{")
    end = text.rfind("}")
    if start < 0 or end <= start:
        return None
    try:
        return json.loads(text[start:end + 1])
    except json.JSONDecodeError:
        return None


class Caller:
    def __init__(self, mode, store, system, stub_fn=None, max_live_calls=0, workdir=None):
        if mode not in ("stub", "replay", "live"):
            raise ValueError(mode)
        self.mode, self.store, self.system = mode, Path(store), system
        self.stub_fn, self.max_live_calls = stub_fn, max_live_calls
        self.live_calls = 0
        self.workdir = workdir
        self.store.mkdir(parents=True, exist_ok=True)

    def path(self, key):
        return self.store / f"{key}.json"

    def ask(self, key, prompt):
        """Return the saved record {"reply": parsed JSON or None, "raw": text, "meta": {...}}."""
        p = self.path(key)
        if self.mode == "stub":
            return {"reply": self.stub_fn(prompt), "raw": "", "meta": {"mode": "stub"}}
        sha = prompt_sha(self.system, prompt)
        if p.exists():
            rec = json.loads(p.read_text(encoding="utf-8"))
            saved = rec.get("meta", {}).get("prompt_sha256")
            if saved is not None and saved != sha:
                raise PromptChanged(f"{key}: saved response was made from a different prompt")
            return rec
        if self.mode == "replay":
            raise FileNotFoundError(f"no saved response for {key}")
        if self.live_calls >= self.max_live_calls:
            raise CallCap(f"live-call cap {self.max_live_calls} reached before {key}")
        self.live_calls += 1
        t0 = time.time()
        proc = subprocess.run(
            ["claude", "-p", "--output-format", "json", "--model", MODEL, "--tools", "",
             "--strict-mcp-config", "--no-session-persistence", "--setting-sources", "",
             "--system-prompt", self.system],
            input=prompt, capture_output=True, text=True, encoding="utf-8", cwd=self.workdir, timeout=900)
        wall = time.time() - t0
        try:
            out = json.loads(proc.stdout)
        except json.JSONDecodeError:
            raise StopRun(f"{key}: unreadable CLI output (exit {proc.returncode}): {proc.stderr[:300]}")
        text = out.get("result", "") or ""
        if not text.strip():
            raise StopRun(f"{key}: empty reply (possible usage limit); stopping with saved work kept")
        usage = out.get("usage", {})
        rec = {"reply": extract_json(text), "raw": text,
               "meta": {"mode": "live", "model": MODEL, "wall_s": round(wall, 2),
                        "api_ms": out.get("duration_api_ms"), "usage": usage,
                        "plan_list_cost_usd": out.get("total_cost_usd"),
                        "api_equivalent": api_equivalent_cost(usage),
                        "stop_reason": out.get("stop_reason"), "prompt_sha256": sha, "at": time.strftime("%Y-%m-%dT%H:%M:%S")}}
        p.write_text(json.dumps(rec), encoding="utf-8")
        return rec
