# 007: B Button Block During Modal Countdown

## Problem
Timer completion modal could be dismissed by gamepad B button during the 3-second countdown, even though the visual "Ignore" button was greyed out.

## Root Cause
`bCancelDisabled={true}` in Decky's `ConfirmModal` **only disables the visual button**, not the gamepad input. Steam's internal `onGamepadCancel` handler still fires and invokes the `onCancel` callback regardless of this prop.

### Key Insight
`ConfirmModal` is not implemented by Decky - it's Steam's internal component found via webpack:
```typescript
// From @decky/ui Modal.ts
export const ConfirmModal = findModuleExport(
  (e: Export) => e?.toString()?.includes('onGamepadCancel'),
) as FC<ConfirmModalProps>;
```

The `onGamepadCancel` internal handler bypasses `bCancelDisabled` and directly calls `onCancel`.

## Solution
Two-part fix in `src/index.tsx` `handleTimerComplete()` function:

### 1. Block B button during countdown
Change `onCancel` to no-op for first 3 modal instances:
```typescript
// Lines 356, 368, 379 (0s, 1s, 2s updates)
onCancel={() => {}}  // was: onCancel={() => modalResult.Close()}
```

### 2. Enable visual button after countdown
Line 388 (3s update):
```typescript
bCancelDisabled={false}  // was: bCancelDisabled={true}
onCancel={() => modalResult.Close()}  // kept functional
```

## Final Behavior
| Time | "Ignore" Button | B Button (Gamepad) |
|------|-----------------|-------------------|
| 0-3s | Disabled (greyed) | Blocked (no-op) |
| 3s+ | Enabled (clickable) | Works |

"Suspend Now" (A button) always works.

## Files Changed
- `src/index.tsx`: Lines 356, 368, 379 (onCancel no-op), Line 388 (bCancelDisabled=false)

## Lessons Learned
- Decky UI props like `bCancelDisabled` only control visual state, not gamepad input
- Steam's internal components have separate input handlers that bypass prop-based disabling
- To truly block gamepad input, make the callback itself a no-op
