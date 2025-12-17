# 004: Block B Button Dismissal During 3-Second Countdown

## Problem
The B button can still dismiss the timer completion modal immediately, bypassing the 3-second countdown delay. This happens because Steam's `ConfirmModal` has an internal `onGamepadCancel` handler that calls `closeModal()` directly, bypassing:
- `bCancelDisabled` prop (only visual)
- `onCancel` callback (runs after/alongside close, not a gatekeeper)
- Custom `closeModal` prop (overridden by `showModal()` at creation time)

## Goal
Prevent ALL modal dismissal via B button entirely. User must click "Suspend Now" after the 3-second countdown completes.

## Solution: Re-show Modal on Premature Dismiss

Use `showModal`'s `fnOnClose` callback to detect when the modal is closed. If closed before countdown completes, immediately re-show the modal.

### Key Insight
Instead of using `Update()` (which breaks the `fnOnClose` callback chain), close and re-show a fresh modal for each countdown tick. This ensures `fnOnClose` works consistently.

---

## Implementation

### Stage 1: Refactor modal to use re-show pattern

**File:** `src/index.tsx` (lines 343-403)

Replace current `handleTimerComplete` modal logic with:

```typescript
const handleTimerComplete = (message: string, subtle: boolean) => {
  const Alarm = () => <audio src={directoryPath + 'alarm.mp3'} autoPlay />;

  (window.document.getElementById('alarm-sound') as HTMLAudioElement)?.play();

  if (subtle) {
    toaster.toast({
      title: message,
      body: "Your timer has finished."
    });
  } else {
    let countdownComplete = false;
    let isTransitioning = false;  // Prevent re-show during planned transitions

    const showTimerModal = (secondsLeft: number) => {
      const isCountdownDone = secondsLeft <= 0;

      const modalResult = showModal(
        <ConfirmModal
          children={<Alarm />}
          strTitle={message}
          strDescription="Your timer has finished."
          strOKButtonText={isCountdownDone ? "Suspend Now" : `(${secondsLeft}s)`}
          bOKDisabled={!isCountdownDone}
          strCancelButtonText="Ignore"
          bCancelDisabled={true}
          onOK={isCountdownDone ? async () => {
            countdownComplete = true;
            await SteamUtils.suspend();
            modalResult.Close();
          } : () => {}}
          onCancel={() => {}}
        />,
        undefined,
        {
          fnOnClose: () => {
            if (!countdownComplete && !isTransitioning) {
              setTimeout(() => showTimerModal(secondsLeft), 50);
            }
          }
        }
      );

      if (!isCountdownDone) {
        setTimeout(() => {
          isTransitioning = true;
          modalResult.Close();
          isTransitioning = false;
          showTimerModal(secondsLeft - 1);
        }, 1000);
      }
    };

    showTimerModal(3);
  }
};
```

### Key Changes
1. **New state flags**: `countdownComplete` and `isTransitioning` control re-show behavior
2. **Recursive `showTimerModal(secondsLeft)`**: Creates fresh modal for each countdown tick
3. **`fnOnClose` callback**: Detects premature dismissal and re-shows modal
4. **B button always disabled**: `bCancelDisabled={true}` and `onCancel={() => {}}` always

---

## Files Changed
- `src/index.tsx`: Lines 343-403 (handleTimerComplete function)

## Testing Checklist
- [ ] B button during countdown (0-3s) re-shows modal
- [ ] B button after countdown still re-shows modal (never dismissable)
- [ ] A button disabled during countdown
- [ ] A button suspends after countdown
- [ ] Audio plays on modal show
- [ ] Multiple rapid B presses do not cause issues
- [ ] Countdown transitions smoothly (no flicker)
