# Plan: Issue #6 - Recurring Tasks Follow Cascade (Annual → Monthly → Weekly → Daily)

## Problem
Spec §4 and §10: Recurring tasks should flow: RECORRENTES → ANUAL → MENSAL → SEMANAL → DIÁRIO
Current implementation in `seedMonthlyRecurring` (line 203) and `seedRecurringToWeeklyOrDaily` (line 244) seeds DIRECTLY to monthly/weekly/daily, skipping the cascade.

## Current Code Analysis

### `seedAnnualFromRecurring` (lines 154-178) - CORRECT
- Seeds recurring tasks into Annual log per month
- This is the correct entry point

### `seedMonthlyRecurring` (lines 203-233) - WRONG
```typescript
// Seeds directly to weekly or monthly, skipping Annual → Monthly cascade
const targetPath = this.paths.weeklyEnabled() ? this.paths.weeklyPath(date) : this.paths.monthlyPath(date);
```

### `seedRecurringToWeeklyOrDaily` (lines 244-260) - WRONG
```typescript
// Seeds directly to weekly or daily
```

### `seedRecurringToMonthly` (lines 235-242) - WRONG
```typescript
// Falls back to monthly, then weekly/daily
```

## Fix Required

**Recurring tasks should ONLY be seeded into Annual log.**
Then the normal cascade (Annual → Monthly → Weekly → Daily) handles the rest via:
- `migrateAnnualToMonthly` (already exists)
- `migrateMonthlyToDaily` (already exists, handles weekly too)

## Files to Modify

1. `src/tasks/migration-service.ts`
   - Remove `seedMonthlyRecurring`, `seedRecurringToWeeklyOrDaily`, `seedRecurringToMonthly`
   - Modify `run()` to only call `seedAnnualFromRecurring` when `yearlyEnabled`
   - When `!yearlyEnabled`, seed to Monthly (first level available)
   - When `!monthlyEnabled`, seed to Weekly
   - When `!weeklyEnabled`, seed to Daily

## Cascade Logic (per spec §4)
```
RECORRENTES
    ↓
LOG-ANUAL (if yearlyEnabled)
    ↓
LOG-MENSAL (if monthlyEnabled)
    ↓
LOG-SEMANAL (if weeklyEnabled)
    ↓
LOG-DIÁRIO
```

## Implementation

```typescript
async run(date = new Date()): Promise<void> {
  // ...
  if (this.settings.yearlyEnabled) {
    await this.seedAnnualFromRecurring(date);
    if (this.settings.monthlyEnabled) {
      await this.ensureMonthly(date);
      await this.migrateAnnualToMonthly(date);
      // NO seedMonthlyRecurring here!
    } else {
      // No monthly: annual → weekly/daily handled by migrateMonthlyToDaily
    }
  } else if (this.settings.monthlyEnabled) {
    // No annual: seed to monthly directly
    await this.seedMonthlyFromRecurring(date);
  } else if (this.paths.weeklyEnabled()) {
    // No annual/monthly: seed to weekly
    await this.seedWeeklyFromRecurring(date);
  } else {
    // Fallback: seed to daily
    await this.seedDailyFromRecurring(date);
  }
  // ...
}
```

## Test Strategy

- Run existing tests
- Verify recurring tasks appear first in Annual, then cascade down
- Check idempotency (no duplicates)

## Verification Commands

```bash
cd E:\obsidian-cascade
npm run compile
npm run test
npm run lint
```