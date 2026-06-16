<div align="center">

# Cascade

**A native Obsidian plugin for periodic notes, task migration, and vault organization.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Obsidian](https://img.shields.io/badge/Obsidian-Plugin-7C3AED?logo=obsidian&logoColor=white)](https://obsidian.md)
[![Status](https://img.shields.io/badge/Status-In%20Development-orange)]()
[![pt-BR](https://img.shields.io/badge/i18n-pt--BR%20%7C%20en--US-green)]()
[![Version](https://img.shields.io/badge/Version-0.1.2-blue)]()

</div>

---

Cascade replaces a stack of separate plugins — Templater scripts, Calendar, Periodic Notes, Tasks, Checkbox Style Menu, and Update Time on Edit — with a single, modular, and configurable native plugin.

The core idea is simple: tasks flow **downward** through a cascade of logs. Recurring tasks seed the annual log. The annual log feeds the monthly. The monthly feeds the weekly. The weekly feeds the daily. Pending tasks from yesterday carry forward. Nothing is lost.

---

## Features

### Periodic Notes

Create and navigate daily, **weekly**, monthly, and yearly notes with a fully configurable path format. The default structure follows the pattern:

```
AGENDA/
  2026/
    202600000000-2026.md          ← annual log
    06/
      202606000000-JUNE.md       ← monthly log
      202606150000-[S]-24.md     ← weekly log (folder-index)
      202606150000-[S]-24/       ← weekly folder
        202606150001-SUNDAY.md   ← daily log
      202606150000-SUNDAY.md     ← daily log (flat structure)
```

Path format, folder structure, file naming conventions, accent handling, and case are all configurable. No hardcoded paths.

**Weekly notes** support two structures:
- **Folder-index** (default): each week gets its own folder containing the weekly index + daily notes
- **Flat**: weekly and daily notes live directly in the month folder

### Task Migration

Tasks flow through a cascade of logs automatically on startup:

```
RECURRENTS.md  →  Annual  →  Monthly  →  Weekly → Daily  →  Next day
```

- Recurring tasks (marked with `🔁`) are seeded into the annual and monthly/weekly logs on the correct days.
- The `🔁` marker is stripped from monthly/weekly/daily copies — the Tasks plugin won't regenerate them when you mark them done.
- `📅` (due date) carries over if a task goes past its day.
- `⏳` (scheduled date) tasks that expire without completion are cancelled (`- [-]`) rather than carried forward.
- `⏰` (reminder time) is always preserved.
- Migrated tasks in the source are marked `- [>]`, keeping a clean audit trail.
- **In-progress child tasks** (`[/]`) from previous days are carried forward with their parent.
- **Task families**: completing a parent auto-completes open/in-progress children; completing all children auto-completes the parent (configurable).

### Checkbox Status Menu

Right-click (or long-press on mobile) any checkbox to open a quick-pick status menu.

Built-in statuses:

| Symbol | Meaning     |
|--------|-------------|
| `[ ]`  | Open        |
| `[/]`  | In progress |
| `[x]`  | Done        |
| `[-]`  | Cancelled   |
| `[>]`  | Migrated    |
| `[<]`  | Scheduled   |

Migration-critical statuses are protected and cannot be removed. Additional custom statuses can be added freely through settings.

### Calendar View

A native calendar panel in the sidebar. Click any day to open or create the corresponding daily note. Visual indicators show which days already have notes.

**Options:**
- First day of week (Sunday/Monday)
- Show ISO week numbers
- Open in new leaf
- Confirm before creating new notes

### File Normalizer

Keeps file names consistent across the vault:

- Timestamps prefixed (`YYYYMMDDHHmm-`)
- Spaces and symbols replaced with hyphens
- Uppercase slugs
- Configurable accent handling
- Skips `.trash`, sync conflict files, and temp files

### Frontmatter Management

Automatically maintains `created` and `updated` properties in frontmatter on save. Template files are excluded. YAML structure is preserved.

---

## Installation

> The plugin is currently in active development and not yet listed in the Obsidian Community Plugins directory.

**Manual installation:**

1. Download the latest release: `main.js`, `styles.css`, `manifest.json`.
2. Copy the files to your vault at `.obsidian/plugins/obsidian-cascade/`.
3. Restart Obsidian.
4. Go to **Settings → Community Plugins**, disable Safe Mode if needed, and enable **Cascade**.

---

## Configuration

All behavior is configurable through **Settings → Cascade**:

| Category | Options |
|---|---|
| **Agenda** | Language, root folder, recurring tasks source, **weekly notes (on/off)**, weekly structure (folder-index/flat) |
| **Formats & Templates** | Daily/weekly/monthly/yearly path format, note format, templates folder, templates per type |
| **Startup & Migration** | Open today on startup, auto-migration, normalizer on startup, migration enabled, cancel expired scheduled, lookback days for previous day migration, auto-complete task families |
| **Normalizer** | Enable/disable, scope folders, accent handling, case, timestamp prefix |
| **Statuses** | Custom status symbols and labels (essential statuses are protected) |
| **Calendar** | First day of week, show week numbers, open in new leaf, confirm create |
| **Frontmatter** | Property names for `created`/`updated`, date format, excluded folders |

---

## Task Metadata Reference

Cascade reads and respects the Tasks plugin emoji format:

| Emoji | Meaning | Behavior |
|-------|---------|----------|
| `🔁` | Recurrence rule | Kept in source/annual; stripped from monthly/daily copies |
| `📅` | Due date | Carried forward if task remains open past the date |
| `⏳` | Scheduled date | Task is cancelled (`[-]`) if it reaches the next day open |
| `🛫` | Start date | Used as the recurrence base date when no `📅` or `⏳` is present |
| `⏰` | Reminder time | Always preserved, never modified |

---



## Acknowledgements

Cascade was designed to replace a set of excellent plugins. No source code was copied from any of them; behavior and concepts were studied and independently reimplemented. Full credit goes to their authors.

| Plugin | Author | License | Repository |
|--------|--------|---------|------------|
| **Tasks** | obsidian-tasks-group | MIT | [github.com/obsidian-tasks-group/obsidian-tasks](https://github.com/obsidian-tasks-group/obsidian-tasks) |
| **Calendar** | Liam Cain | MIT | [github.com/liamcain/obsidian-calendar-plugin](https://github.com/liamcain/obsidian-calendar-plugin) |
| **Periodic Notes** | Liam Cain | MIT | [github.com/liamcain/obsidian-periodic-notes](https://github.com/liamcain/obsidian-periodic-notes) |
| **Dataview** | Michael Brenan (blacksmithgu) | MIT | [github.com/blacksmithgu/obsidian-dataview](https://github.com/blacksmithgu/obsidian-dataview) |
| **Templater** | SilentVoid13 | AGPL-3.0 | [github.com/SilentVoid13/Templater](https://github.com/SilentVoid13/Templater) |
| **Update Time on Edit** | beaussan | MIT | [github.com/beaussan/update-time-on-edit-obsidian](https://github.com/beaussan/update-time-on-edit-obsidian) |
| **Checkbox Style Menu** | ReticentEclectic | 0BSD | [github.com/ReticentEclectic/checkbox-style-menu](https://github.com/ReticentEclectic/checkbox-style-menu) |

> **Note on Templater:** Cascade aims to fully replace the Templater dependency for agenda automation. Because Templater is licensed under AGPL-3.0, no source code from it was used or adapted in Cascade.

---

## Contributing

Issues and pull requests are welcome. Please open an issue first for any significant change so we can discuss approach and scope.

---

## License

MIT — see [LICENSE](LICENSE) for details.
