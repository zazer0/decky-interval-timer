import { findModuleChild, Module, Navigation } from "@decky/ui";
import { EHIDKeyboardKey } from "@decky/ui/dist/globals/steam-client/Input";

const findModule = (property: string) => {
  return findModuleChild((m: Module) => {
    if (typeof m !== "object") return undefined;
    for (let prop in m) {
      try {
        if (m[prop][property]) {
          return m[prop];
        }
      } catch (e) {
        return undefined;
      }
    }
  });
};

const SleepParent = findModule("InitiateSleep");
export const NavSoundMap = findModule("ToastMisc");

export class SteamUtils {
  static async suspend() {
    SleepParent.OnSuspendRequest();
  }

  static pauseGame(): void {
    // Send ESC key press (pauses many games)
    SteamClient.Input.ControllerKeyboardSetKeyState(EHIDKeyboardKey.Escape, true);
    SteamClient.Input.ControllerKeyboardSetKeyState(EHIDKeyboardKey.Escape, false);

    // Delay to ensure ESC is processed before navigation
    setTimeout(() => {
      Navigation.NavigateToLibraryTab();
    }, 150);
  }
}
