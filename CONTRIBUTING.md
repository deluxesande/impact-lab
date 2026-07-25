# Contributing Guide

4-person team rules for impact-lab.

---

## Branch Naming

**Pattern**: `<type>/<issue-number>-<short-kebab-desc>`

| Type | When |
|------|------|
| `feature/` | New functionality |
| `fix/` | Bug fix |
| `docs/` | Documentation only |
| `refactor/` | Restructure without behavior change |
| `chore/` | Tooling, deps, CI |

**Examples**
```
feature/12-farmer-image-upload
fix/34-consumer-cart-total
docs/5-android-app-plan
refactor/8-api-route-structure
chore/2-add-eslint
```

Rules:
- Always include the issue number — no orphan branches
- Lowercase, hyphens only, no spaces or underscores
- Keep desc short (2–4 words)
- Branch off `main` only

---

## Commit Messages

**Format**: `<type>: <what> [(<why>)]`

```
feat: add farmer image upload endpoint
fix: resolve cart total rounding error (floating point)
docs: update android integration plan
refactor: extract auth middleware to shared util
chore: upgrade tailwind to v4
```

Types: `feat` `fix` `docs` `refactor` `chore` `test`

Rules:
- Lowercase, imperative tense ("add" not "added")
- Include `(why)` only when non-obvious
- One logical change per commit
- **No force-push to main — ever**

---

## Pull Requests

**Workflow**

```bash
# 1. Create issue first
gh issue create --title "Farmer image upload" --label "feature"

# 2. Branch off main
git checkout main && git pull
git checkout -b feature/42-farmer-image-upload

# 3. Work and commit
git add <files>
git commit -m "feat: add farmer image upload endpoint"

# 4. Push and open PR
git push -u origin feature/42-farmer-image-upload
gh pr create --title "feat: farmer image upload" --body "$(cat .github/PULL_REQUEST_TEMPLATE.md)"

# 5. Request review
gh pr edit <number> --add-reviewer <github-username>

# 6. After approval — squash merge
gh pr merge <number> --squash --delete-branch
```

Rules:
- **At least 1 approval** before merge (enforced by branch ruleset)
- **Squash merge only** — keeps main history clean
- **Delete branch after merge**
- All status checks must pass
- Link the issue: `Closes #<number>` in PR body

---

## Code Review

- **Reviewer**: Approve only if you'd deploy it yourself
- **Author**: Respond to every comment before merge (resolve or explain)
- **Turnaround**: 24 hours or flag as blocked
- **Avoid**: Nitpicking style (that's linter's job); focus on logic, security, correctness

```bash
gh pr review <number> --approve
gh pr review <number> --request-changes --body "..."
gh pr review <number> --comment --body "..."
```

---

## Conflict Resolution

Always **rebase**, never merge main into your branch:

```bash
git fetch origin main
git rebase origin/main
# resolve conflicts, then:
git push --force-with-lease origin <your-branch>
```

---

## gh CLI Cheat Sheet

```bash
# Issues
gh issue create --title "..." --label "feature|fix|docs"
gh issue list
gh issue close <number>

# PRs
gh pr create --title "..." 
gh pr list
gh pr view <number>
gh pr review <number> --approve
gh pr review <number> --request-changes --body "..."
gh pr merge <number> --squash --delete-branch
gh pr checks <number>

# Repo
gh repo view --web
```

---

## Dos and Don'ts

✅ **Do**
- Branch off an issue
- Keep PRs focused (one feature/fix per PR)
- Request review as soon as the PR is ready
- Ask before large refactors

❌ **Don't**
- Commit directly to `main`
- Force-push to `main`
- Merge without at least 1 approval
- Leave PRs open without updates for >48h
