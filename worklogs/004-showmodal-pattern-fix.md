# TimePickerModal showModal() Pattern Fix

## Problem
- Save button in "change interval start/end time" popup did not work
- Modal stayed open, changes not saved
- Previous async/await fix (003) was applied but issue persisted

## Root Cause
**Inline JSX rendering vs showModal() API mismatch**

| Pattern | Works? | Reason |
|---------|--------|--------|
| `{condition && <ConfirmModal />}` | No | ConfirmModal doesn't integrate with Decky modal system when rendered inline |
| `showModal(<ConfirmModal />)` | Yes | Properly registers modal with @decky/ui modal management |

**Evidence:** Timer completion modal (lines 399-406) worked correctly because it used `showModal()`.

## Fix Applied
Four edits in `src/index.tsx`:

### 1. Remove closeModal() from handleSave (line 104)
```diff
- await onSave(validHour, validMinute);
- closeModal();
+ await onSave(validHour, validMinute);
+ // Modal auto-closes when used with showModal()
```

### 2. Delete timePickerOpen state (lines 207-209)
```diff
- const [timePickerOpen, setTimePickerOpen] = useState<{open: boolean, slot: number, hour: number, minute: number}>({
-   open: false, slot: 1, hour: 21, minute: 0
- });
```

### 3. Merge handlers into showModal() pattern (lines 240-260)
```tsx
const handleAlarmClick = (slot: number) => {
  const alarmKey = `alarm_${slot}`;
  const alarm = dailyAlarms[alarmKey];

  const handleSave = async (hour: number, minute: number) => {
    await setDailyAlarm(slot, hour, minute);
    setDailyAlarms(prev => ({
      ...prev,
      [alarmKey]: { hour, minute, enabled: true }
    }));
  };

  showModal(
    <TimePickerModal
      currentHour={alarm.hour}
      currentMinute={alarm.minute}
      onSave={handleSave}
      closeModal={() => {}}
    />
  );
};
```

### 4. Delete inline modal rendering (lines 375-382)
```diff
- {timePickerOpen.open && (
-   <TimePickerModal
-     currentHour={timePickerOpen.hour}
-     currentMinute={timePickerOpen.minute}
-     onSave={handleAlarmSave}
-     closeModal={() => setTimePickerOpen({ ...timePickerOpen, open: false })}
-   />
- )}
```

## Key Insights

1. **@decky/ui ConfirmModal requires showModal()** - Inline JSX rendering bypasses Decky's modal system, breaking button handlers

2. **Closure captures context** - `slot` and `alarmKey` captured in `handleSave` callback, eliminating need for state

3. **closeModal prop becomes no-op** - When using showModal(), ConfirmModal auto-closes on OK/Cancel

4. **Pattern consistency** - Match existing working code (timer completion modal) rather than inventing new patterns

## Validation
- `pnpm run build` - TypeScript compilation passed
- Runtime verification requires Steam Deck deploy

## Files Modified
- `src/index.tsx` (4 edits, net deletion of ~15 lines)
