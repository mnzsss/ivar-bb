# ivar-bb

A [bb](https://github.com/get-bb/bb) plugin to manage an [ivar](https://github.com/mnzsss/ivar) hall and review a feature's local changes before opening a pull request.

> [!WARNING]
> **ivar-bb is under active development.** Expect breaking changes, rough edges and missing
> features. It depends on ivar commands that are not released yet and on experimental bb
> plugin SDK APIs. Don't rely on it for critical work yet, and please report problems.

## Features

- **Hall panel:** lists the hall's repos and features, shows which repos each feature promotes,
  and runs `ivar sync`, `ivar feature create` and `ivar feature promote`.
- **Local review:** diffs every promoted repo of a feature against its base, including
  uncommitted and untracked files, in unified or split view with collapsible files.
- **Inline comments:** select a line range to comment. Comments are stored by the ivar CLI
  (`ivar review comment`), so any other tool can read them.
- **Send to bb threads:** open comments start one bb thread per repo, inside that repo's
  worktree, with the commands to resolve each comment.

## Requirements

- **bb** with plugin SDK 0.4.87 or newer (`npx bb-app@latest` works).
- **ivar** with the `review comment` commands and worktree paths in `feature status --json`.
  Until they ship in a release, install ivar from source:

  ```bash
  cargo install --git https://github.com/mnzsss/ivar --branch ivar-bb --locked
  ```

  The bb server and the threads it spawns run the first `ivar` on their `PATH`, so make sure
  that is this build (`ivar review comment --help` should work).

- **git** on `PATH`.

## Installation

Install the plugin into a running bb:

```bash
npx -p bb-app@latest bb plugin install git:https://github.com/mnzsss/ivar-bb
```

bb asks for confirmation because plugins run as full-trust code inside the bb server
(pass `--yes` to skip it).

Then:

1. In bb, create or open a project whose folder is your ivar hall (the directory with
   `ivar.json`), or any folder inside it.
2. Open **ivar** in the sidebar.
3. Pick a feature and click **Review**.

## Contributing

Contributions are welcome. For anything larger than a small fix, open an issue first so we can
agree on the approach.

### Setup

```bash
git clone https://github.com/mnzsss/ivar-bb
cd ivar-bb
pnpm install
```

### Develop

Start bb, then install your checkout:

```bash
npx bb-app@latest
npx -p bb-app@latest bb plugin install . --yes
```

Reinstall after changes, or run `npx -p bb-app@latest bb plugin dev` to rebuild and reload on save.

### Project layout

- `src/server.ts`: plugin server entry; registers the RPC contract from `src/rpc.ts`.
- `src/hall.ts`, `src/diff.ts`, `src/comments.ts`: hall discovery, diffs and comments. They
  spawn `ivar` and `git` through `src/exec.ts`.
- `app.tsx` and `src/app/`: the UI. `@pierre/diffs` is imported only in `src/app/file-diff.tsx`.

### Before opening a pull request

```bash
pnpm test
pnpm typecheck
npx -p bb-app@latest bb plugin build
```

Guidelines:

- Write a failing test first for behaviour changes and bug fixes.
- Spawn processes only through `src/exec.ts`, with argument arrays and never a shell.
- Never write to `.ivar/` directly; go through the ivar CLI.
- Use [Conventional Commits](https://www.conventionalcommits.org/) (`feat: ...`, `fix: ...`).
