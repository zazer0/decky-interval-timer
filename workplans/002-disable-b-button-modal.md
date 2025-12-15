# Workplan 002: Disable B Button from Closing Timer Modal

## Goal
Prevent the 'B' button (gamepad cancel button) from ever closing the timer modal.

## Stage 1: Keep B Button Permanently Disabled

**File**: `src/index.tsx`
**Line**: 388

### Change
```diff
- bCancelDisabled={false}
+ bCancelDisabled={true}
```

### Result
- Countdown UI preserved: "(3s)" → "(2s)" → "(1s)" → "Ignore"
- "Ignore" button visible but permanently disabled/greyed out
- Only "Suspend Now" (A button) dismisses the modal
