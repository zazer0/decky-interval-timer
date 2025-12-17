# 010: Pause Game When Timer Modal Triggers

## Problem
When timer completion modal displays, the game continues running in the background. User needs game paused before modal shows.

## Solution
Navigate to Library tab before showing modal - this pauses the running game.

## Key Discovery: Navigation APIs That Pause Games

| API | Pauses Game? | Notes |
|-----|--------------|-------|
| `Navigation.NavigateToLibraryTab()` | ✅ YES | **Working solution** |
| `Navigation.OpenMainMenu()` | ❌ NO | Did not work |
| `Navigation.OpenQuickAccessMenu()` | ❌ NO | Opens QAM sidebar only |
| `Navigation.OpenPowerMenu()` | ❓ Untested | Opens power overlay |

## Implementation

**File:** `src/utils/steam.ts`

```typescript
import { Navigation } from "@decky/ui";

export class SteamUtils {
  static pauseGame(): void {
    Navigation.NavigateToLibraryTab();
  }
}
```

**File:** `src/index.tsx` (handleTimerComplete, non-subtle branch)

```typescript
} else {
  SteamUtils.pauseGame();  // Pause game first

  // ... existing modal logic ...

  setTimeout(() => {
    showTimerModal(3);
  }, 150);  // Small delay for navigation to complete
}
```

## Flow
1. Timer fires → `handleTimerComplete()` called
2. `NavigateToLibraryTab()` → game pauses, Steam Deck shows library
3. 150ms delay
4. Modal shows with 3s countdown (on top of library view)
5. User presses A → device suspends

## Integration with fnOnClose Re-show Pattern (Worklog 009)
- Pause happens once at start, not per modal re-show
- Existing `countdownComplete` and `isTransitioning` flags unchanged
- B button re-show still works as before

## Files Changed
- `src/utils/steam.ts`: Added `pauseGame()` method using `NavigateToLibraryTab()`
- `src/index.tsx`: Call `pauseGame()` before modal, wrap `showTimerModal(3)` in 150ms setTimeout

## API Reference
```typescript
// From @decky/ui Navigation interface
Navigation.NavigateToLibraryTab(): void  // Navigates to library, pauses game
Navigation.OpenQuickAccessMenu(): void   // Opens QAM (no pause)
Navigation.OpenMainMenu(): void          // Opens main menu (no pause)
```
