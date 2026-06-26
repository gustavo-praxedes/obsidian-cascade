# Plan: Preserve `[/]` Status in Forwardable Status in Forwardable Migration (Issue #3)

## Problem
`prepareForwardableMigratedBlock` in `src/tasks/task-serializer.ts` converts all tasks to `[ ]` (open) when migrating forwardable tasks (🔜 marker), but should preserve the original status like `prepareMigratedBlock` does.

## Current Code Analysis

### `prepareMigratedBlock` (Correct - lines 88-110)
```typescript
// Line 95-97: Preserves original status for main task
const match = line.match(/^(\\s*)-\\s+\\[([^\\]])\\]/);
originalStatus = match?.[2] ?? " ";
prepared.push(originalStatus === "/" ? withTaskStatus(line, "/") : toOpenTask(line));
```

### `prepareForwardableMigratedBlock` (Bug - lines 112-131)
```typescript
// Line 118: Always converts to open task, loses status
prepared.push(preserveTimeMarker(line, stripMarker(toOpenTask(line))));
```

### `prepareCarriedBlock` in migration-service.ts (Uses buggy function - line 58-61)
```typescript
private prepareCarriedBlock(task: TaskBlock): string {
  const prepared = prepareForwardableMigratedBlock(task.block);
  return this.settings.taskSetCreatedDate ? withCreatedDate(prepared, new Date()) : prepared;
}
```

## Fix Required

1. **Modify `prepareForwardableMigratedBlock`** to accept and preserve original status (similar to `prepareMigratedBlock`)
2. **Update callers** in `migration-service.ts`:
   - `prepareForwardedBlock` (line 51-56) - passes `task.status`
   - `prepareCarriedBlock` (line 58-61) - should pass `task.status`

## Files to Modify

1. `src/tasks/task-serializer.ts` - Add `prepareForwardableMigratedBlockPreservingStatus` or modify existing
2. `src/tasks/migration-service.ts` - Update callers to pass status

## Test Strategy

- Run existing tests: `npm run test`
- Check for test files related to task-serializer and migration-service
- Add test case for `[/]` preservation if needed

## Verification Commands

```bash
cd E:\obsidian-cascade
npm run compile   # TypeScript compile
npm run test      # Run tests
npm run lint      # Lint check
```