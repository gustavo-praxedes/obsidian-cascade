# Plan: Issue #7 - Preserve ⏰ Time Marker in ALL Migration Paths

## Problem
Spec §9: "O marcador ⏰ HH:mm é preservado. Não influencia a migração."
Current implementation has `preserveTimeMarker` in `task-serializer.ts` but it's not used in all migration paths.

## Current Code Analysis

### `preserveTimeMarker` (lines 36-42) - EXISTS
```typescript
export function preserveTimeMarker(original: string, processed: string): string {
  if (hasTimeMarker(processed)) return processed;
  const marker = extractTimeMarker(original);
  if (!marker) return processed;
  if (/#\w/u.test(processed)) return processed.replace(/\s(#\w)/u, `${marker} $1`);
  return `${processed}${marker}`;
}
```

### Where it's USED:
- `prepareRecurringTask` (line 57) ✅
- `prepareForwardableMigratedBlock` (line 118) ✅
- `prepareForwardableMigratedBlockPreservingStatus` (line 118) ✅

### Where it may be MISSING:
- `prepareMigratedBlock` (line 88-110) - main migration path
- `prepareCarriedBlock` in migration-service.ts (line 58-61)
- `prepareForwardedBlock` in migration-service.ts (line 51-56)
- `seedAnnualFromRecurring` - may not preserve
- `insertRecurringOccurrence` - may not preserve

## Fix Required

1. **Audit ALL migration paths** in `migration-service.ts` and ensure `preserveTimeMarker` is called
2. **Update `prepareMigratedBlock`** to preserve time marker
3. **Ensure all callers** of preparation functions preserve time marker

## Files to Modify

1. `src/tasks/task-serializer.ts` - Update `prepareMigratedBlock` to use `preserveTimeMarker`
2. `src/tasks/migration-service.ts` - Verify all preparation calls preserve time marker

## Key Migration Paths to Check

| Path | Function | Status |
|------|----------|--------|
| Annual → Monthly | `prepareForwardedBlock` | ✅ Uses `prepareForwardableMigratedBlock` which preserves |
| Monthly → Daily | `prepareForwardedBlock` | ✅ Same |
| Daily → Daily (carry) | `prepareCarriedBlock` | ✅ Uses preserving version for `/` |
| Recurring → Annual | `prepareRecurringTask` | ✅ Preserves |
| Recurring → Monthly/Weekly/Daily | `insertRecurringOccurrence` | ❓ Need to check |
| Main task migration | `prepareMigratedBlock` | ❌ May not preserve |

## Test Strategy

- Run existing tests
- Add test case with ⏰ marker to verify preservation through all paths
- Check both forwardable (🔜) and ephemeral (🔚) tasks

## Verification Commands

```bash
cd E:\obsidian-cascade
npm run compile
npm run test
npm run lint
```