# 006: 3-Second Dismiss Delay for Ignore Button

## Goal
Prevent accidental dismissal of timer alerts by requiring users to wait 3 seconds before the "Ignore" button becomes functional.

## Implementation

### Approach
Used `showModal().Update()` to dynamically update `ConfirmModal` props during a countdown, leveraging `bCancelDisabled` prop to control button state.

### Key Code Changes
**File**: `src/index.tsx` (lines 347-392)

1. Capture `showModal()` return value as `modalResult`
2. Initial modal shows `strCancelButtonText="(3s)"` with `bCancelDisabled={true}`
3. Three `setTimeout` calls at 1s, 2s, 3s intervals call `modalResult.Update()` to:
   - Update countdown text: `(3s)` → `(2s)` → `(1s)` → `Ignore`
   - Enable button after 3s: `bCancelDisabled={false}`

### Critical Bug Fix: Modal Not Dismissing

**Problem**: Neither "Suspend Now" nor "Ignore" dismissed the modal after clicking.

**Root Cause**: `Update()` replaces the modal component but does NOT preserve the original `closeModal` callback chain. Both `onOK` and `onCancel` handlers lose their ability to close the modal.

**Solution**: Explicitly call `modalResult.Close()` in BOTH handlers:
```typescript
onOK={async () => { await SteamUtils.suspend(); modalResult.Close(); }}
onCancel={() => modalResult.Close()}
```

## Key Insight for Future Work

When using `showModal().Update()` with Decky's `ConfirmModal`:
- **DO NOT** rely on automatic modal close behavior
- **ALWAYS** explicitly call `modalResult.Close()` in both `onOK` and `onCancel` handlers
- The `Update()` method breaks internal callback chains - treat each updated component as needing full explicit handler wiring

## Files Modified
- `src/index.tsx`: `handleTimerComplete` function (lines 347-392)
