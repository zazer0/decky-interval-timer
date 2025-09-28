# Steam Deck Timer Popup System Architecture

## 1. Overview

The Simple Timer plugin implements a dual-mode popup notification system for Steam Deck using the Decky framework. The system supports both subtle toast notifications and full-screen modal alerts with audio feedback.

### Event Flow
```
Python Backend (main.py)
    ↓ decky.emit()
WebSocket Transport
    ↓
Frontend Event Listener (index.tsx)
    ↓ addEventListener()
Popup Display (Toast/Modal)
    ↓
User Action → Suspend/Dismiss
```

### Key Files
- `/src/index.tsx` - Frontend UI and popup handling (lines 190-222)
- `/main.py` - Backend timer logic and event emission (lines 70-90)
- `/src/utils/steam.ts` - Steam Deck integration utilities
- `/src/alarm.mp3` - Audio notification file

## 2. Popup Types and Behavior

### Toast Notification (Subtle Mode)
Small, non-intrusive notification that appears briefly in the corner.

```typescript
// index.tsx, lines 196-200
toaster.toast({
  title: message,
  body: "Your timer has finished."
})
```

### Modal Alert (Full-Screen)
Blocking modal that requires user interaction with two action buttons.

```typescript
// index.tsx, lines 202-209
showModal(<ConfirmModal
  children={<Alarm />}
  strTitle={message}
  strDescription="Your timer has finished. You can either suspend now, or ignore the alert."
  strOKButtonText="Suspend Now"
  strCancelButtonText="Ignore"
  onOK={async () => await SteamUtils.suspend()}
/>);
```

## 3. Event System Architecture

### Event Registration and Handling

The frontend registers event listeners on component mount:

```typescript
// index.tsx, line 213
addEventListener<[message: string, subtle: boolean]>("simple_timer_event", handleTimerComplete);
```

Backend emits events via Decky's WebSocket transport:

```python
# main.py, lines 88-89
subtle = await self.settings_getSetting(settings_key_subtle_mode, False)
await decky.emit("simple_timer_event", "Your session has ended!", subtle)
```

### Key Events Table

| Event Name | Purpose | Payload | Source |
|------------|---------|---------|---------|
| `simple_timer_event` | Timer completion notification | `[message: string, subtle: boolean]` | main.py:89 |
| `simple_timer_seconds_updated` | Countdown update | `seconds: number` | main.py:83,86,93,115 |
| `simple_timer_refresh_recents` | Update recent timers list | `recents: number[]` | main.py:103 |
| `simple_timer_subtle` | Subtle mode state change | `subtle: boolean` | main.py:112 |

## 4. Implementation Details

### Backend Timer Logic

The timer runs as an async task with 5-second update intervals:

```python
# main.py, lines 70-90
async def timer_handler(self, timer_end: datetime):
    self.seconds_remaining = self.get_time_difference(timer_end.timestamp())

    while self.seconds_remaining > 0:
        await asyncio.sleep(5)  # Update every 5 seconds
        self.seconds_remaining = self.get_time_difference(timer_end.timestamp())

        if (self.seconds_remaining <= -10):  # Grace period check
            await self.cancel_timer()
            await decky.emit("simple_timer_event", "Your timer has expired!", True)
            return

        await decky.emit("simple_timer_seconds_updated", self.seconds_remaining)

    # Timer complete
    self.seconds_remaining = 0
    await decky.emit("simple_timer_seconds_updated", self.seconds_remaining)
    subtle = await self.settings_getSetting(settings_key_subtle_mode, False)
    await decky.emit("simple_timer_event", "Your session has ended!", subtle)
```

### Frontend Event Handling

The frontend maintains state synchronized with backend events:

```typescript
// index.tsx, lines 75-101
useEffect(() => {
  const handleSecondsRemaining = (seconds: number) => {
    setSecondsRemaining(seconds);
  };

  const handleSubtleModeUpdate = (subtle: boolean) => {
    setSubtleMode(subtle);
  }

  addEventListener<[seconds: number]>("simple_timer_seconds_updated", handleSecondsRemaining);
  addEventListener<[subtle: boolean]>("simple_timer_subtle", handleSubtleModeUpdate);

  // Cleanup on unmount
  return () => {
    removeEventListener("simple_timer_seconds_updated", handleSecondsRemaining);
    removeEventListener("simple_timer_subtle", handleSubtleModeUpdate);
  }
}, []);
```

## 5. Audio Integration

Audio plays automatically when the popup appears:

```typescript
// index.tsx, lines 192-194
const Alarm = () => <audio src={directoryPath + 'alarm.mp3'} autoPlay />;
(window.document.getElementById('alarm-sound') as HTMLAudioElement)?.play();
```

The audio file path is dynamically constructed:
```typescript
// index.tsx, line 65
const directoryPath = import.meta.url.substring(0, import.meta.url.lastIndexOf('/') + 1);
```

