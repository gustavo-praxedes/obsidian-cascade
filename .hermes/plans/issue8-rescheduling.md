# Plan: Issue #8 - Rescheduling: Position Cursor and Preserve State

## Problem
Spec §12: When user marks `[<]`, plugin should:
1. Copy task to clipboard ✅ (implemented)
2. Open upper log ✅ (implemented)
3. **Position cursor** ⚠️ (partially - sets to end of file)
4. User pastes where desired

Copied task should preserve:
- text ✅
- date ✅
- time (⏰) ⚠️
- 🔚 or 🔜 ⚠️
- state [ ] or [/] ❌ (currently converts to `[ ]` via `toOpenTask`)

## Current Code Analysis

### `scheduledRootTasks` (lines 55-74)
```typescript
const block = [toOpenTask(lines[index])];  // Line 62 - CONVERTS to [ ] - WRONG
```
Should preserve original status (`[ ]` or `[/]`)

### `upperLogPath` (lines 76-79) - Extracts log path from frontmatter

### `openUpperLog` (lines 39-52) - Opens file and sets cursor to end of file

## Fix Required

1. **Preserve original status** in `scheduledRootTasks` - don't use `toOpenTask`
2. **Preserve all markers** (📅, ⏰, 🔜, 🔚) in clipboard copy
3. **Better cursor positioning** - position at logical insertion point (after last task in relevant section, not just end of file)

## Files to Modify

1. `src/tasks/scheduled-task-service.ts`
   - Modify `scheduledRootTasks` to preserve status and markers
   - Improve `openUpperLog` cursor positioning

## Implementation Details

### Preserve Status and Markers
```typescript
// Instead of: const block = [toOpenTask(lines[index])];
// Use original line with status preserved:
const block = [lines[index]];  // Keep original [ ] or [/]
// Keep all markers: 📅, ⏰, 🔜, 🔚
```

### Cursor Positioning
Find the appropriate section in the upper log (e.g., "MIGRADOS" section or end of relevant day/week) and position cursor there, not just at end of file.

## Test Strategy

- Run existing tests
- Manual test: create task with `[/]`, ⏰, 🔜, mark `[<]`, verify clipboard content
- Verify cursor position in opened log

## Verification Commands

```bash
cd E:\obsidian-cascade
npm run compile
npm run test
npm run lint
```