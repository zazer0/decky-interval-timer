# 003 - Second Interval Feature

## Overview
Add a "second interval" feature with dual reminder frequencies:
- **START to MID**: 5-minute intervals (existing behavior)
- **MID to FINISH**: 2-minute intervals (new, more frequent)

## Critical Files
- `src/index.tsx` - Frontend React component
- `main.py` - Python backend with interval logic

## Decisions Made
- MID time is **inclusive to Phase 1** (last 5-min trigger)
- No info text UI (keep minimal)

---

## Stage 1: Frontend UI - Add Third Alarm Slot

### 1.1 Update `selectedAlarm` type (Line 132)
```typescript
// BEFORE:
const [selectedAlarm, setSelectedAlarm] = useState<'start' | 'end' | null>(null);
// AFTER:
const [selectedAlarm, setSelectedAlarm] = useState<'start' | 'mid' | 'finish' | null>(null);
```

### 1.2 Update `handleAlarmClick` (Lines 171-174)
```typescript
// BEFORE:
const alarmType = slot === 1 ? 'start' : 'end';
// AFTER:
const alarmType = slot === 1 ? 'start' : slot === 2 ? 'mid' : 'finish';
```

### 1.3 Update `handlePlusClick` (Lines 202-208)
```typescript
// BEFORE:
adjustAlarmTime(selectedAlarm === 'start' ? 1 : 2, minutes);
// AFTER:
const slot = selectedAlarm === 'start' ? 1 : selectedAlarm === 'mid' ? 2 : 3;
adjustAlarmTime(slot, minutes);
```

### 1.4 Update `handleMinusClick` (Lines 210-216)
Same pattern as 1.3 - map 'finish' to slot 3

### 1.5 Update alarm rendering (Lines 252-266)
- Change `.slice(0, 2)` to `.slice(0, 3)`
- Update labels from `['START', 'END']` to `['START', 'MID', 'FINISH']`
- Update `isSelected` check to include 'finish'

---

## Stage 2: Backend - Dual Interval Logic

### 2.1 Update default alarm values in `get_daily_alarms()` (Lines 246-249)
```python
defaults = {
    "alarm_1": {"hour": 21, "minute": 0, "enabled": True},   # START
    "alarm_2": {"hour": 22, "minute": 0, "enabled": True},   # MID
    "alarm_3": {"hour": 23, "minute": 0, "enabled": True}    # FINISH
}
```

### 2.2 Refactor `check_daily_alarms()` (Lines 277-324)
Replace entire method with dual-interval logic:
- Load all 3 alarms (start, mid, finish)
- Determine current phase:
  - Phase 1 (START→MID inclusive): `interval_minutes = 5` (MID is last 5-min trigger)
  - Phase 2 (after MID→FINISH): `interval_minutes = 2`
- Check `current_minute % interval_minutes != 0` to determine trigger
- Handle midnight-crossing scenarios for both phases

---

## Stage 3: Polish & Logging

### 3.1 Update logging in `set_daily_alarm()` (Lines 222-239)
Add slot name mapping: `{1: "START", 2: "MID", 3: "FINISH"}`

---

## Testing Checklist
- [ ] Three time slots display correctly (START, MID, FINISH)
- [ ] Each slot can be selected and adjusted
- [ ] Settings persist for all three alarms
- [ ] Phase 1: reminders at 5-min marks (XX:00, XX:05, XX:10...)
- [ ] Phase 2: reminders at 2-min marks (XX:00, XX:02, XX:04...)
- [ ] MID boundary triggers in Phase 1 (last 5-min trigger)
- [ ] No reminders outside START-FINISH window
- [ ] Midnight crossing scenarios work