## 6. Steam Deck Integration

### Decky Framework APIs

The plugin uses Decky's UI components and API:

```typescript
// index.tsx, lines 1-20
import {
  ConfirmModal,
  showModal,
  ToggleField
} from "@decky/ui";

import {
  addEventListener,
  callable,
  toaster,
} from "@decky/api";
```

### Steam-Specific Features

Suspend functionality integrates with Steam Deck's power management:

```typescript
// index.tsx, line 208
onOK={async () => await SteamUtils.suspend()}
```

## 7. Configuration and Settings

### Settings Persistence

Backend manages settings through SettingsManager:

```python
# main.py, lines 8-16
settingsDir = os.environ["DECKY_PLUGIN_SETTINGS_DIR"]
settings = SettingsManager(name="settings", settings_directory=settingsDir)

settings_key_subtle_mode="subtle_mode"
settings_key_recent_timers="recent_timers_seconds"
settings_key_timer_end="timer_end"
```

### Subtle Mode Toggle

UI toggle controls popup behavior:

```typescript
// index.tsx, lines 156-165
<ToggleField
  disabled={secondsRemaining > 0 && secondsRemaining < 30}
  icon={<FaVolumeDown />}
  checked={subtleMode}
  label="Subtle Mode"
  description="You will be presented with a small toast instead of a fullscreen popup."
  onChange={(newVal: boolean) => {
    saveSubtleMode(newVal);
  }}
/>
```

## 8. Developer Quick Start

### Testing Popups

To trigger a test popup directly from backend:
```python
# In main.py, add test method:
async def test_popup(self, subtle=False):
    await decky.emit("simple_timer_event", "Test Alert!", subtle)
```

To trigger from frontend console:
```javascript
// Test toast notification
window.Decky.backend.emit("simple_timer_event", ["Test Toast", true]);

// Test modal alert
window.Decky.backend.emit("simple_timer_event", ["Test Modal", false]);
```

### Modifying Popup Behavior

1. **Change toast duration/style**: Modify `toaster.toast()` parameters in `index.tsx:197-200`
2. **Customize modal buttons**: Edit `ConfirmModal` props in `index.tsx:202-209`
3. **Add new event types**: Register in `index.tsx:213` and emit from `main.py`
4. **Modify audio**: Replace `/src/alarm.mp3` or change playback logic in `index.tsx:192-194`

## 9. Code Examples

### Complete Working Example: Custom Notification

Frontend handler:
```typescript
// Add to index.tsx
const handleCustomNotification = (title: string, body: string, critical: boolean) => {
  if (critical) {
    showModal(<ConfirmModal
      strTitle={title}
      strDescription={body}
      strOKButtonText="Acknowledge"
    />);
  } else {
    toaster.toast({ title, body });
  }
};

addEventListener<[title: string, body: string, critical: boolean]>(
  "custom_notification",
  handleCustomNotification
);
```

Backend emitter:
```python
# Add to main.py
async def send_custom_notification(self, title: str, body: str, critical: bool = False):
    await decky.emit("custom_notification", title, body, critical)
```

### Timer State Check Example

```python
# main.py - Check if timer is active
def is_timer_active(self):
    return self.seconds_remaining > 0

async def get_timer_status(self):
    if self.is_timer_active():
        return {
            "active": True,
            "remaining": self.seconds_remaining,
            "subtle_mode": await self.settings_getSetting(settings_key_subtle_mode, False)
        }
    return {"active": False}
```

## 10. Troubleshooting

### Common Issues and Solutions

| Issue | Solution |
|-------|----------|
| Popup not appearing | Check WebSocket connection in Decky logs, verify event names match exactly |
| Audio not playing | Ensure `alarm.mp3` exists in `/src/`, check browser audio permissions |
| Modal buttons unresponsive | Verify `onOK`/`onCancel` handlers are async functions |
| Events not received | Check event listener cleanup, ensure no duplicate registrations |
| Timer persists after reload | Backend maintains state; call `cancel_timer()` to reset |
| Subtle mode not saving | Verify settings directory permissions, check `settings.commit()` calls |

### Debug Commands

```bash
# View Decky logs
journalctl -u plugin_loader -f

# Check event emission
grep "simple_timer_event" ~/.local/share/decky-loader/logs/decky.log

# Verify settings file
cat $DECKY_PLUGIN_SETTINGS_DIR/settings.json
```

### Testing Checklist

- [ ] Timer completes with modal in normal mode
- [ ] Timer completes with toast in subtle mode
- [ ] Audio plays on completion
- [ ] Suspend button works correctly
- [ ] Settings persist across reloads
- [ ] Timer resumes after Steam Deck sleep/wake
- [ ] Recent timers update correctly
- [ ] Countdown updates every 5 seconds