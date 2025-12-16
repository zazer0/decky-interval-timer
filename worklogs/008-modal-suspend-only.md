# 008: Modal Suspend-Only with Countdown

## Problem
Timer completion modal could be dismissed by gamepad B button during the 3-second countdown. Multiple fix attempts failed:
1. `onCancel={() => {}}` - Only affects callback after close, not the close itself
2. `closeModal={conditionalClose}` - Steam's `showModal()` overrides at creation time

## Root Cause Discovery
Steam's `ConfirmModal` has internal `onGamepadCancel` handler that calls `closeModal()` directly, bypassing:
- `bCancelDisabled` prop (only visual)
- `onCancel` callback (notification hook, runs after close)
- Custom `closeModal` prop (overridden by `showModal()` at instant 0)

**Key insight:** Cannot reliably intercept B button at modal creation instant - Steam's modal system fires before React props apply.

## Solution
Remove dismiss functionality entirely. Force user to click "Suspend Now" after 3-second countdown.

### Implementation
In `src/index.tsx` `handleTimerComplete()` function:

**0-2 seconds (3 modals):**
```tsx
strOKButtonText="(3s)" / "(2s)" / "(1s)"
bOKDisabled={true}
onOK={() => {}}
strCancelButtonText="Ignore"
bCancelDisabled={true}
onCancel={() => {}}
```

**3+ seconds (final modal):**
```tsx
strOKButtonText="Suspend Now"
bOKDisabled={false}
onOK={async () => { await SteamUtils.suspend(); modalResult.Close(); }}
strCancelButtonText="Ignore"
bCancelDisabled={true}
onCancel={() => {}}
```

## Final Behavior
| Time | OK Button (A) | Cancel Button (B) |
|------|---------------|-------------------|
| 0-2s | Countdown, disabled, no-op | "Ignore" disabled, no-op |
| 3s+ | "Suspend Now" **enabled** | "Ignore" disabled, no-op |

## Key Learnings
1. `bCancelDisabled`/`bOKDisabled` only affect visual state, not gamepad input
2. `onCancel`/`onOK` callbacks run after/alongside close - not gatekeepers
3. `closeModal` prop gets overridden by `showModal()` wrapper at creation
4. `bAlertDialog={true}` hides cancel button visually but B button still triggers internal handler
5. Only reliable fix: make both callbacks no-ops AND keep buttons disabled

## Files Changed
- `src/index.tsx`: Lines 354-401 (handleTimerComplete modal logic)

## Props Reference (ConfirmModal)
- `bOKDisabled` - Disables OK button visually
- `bCancelDisabled` - Disables Cancel button visually
- `bAlertDialog` - Shows only OK button (but doesn't block B)
- `onOK`/`onCancel` - Callbacks (not gatekeepers)
