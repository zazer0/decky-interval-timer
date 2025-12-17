# 011: ESC Key Press for Universal Game Pause

## Problem
Worklog 010's `NavigateToLibraryTab()` doesn't pause all games. Some games require explicit pause menu trigger (menu button / ESC key) before they'll pause.

## Root Cause
- `NavigateToLibraryTab()` switches view but doesn't send pause input to the game
- Some games continue running in background unless explicitly paused via ESC/menu button

## API Research Findings

| Approach | API | Result |
|----------|-----|--------|
| Direct gamepad button injection | None available | No public Decky API exists |
| Keyboard key injection | `SteamClient.Input.ControllerKeyboardSetKeyState()` | **Works** |
| `Navigation.OpenMainMenu()` | Tested in worklog 010 | Does not pause games |

## Solution
Send ESC key press before navigating to library. ESC pauses most games.

## Implementation

**File:** `src/utils/steam.ts`

```typescript
import { EHIDKeyboardKey } from "@decky/ui/dist/globals/steam-client/Input";

static pauseGame(): void {
  // Send ESC key press (pauses many games)
  SteamClient.Input.ControllerKeyboardSetKeyState(EHIDKeyboardKey.Escape, true);
  SteamClient.Input.ControllerKeyboardSetKeyState(EHIDKeyboardKey.Escape, false);

  // Delay to ensure ESC is processed before navigation
  setTimeout(() => {
    Navigation.NavigateToLibraryTab();
  }, 150);
}
```

## Key Technical Details

1. **SteamClient is global** - Don't import it, it's declared via `declare global { var SteamClient }` in `@decky/ui`

2. **EHIDKeyboardKey enum** - Import from `@decky/ui/dist/globals/steam-client/Input`

3. **Key press = true/false pair** - Must send both key down (`true`) and key up (`false`)

4. **150ms delay required** - Without delay, `NavigateToLibraryTab()` executes before ESC is processed, causing ESC to trigger after navigation (returning user to game)

## API Reference
```typescript
// From @decky/ui SteamClient.Input interface
SteamClient.Input.ControllerKeyboardSetKeyState(
  key: EHIDKeyboardKey,  // e.g., EHIDKeyboardKey.Escape
  state: boolean         // true = key down, false = key up
): void
```

## Files Changed
- `src/utils/steam.ts` - Added ESC key press with 150ms delay before `NavigateToLibraryTab()`

## Flow (Updated from Worklog 010)
1. Timer fires → `handleTimerComplete()` called
2. `pauseGame()` → ESC key press sent to game
3. 150ms delay
4. `NavigateToLibraryTab()` → Steam Deck shows library
5. 150ms delay (from worklog 010)
6. Modal shows with 3s countdown
7. User presses A → device suspends
