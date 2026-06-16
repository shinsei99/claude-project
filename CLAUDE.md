# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Environment

- OS: macOS (darwin x86_64)
- Shell: zsh
- Custom binaries in `~/.local/bin` (added to PATH via `~/.zshrc`):
  - `gh` — GitHub CLI v2.94.0
  - `claude` — Claude Code CLI

## GitHub

Authenticated as **shinsei99** via `gh auth login`. The remote repository is `https://github.com/shinsei99/claude-project` (private).

Common `gh` commands used in this repo:

```bash
gh repo view          # Show repository info
gh pr create          # Create a pull request
gh issue list         # List issues
```

## Git

```bash
git add <file>
git commit -m "message"
git push origin main
```
