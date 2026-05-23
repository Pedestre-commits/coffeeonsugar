# Changelog

All notable changes are logged here. Updated manually during sessions; auto-committed and pushed at session end.

---

## 2026-05-23

### Setup
- Added `CLAUDE.md` with full project context for cross-machine Claude sync
- Added `.gitignore` (excludes `.vs/` and `settings.local.json`)
- Added `.claude/settings.json` with git permissions and auto-sync hooks
- Added `CHANGELOG.md` (this file)
- Hooks configured: `SessionStart` auto-pulls `dev`, `Stop` auto-commits and pushes `dev`
- Both machines confirmed synced via git (Desktop: `D:\Profiles\Documents\coffeeonsugar`, Laptop: `C:\Users\Bruno\source\repos\coffeeonsugar`)
