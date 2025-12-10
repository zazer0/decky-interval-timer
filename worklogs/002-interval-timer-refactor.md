# 002: Interval Timer Refactor

## Context
- **Problem**: User wanted to change from 3 individual daily alarms to an interval-based system (START/END times, pop-up every 5 min)
- **Constraint**: Previous attempt crashed Steam Deck into boot loop (frozen on login, required SSH sudo removal)
- **Risk factor**: Complex state restoration / persistence logic during plugin initialization

## Approach: Minimal Safe Change

### Key Insight
Instead of building new infrastructure, **reuse existing alarm slots**:
- `alarm_1` → START time
- `alarm_2` → END time
- `alarm_3` → hidden (unused)

### Why This Works
- No new callables needed (frontend uses existing `set_daily_alarm`, `get_daily_alarms`)
- No new state management (reuses `dailyAlarms` React state)
- No changes to initialization logic (`_main()` untouched)
- Same settings persistence structure

## Changes Made

### Stage 1: Backend (`main.py`)
**File**: `main.py` lines 277-324
**Method**: `check_daily_alarms()` body replaced

| Before | After |
|--------|-------|
| Loop through all 3 alarms | Use alarm_1/alarm_2 as interval bounds |
| Trigger at exact HH:MM match | Trigger on 5-minute marks (`:00`, `:05`, `:10`...) |
| Track `last_triggered` per-alarm per-day | Track `last_triggered` per-minute (`{date}-{HH}:{MM}`) |

**Midnight crossing handled**:
```python
if start_mins <= end_mins:
    in_interval = start_mins <= current_mins <= end_mins
else:
    in_interval = current_mins >= start_mins or current_mins <= end_mins
```

### Stage 2: Frontend (`src/index.tsx`)
**File**: `src/index.tsx` lines 294-312

| Before | After |
|--------|-------|
| 3 alarm buttons rendered | `.slice(0, 2)` shows only first 2 |
| No labels | "START" / "END" labels above buttons |
| `gap: 8` | `gap: 16` for better spacing |

## Commits
1. `f3952fc` - feat(backend): change alarm checker to interval-based 5-min triggers
2. `a1dab1c` - feat(frontend): show START/END labels, hide 3rd alarm button

## What Stayed Unchanged (Boot Loop Prevention)
- `_main()` initialization logic
- `_unload()` cleanup
- `alarm_checker_loop()` structure
- All callable function signatures
- Settings persistence format
- Timer functionality (+5/+10/+30 buttons, countdown)
- Event emission patterns

## Files
- Modified: `main.py` (+36/-23 lines), `src/index.tsx` (+13/-9 lines)
- Created: `workplans/001-interval-timer-feature.md` (implementation plan)

## Testing Checklist
- [ ] Set START=21:00, END=21:20 → verify pop-ups at :00, :05, :10, :15, :20
- [ ] Verify NO pop-up at :01, :02, :03, :04
- [ ] Restart plugin → verify no crash
- [ ] Test midnight crossing (START=23:55, END=00:10)
