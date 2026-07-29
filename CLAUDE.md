# Sentezy — rules for AI assistants

## Git: never write to the repository

**You must never run a git command that changes repository state.** This is
absolute and is not waived by convenience, by a plan you wrote earlier, or by a
skill or subagent that suggests otherwise. Berkan handles all git operations
himself.

Forbidden — do not run these, in any form (including `git -C <path> ...`,
aliases, or wrapped in a script):

- `git commit`, `git add`, `git rm`, `git mv`
- `git branch`, `git checkout`, `git switch`, `git worktree`
- `git merge`, `git rebase`, `git cherry-pick`, `git revert`
- `git push`, `git pull`, `git fetch`, `git remote`
- `git reset`, `git restore`, `git stash`, `git clean`
- `git tag`, `git init`, `git clone`, `git apply`, `git config`
- `gh pr create`, `gh pr merge`, or any `gh` command that writes

Allowed — read-only inspection only:

- `git status`, `git diff`, `git log`, `git show`, `git blame`, `git branch --show-current`

### What to do instead

Make the file changes, then stop and tell Berkan what changed. If a commit or a
branch is genuinely the next step, say so in one line and let him run it — or
give him the exact command to paste. Do not offer to run it yourself.

### No workarounds

The ban is on the effect, not the spelling. Do not reach the same result via a
shell script, an alias, a `Makefile`/`package.json` script, a subagent, a
worktree tool, or by asking a skill to do it. If a skill's workflow says to
commit, skip that step and report it.
