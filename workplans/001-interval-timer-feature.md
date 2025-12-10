# 001: Interval Timer Feature (Minimal Safe Approach)

## Goal
Reuse existing alarm slots. alarm_1 = START, alarm_2 = END. Pop-up every 5 minutes within window.

## Safety Principle
**CHANGE ONLY WHAT'S NECESSARY. NO STRUCTURAL CHANGES.**

---

## Stage 1: Backend - Modify check_daily_alarms()
**File**: `main.py` (lines 277-311)

Replace body of `check_daily_alarms()` with:

```python
async def check_daily_alarms(self):
    """Check if we should trigger an interval reminder now"""
    now = datetime.now()
    current_hour = now.hour
    current_minute = now.minute
    today = date.today().isoformat()

    # Only trigger on 5-minute marks
    if current_minute % 5 != 0:
        return

    alarms = await self.settings_getSetting(settings_key_daily_alarms, {})

    # Use alarm_1 as START, alarm_2 as END
    start = alarms.get("alarm_1", {"hour": 21, "minute": 0})
    end = alarms.get("alarm_2", {"hour": 23, "minute": 0})

    # Check if current time is within interval
    current_mins = current_hour * 60 + current_minute
    start_mins = start["hour"] * 60 + start["minute"]
    end_mins = end["hour"] * 60 + end["minute"]

    in_interval = False
    if start_mins <= end_mins:
        # Normal: 21:00 → 23:00
        in_interval = start_mins <= current_mins <= end_mins
    else:
        # Midnight crossing: 22:00 → 02:00
        in_interval = current_mins >= start_mins or current_mins <= end_mins

    if not in_interval:
        return

    # Check if already triggered this minute
    trigger_key = f"{today}-{current_hour:02d}:{current_minute:02d}"
    last_triggered = alarms.get("last_triggered", "")

    if trigger_key == last_triggered:
        return

    # Trigger!
    alarms["last_triggered"] = trigger_key
    await self.settings_setSetting(settings_key_daily_alarms, alarms)
    await self.settings_commit()

    subtle = await self.settings_getSetting(settings_key_subtle_mode, False)
    await decky.emit("simple_timer_event", f"Reminder ({current_hour:02d}:{current_minute:02d})", subtle)
    decky.logger.info(f"Interval triggered at {current_hour:02d}:{current_minute:02d}")
```

---

## Stage 2: Frontend - Relabel Buttons, Hide 3rd
**File**: `src/index.tsx` (lines 294-308)

Replace the alarm buttons render with:

```tsx
<PanelSectionRow>
  <Focusable flow-children="row" style={{ display: 'flex', justifyContent: 'center', gap: 16, paddingBottom: 8 }}>
    {Object.entries(dailyAlarms).slice(0, 2).map(([key, alarm], idx) => (
      <div key={key} style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 12, marginBottom: 4, color: '#aaaaaa' }}>
          {idx === 0 ? 'START' : 'END'}
        </div>
        <AlarmButton
          slot={idx + 1}
          hour={alarm.hour}
          minute={alarm.minute}
          onClick={() => handleAlarmClick(idx + 1)}
        />
      </div>
    ))}
  </Focusable>
</PanelSectionRow>
```

---

## What Stays Unchanged
- All callables
- All state management
- All initialization logic
- Timer functionality
- Settings persistence
