# 005: Pause Game When Timer Modal Triggers

## Problem
When the timer completion modal displays, the game continues running in the background. The user wants the game to pause before the modal shows.

## Solution
Use `Navigation.OpenQuickAccessMenu()` from `@decky/ui` to open the Quick Access Menu before showing the modal. Opening this menu causes Steam to pause the running game.

## Files Modified
- `src/utils/steam.ts` - Added `pauseGame()` method using Navigation.OpenQuickAccessMenu()
- `src/index.tsx` - Call pauseGame() before modal, wrap showTimerModal in 150ms setTimeout

## Implementation

### Stage 1: Add pauseGame Method to SteamUtils

**File:** `src/utils/steam.ts`

```typescript
import { findModuleChild, Module, Navigation } from "@decky/ui";

export class SteamUtils {
  static async suspend() {
    SleepParent.OnSuspendRequest();
  }

  static pauseGame(): void {
    Navigation.OpenQuickAccessMenu();
  }
}
```

### Stage 2: Integrate Pause into handleTimerComplete

**File:** `src/index.tsx` (handleTimerComplete function)

```typescript
} else {
  // Pause the game first by opening Quick Access Menu
  SteamUtils.pauseGame();

  let countdownComplete = false;
  let isTransitioning = false;

  const showTimerModal = (secondsLeft: number) => {
    // ... existing modal logic unchanged ...
  };

  // Small delay to let pause take effect, then show modal
  setTimeout(() => {
    showTimerModal(3);
  }, 150);
}
```

## Flow Summary
1. Timer fires → `handleTimerComplete` called
2. Quick Access Menu opens (pauses game)
3. 150ms delay
4. Modal shows with 3s countdown
5. User presses A → suspends device
6. (If B pressed → modal re-shows per worklog 009 pattern)

## Testing Checklist
- [ ] Game pauses when timer fires (non-subtle mode)
- [ ] Modal appears correctly after pause
- [ ] 3-second countdown works
- [ ] B button re-show still works
- [ ] Subtle mode does NOT pause game
