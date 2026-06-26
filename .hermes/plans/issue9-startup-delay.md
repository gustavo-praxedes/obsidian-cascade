# Plan: Issue #9 - Align Startup Delay with Spec (Fixed Values + Custom)

## Problem
Spec §18: "Atraso inicial" configuration values:
- 0 segundos
- 5 segundos
- 10 segundos
- 30 segundos
- personalizado

Current implementation: `startupDelaySeconds: number` (free numeric input, default 0)

## Current Code Analysis

### Schema (schema.ts line 60)
```typescript
startupDelaySeconds: number;
```

### Defaults (defaults.ts line 63)
```typescript
startupDelaySeconds: 0,
```

### Usage (lifecycle.ts lines 60-65)
```typescript
private async applyStartupDelay(): Promise<void> {
  const seconds = Math.max(0, Math.floor(this.settings.startupDelaySeconds));
  if (!seconds) return;
  this.log.startup.info(`Waiting ${seconds}s before startup`);
  await sleep(seconds * 1000);
}
```

## Fix Required

1. **Change schema** from `number` to union type: `0 | 5 | 10 | 30 | "custom"`
2. **Add new setting** `startupDelayCustomSeconds: number` for custom value
3. **Update defaults** 
4. **Update settings UI** (AdvancedSection or GeneralSection) to show dropdown + custom input
5. **Update `applyStartupDelay`** to use custom value when "custom" selected

## Files to Modify

1. `src/config/schema.ts` - Change `startupDelaySeconds` type, add `startupDelayCustomSeconds`
2. `src/config/defaults.ts` - Add default for custom
3. `src/config/settings-tab.ts` / sections - Update UI (dropdown + conditional custom input)
4. Or add to appropriate section)
4. `src/app/lifecycle.ts` - Update `applyStartupDelay` logic

## Schema Change

```typescript
// Before
startupDelaySeconds: number;

// After
startupDelayMode: 0 | 5 | 10 | 30 | "custom";
startupDelayCustomSeconds: number;
```

## Settings UI

Add to GeneralSection or AdvancedSection:
- Dropdown: "Atraso inicial" with options [0s, 5s, 10s, 30s, Personalizado...]
- If "Personalizado" selected, show number input for seconds

## Migration Logic

In `mergeSettings` (defaults.ts), handle migration from old `startupDelaySeconds`:
- If old value is 0, 5, 10, 30 → set corresponding mode
- If other value → set mode to "custom" and customSeconds to that value

## Test Strategy

- Run existing tests
- Test each preset value
- Test custom value
- Verify migration from old settings

## Verification Commands

```bash
cd E:\obsidian-cascade
npm run compile
npm run test
npm run lint
```