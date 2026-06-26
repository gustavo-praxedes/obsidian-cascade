# Plan: Issue #5 - Process ALL Lost Periods (not limited by lookbackDays)

## Problem
Spec §14: "Se o usuário abrir o Obsidian após vários dias: O plugin processa: dias, semanas, meses, anos em sequência. Todos os períodos são processados."
Current `processLostPeriods` in `migration-service.ts` (lines 103-132) only processes `previousDayMigrationLookbackDays` (default: 1) days.

## Current Code Analysis

### `processLostPeriods` (lines 103-132)
```typescript
private async processLostPeriods(date: Date): Promise<void> {
  const days = Math.max(0, Math.floor(this.settings.previousDayMigrationLookbackDays));
  if (!days) return;
  // Only processes 'days' days back
}
```

### What needs to happen (per spec)
1. Find the last date each period (annual, monthly, weekly, daily) was processed
2. Process ALL missing periods in sequence: years → months → weeks → days
3. Not limited by a fixed lookback number

## Fix Required

1. **Remove the `previousDayMigrationLookbackDays` limit** for period processing
2. **Track last processed date per period** - could use log files existence or a marker
3. **Process in cascade order**: Annual → Monthly → Weekly → Daily for each missing period
4. **Keep `previousDayMigrationLookbackDays` for daily carry-forward only** (migratePreviousDays)

## Files to Modify

1. `src/tasks/migration-service.ts` - Rewrite `processLostPeriods` to process all missing periods
2. `src/config/schema.ts` - May deprecate or repurpose `previousDayMigrationLookbackDays`
3. `src/config/defaults.ts` - Update defaults

## Approach

Option A: Use file modification dates to determine last processed period
Option B: Add a marker in the log files (e.g., frontmatter `lastMigrationDate`)
Option C: Process from a known start date (plugin install date) forward

Given the philosophy "Markdown is the only source of truth" and "plugin is disposable", Option A (file dates) is most aligned.

## Test Strategy

- Run existing tests: `npm run test`
- Add test for multi-period gap processing
- Verify cascade order is maintained

## Verification Commands

```bash
cd E:\obsidian-cascade
npm run compile
npm run test
npm run lint
```