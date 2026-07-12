#!/usr/bin/env python3
"""Commit and push to origin/main after a completed Cursor agent run."""

from __future__ import annotations

import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LOG_FILE = ROOT / ".cursor" / "deploy.log"
DEPLOY_BRANCH = "main"
REMOTE = "origin"


def log(message: str) -> None:
    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    with LOG_FILE.open("a", encoding="utf-8") as handle:
        handle.write(f"[{stamp}] {message}\n")


def git_env() -> dict[str, str]:
    env = os.environ.copy()
    env.setdefault("GIT_AUTHOR_NAME", "Hypewheel Cursor Hook")
    env.setdefault("GIT_AUTHOR_EMAIL", "cursor-hook@local")
    env.setdefault("GIT_COMMITTER_NAME", env["GIT_AUTHOR_NAME"])
    env.setdefault("GIT_COMMITTER_EMAIL", env["GIT_AUTHOR_EMAIL"])
    return env


def run_git(args: list[str], *, timeout: int = 60) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["git", *args],
        cwd=str(ROOT),
        capture_output=True,
        text=True,
        timeout=timeout,
        check=False,
        env=git_env(),
    )


def format_output(result: subprocess.CompletedProcess[str]) -> str:
    parts = [part.strip() for part in (result.stdout, result.stderr) if part.strip()]
    return "\n".join(parts)


def read_hook_input() -> dict:
    raw = sys.stdin.read()
    if not raw.strip():
        return {}
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        log("Warning: stop hook received invalid JSON on stdin")
        return {}


def main() -> int:
    hook_input = read_hook_input()
    status = hook_input.get("status", "completed")

    if status != "completed":
        log(f"Skipped deploy (status={status})")
        print("{}")
        return 0

    branch_result = run_git(["rev-parse", "--abbrev-ref", "HEAD"])
    if branch_result.returncode != 0:
        log(f"Skipped deploy: could not detect branch\n  {format_output(branch_result)}")
        print("{}")
        return 0

    branch = branch_result.stdout.strip()
    if branch != DEPLOY_BRANCH:
        log(f"Skipped deploy (branch={branch}, expected {DEPLOY_BRANCH})")
        print("{}")
        return 0

    log("Auto-deploy started")

    fetch_result = run_git(["fetch", REMOTE, DEPLOY_BRANCH], timeout=120)
    if fetch_result.returncode != 0:
        log(
            "Auto-deploy failed: git fetch error\n  "
            + format_output(fetch_result).replace("\n", "\n  ")
        )
        print("{}")
        return fetch_result.returncode

    status_result = run_git(["status", "--porcelain"])
    if status_result.returncode != 0:
        log(f"Auto-deploy failed: git status error\n  {format_output(status_result)}")
        print("{}")
        return status_result.returncode

    has_local_changes = bool(status_result.stdout.strip())

    if has_local_changes:
        add_result = run_git(["add", "-A"])
        if add_result.returncode != 0:
            log(f"Auto-deploy failed: git add error\n  {format_output(add_result)}")
            print("{}")
            return add_result.returncode

        stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
        commit_result = run_git(
            ["commit", "-m", f"Auto-deploy from Cursor agent ({stamp})"],
            timeout=120,
        )
        if commit_result.returncode != 0:
            if "nothing to commit" in commit_result.stdout.lower() + commit_result.stderr.lower():
                log("No commit created after git add")
            else:
                log(
                    "Auto-deploy failed: git commit error\n  "
                    + format_output(commit_result).replace("\n", "\n  ")
                )
                print("{}")
                return commit_result.returncode
        else:
            log("Created auto-deploy commit")

    ahead_result = run_git(["rev-list", "--count", f"{REMOTE}/{DEPLOY_BRANCH}..HEAD"])
    if ahead_result.returncode != 0:
        log(
            "Auto-deploy failed: could not compare with remote\n  "
            + format_output(ahead_result).replace("\n", "\n  ")
        )
        print("{}")
        return ahead_result.returncode

    commits_ahead = ahead_result.stdout.strip() or "0"
    if commits_ahead == "0":
        log("Nothing to push")
        print("{}")
        return 0

    push_result = run_git(["push", REMOTE, DEPLOY_BRANCH], timeout=120)
    output = format_output(push_result)
    if output:
        log(output.replace("\n", "\n  "))

    if push_result.returncode != 0:
        log(f"Auto-deploy failed: git push exit code {push_result.returncode}")
        print("{}")
        return push_result.returncode

    log(f"Auto-deploy finished (pushed {commits_ahead} commit(s) to {REMOTE}/{DEPLOY_BRANCH})")
    print("{}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
