# Design system migration playbook

Written after the Untitled UI attempt (2026-11-10), which was rolled back. Read this before moving a product from one design system to another (for example shadcn to Untitled UI).

## The core rule

**Replace a component only when the new design system has a comparable and complete component for it. Otherwise leave it exactly as it is.**

- "Complete" means the new component covers everything the old one does here: behaviour, states, interactions and layout. Not just the visible shell.
- Never make a partial adjustment to a component that has no full replacement. That includes swapping a button, tooltip, icon, colour token or class inside it. A half-converted component is worse than either version.
- Decide per component, not per element. If the component stays, every part of it stays, including the buttons inside it.
- Unsure whether a replacement is complete? It is not. Leave the component alone and list it as a gap.

What went wrong when this was ignored: the first pass swapped buttons inside the Undo toast, the AI chat and the daily brief. None of those has an Untitled UI counterpart, so they ended up as mixed components. They had to be restored by hand.

## Before starting (all must be true)

1. **Isolated workspace.** Work in a git worktree or a separate clone. Never switch the branch of a folder another session or dev server is using. Check for parallel sessions first.
2. **Licensing checked.** List which catalog items are free and which are paid (PRO). Map the product only to the free ones. Paid items count as gaps unless the owner has bought the licence.
3. **Coverage map written.** For every component in the product: replace, keep, or gap, with the reason. Keep it in a gaps doc in the repo.
4. **Owner approved the map**, including every component that stays.

## Token clash test (one component, before any parallel work)

Install one component and compile the CSS. Look for classes that now mean something different, for example `bg-primary`, `text-primary`, `bg-secondary`. If two systems define the same utility, decide how the components that stay will keep their original look, and test that before converting anything else. Do not edit kept components to dodge the clash without telling the owner.

## Doing the conversion

- Convert whole components only, per the core rule.
- Use the design system's own CLI to install components. Do not copy by hand. Prefer the CLI over an MCP server: its tool schemas cost tokens every turn.
- Parallel agents get disjoint file lists and a written brief with these rules. The brief must say: no partial swaps, no edits to components that stay, report every component skipped and why.
- Agents do not certify their own work. The lead runs typecheck, lint, build and any project audits.
- Check the interactive states of every converted screen in the browser: dialogs, menus, toasts, empty and error states. Compare against the old version.
- Commit only files that belong to the migration. Do not sweep in another session's uncommitted edits. If a committed file depends on another session's change, say so.

## Deploying

- A migration branch never deploys to production. Production deploys come only from `main`, through git.
- Do not run `vercel --prod` (or any CLI production deploy) from a working folder. Preview deploys from the branch are fine.
- Before merging to `main`: the owner has seen the preview and approved it.

## Rollback

- Build the rollback in a worktree, not in the shared folder.
- Three-way merge each migrated file (before-migration version, migrated version, current version) so work done in parallel is kept.
- After pushing, check what production actually serves. Confirm the deployment came from git and from `main`.
- Move any shared folder back to `main` so nothing deploys the old branch again.

## Agent brief template

```
You are migrating part of <project> from <old system> to <new system>.
Repo: <path>. Read AGENTS.md first.

YOUR FILES ONLY: <list>. Other agents edit other files in parallel.

Rules:
- Replace a component only if the new system has a comparable AND complete one.
  If not, leave that component untouched, including everything inside it.
- No partial swaps. No class, token or icon edits inside a kept component.
- Do not edit, move or delete anything outside your files.
- Do not run build, dev server, git commit or git push.
- Verify with tsc and eslint on your own files only.
- Report in under 120 words: converted, left alone (and why), open issues.
```
