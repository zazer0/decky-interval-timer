# Interval Timer Feature Implementation

**Date:** 2024-11-24
**Branch:** `feat/every5-between-intervals`
**Commits:** 6 atomic commits

## Overview

Replaced the three daily alarm slots with an interval timer that triggers popups every 5 minutes between user-configured start and end times.

## Key Requirements Gathered

- **Time selection:** Any arbitrary HH:MM for start and end times
- **Popup behavior:** Uses existing modal/toast with subtle mode toggle
- **Replaces:** Daily alarms entirely (not alongside)
- **Persistence:** Must survive plugin reloads and Steam Deck restarts
- **First trigger:** Immediately at start time (not after 5 minutes)

## Architecture Changes

### Backend (`main.py`)

| Component | Before | After |
|-----------|--------|-------|
| Settings key | `daily_alarms` (3 slots) | `interval_timer` (single config) |
| Checker method | `check_daily_alarms()` - once per day per slot | `check_interval_timer()` - every 5 min in interval |
| Callables | `set_daily_alarm`, `get_daily_alarms` | `set_interval_timer`, `get_interval_timer`, `toggle_interval_timer` |

**New data structure:**
```python
{
    "start_hour": int, "start_minute": int,
    "end_hour": int, "end_minute": int,
    "enabled": bool,
    "last_triggered_key": str  # "YYYY-MM-DD_HH:MM" for 5-min slot
}
```

**Critical helpers added:**
- `is_time_in_interval()` - handles midnight crossings (e.g., 22:00-02:00)
- `get_5min_slot_key()` - generates unique key per 5-minute window to prevent double-firing

### Frontend (`src/index.tsx`)

| Component | Before | After |
|-----------|--------|-------|
| UI | 3 `AlarmButton` components | 2 `IntervalButton` + toggle |
| State | `dailyAlarms` (Record of 3 slots) | `intervalTimer` (single IntervalTimerConfig) |
| Modal | Fixed title "Set Daily Alarm" | Dynamic title via prop |

**New components:**
- `IntervalButton` - displays time with label ("Start"/"End")
- `ToggleField` for "Every 5 Min Reminder" enable/disable

## Implementation Stages

1. **Backend data structures** - Added settings key + 3 callable methods
2. **Backend interval logic** - Added checker with helpers, updated loop
3. **Frontend state/callables** - Added interface, state, callable declarations
4. **Frontend UI components** - Added IntervalButton, modified TimePickerModal, updated JSX
5. **Frontend handlers** - Added click/save/toggle/load handlers, updated useEffect
6. **Dead code removal** - Cleaned up all daily alarm code from both files

## Edge Cases Handled

- **Midnight crossing:** Interval 22:00-02:00 works correctly
- **Plugin reload:** `last_triggered_key` persisted prevents duplicate alerts
- **Device wake:** 30-second checker resumes; slot key deduplication works
- **Exact 5-min boundaries:** Slot key rounds down to nearest 5 minutes

## Replication Notes

- Each stage left codebase in buildable state
- Stage 6 (cleanup) can only be done after all new code is in place
- `TimePickerModal` refactor (adding `title` prop) enables reuse
- Frontend handlers reference callables added in earlier stage - build warns until Stage 5 completes
- Existing `alarm_checker_loop` (30-second interval) was reused, only the method it calls changed

## Files Modified

- `main.py` - Backend logic (+99 lines new, -66 lines removed)
- `src/index.tsx` - Frontend UI (+159 lines new, -99 lines removed)

## Testing Checklist

- [ ] Set interval spanning midnight (e.g., 23:00-01:00)
- [ ] Toggle enabled/disabled persists after reload
- [ ] Popup appears at start time boundary
- [ ] Popup appears every 5 minutes within interval
- [ ] No duplicate popups within same 5-minute window
- [ ] Subtle mode toggle affects popup style
