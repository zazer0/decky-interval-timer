# 005: Inline Time Selection (Modal Replacement)

## Problem
- `showModal()` pattern for TimePickerModal dismissed the sidebar
- Save button in modal didn't dismiss properly
- Modal UX was clunky for Steam Deck controller navigation

## Solution
Replaced modal-based time picker with context-sensitive inline buttons:
- Tap START/END to **select** which alarm to edit (toggle, no modal)
- Existing +5/10/30 buttons increase selected alarm's minutes
- Existing -5/10/30 buttons decrease selected alarm's minutes
- When nothing selected, buttons work on timer duration (preserved existing behavior)

## Implementation Details

### New State
```typescript
const [selectedAlarm, setSelectedAlarm] = useState<'start' | 'end' | null>(null);
```

### AlarmButton Changes
- Added `isSelected: boolean` prop
- Visual styling when selected: blue background (#4488ff), border, glow effect
- Unselected: gray (#556677)

### Key Functions Added

**handleAlarmClick** - Toggles selection instead of opening modal:
```typescript
const alarmType = slot === 1 ? 'start' : 'end';
setSelectedAlarm(prev => prev === alarmType ? null : alarmType);
```

**adjustAlarmTime** - Modifies alarm with 24h wrapping:
- Handles overflow (23:58 +5 → 00:03)
- Handles underflow (00:02 -5 → 23:57)
- Auto-saves via `setDailyAlarm()` backend call

**handlePlusClick / handleMinusClick** - Context-sensitive:
- If alarm selected: adjust that alarm's time
- If no selection: adjust timerMinutes (existing behavior)

### Button Logic Updates
- +5/10/30: `onClick={() => handlePlusClick(N)}`
- -5/10/30: `onClick={() => handleMinusClick(N)}`
- Minus disabled logic: `disabled={!selectedAlarm && timerMinutes <= N}`

### Removed
- Entire `TimePickerModal` component (~70 lines)
- Modal opening logic in handleAlarmClick

## Design Decisions
| Decision | Choice | Rationale |
|----------|--------|-----------|
| Save mode | Auto-save | Immediate feedback, no extra button |
| Deselect | Tap same button | Simple toggle, no "Done" button needed |
| Time wrapping | 24h cycle | Intuitive for alarm times |

## Files Changed
- `src/index.tsx` - All UI changes
- `package.json` - Version bump to 1.0.3

## Version
v1.0.2 → v1.0.3
