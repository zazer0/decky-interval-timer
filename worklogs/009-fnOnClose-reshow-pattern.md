# 009: fnOnClose Re-show Pattern for Modal Dismissal Block

## Problem
B button could dismiss timer completion modal immediately, bypassing 3-second countdown delay - despite previous fixes in 007 and 008.

## Root Cause
Steam's `ConfirmModal` has internal `onGamepadCancel` handler that calls `closeModal()` directly, bypassing:
- `bCancelDisabled` prop (visual only)
- `onCancel` callback (post-close notification, not gatekeeper)
- Custom `closeModal` prop (overridden by `showModal()` at creation)

**Critical insight:** `Update()` method breaks the `fnOnClose` callback chain - callbacks set at modal creation become stale after updates.

## Solution: fnOnClose Re-show Pattern

Instead of trying to block dismissal, **detect and re-show** the modal when prematurely dismissed.

### Key Technique
Use `showModal`'s third argument `{ fnOnClose }` to detect any dismissal, then immediately re-show:

```typescript
showModal(
  <ConfirmModal ... />,
  undefined,
  {
    fnOnClose: () => {
      if (!countdownComplete && !isTransitioning) {
        setTimeout(() => showTimerModal(secondsLeft), 50);
      }
    }
  }
);
```

### Why Fresh Modals Instead of Update()
`Update()` breaks the `fnOnClose` callback chain. Solution: close and re-show fresh modals for each countdown tick to maintain working callbacks.

## Implementation

### State Flags
```typescript
let countdownComplete = false;    // True when user presses Suspend Now
let isTransitioning = false;      // True during planned countdown transitions
```

### Recursive Modal Function
```typescript
const showTimerModal = (secondsLeft: number) => {
  const isCountdownDone = secondsLeft <= 0;

  const modalResult = showModal(
    <ConfirmModal
      strOKButtonText={isCountdownDone ? "Suspend Now" : `(${secondsLeft}s)`}
      bOKDisabled={!isCountdownDone}
      bCancelDisabled={true}
      onOK={isCountdownDone ? async () => {
        countdownComplete = true;  // Prevent re-show
        await SteamUtils.suspend();
        modalResult.Close();
      } : () => {}}
      onCancel={() => {}}
    />,
    undefined,
    { fnOnClose: () => {
        if (!countdownComplete && !isTransitioning) {
          setTimeout(() => showTimerModal(secondsLeft), 50);
        }
      }
    }
  );

  if (!isCountdownDone) {
    setTimeout(() => {
      isTransitioning = true;     // Prevent fnOnClose re-show
      modalResult.Close();
      isTransitioning = false;
      showTimerModal(secondsLeft - 1);
    }, 1000);
  }
};

showTimerModal(3);  // Start countdown
```

## Flow Summary
1. Modal shows `(3s)` → B pressed → `fnOnClose` fires → re-shows `(3s)`
2. After 1s → `isTransitioning=true` → close → show `(2s)` → continue
3. After 3s → shows "Suspend Now" enabled
4. A pressed → `countdownComplete=true` → suspend → close (no re-show)

## Key Learnings
1. **`fnOnClose` is the only reliable dismissal hook** - fires for any close method
2. **`Update()` breaks callbacks** - use fresh modals to maintain callback chain
3. **State flags pattern** - `countdownComplete` + `isTransitioning` control re-show behavior
4. **50ms delay on re-show** - prevents visual flash/race conditions

## Files Changed
- `src/index.tsx`: Lines 343-398 (handleTimerComplete function)

## API Reference (showModal)
```typescript
showModal(
  modal: ReactElement,           // The modal component
  parent?: HTMLElement,          // Usually undefined
  options?: {
    fnOnClose?: () => void;      // Called when modal closes (any method)
    // ... other options
  }
): { Update, Close }
```
