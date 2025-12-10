# TimePickerModal Save Button Fix

## Problem
- Save button in "change interval start/end time" popup did not work
- Popup stayed open, changes not saved

## Root Cause
Async/await mismatch in `src/index.tsx`:

| Component | Issue |
|-----------|-------|
| `handleAlarmSave` (L251) | Declared `async`, returns `Promise` |
| `onSave` prop type (L91) | Typed as `=> void` (sync) |
| `handleSave` (L99-105) | Called `onSave()` without `await`, then immediately `closeModal()` |

**Result:** Modal closed before backend save completed (race condition).

## Fix Applied
Two edits in `src/index.tsx`:

1. **Line 91** - Updated type:
   ```typescript
   onSave: (hour: number, minute: number) => Promise<void>;
   ```

2. **Lines 99-105** - Made handler async:
   ```typescript
   const handleSave = async () => {
     const validHour = Math.max(0, Math.min(23, hour));
     const validMinute = Math.max(0, Math.min(59, minute));
     await onSave(validHour, validMinute);
     closeModal();
   };
   ```

## Validation
- `pnpm run build` - TypeScript compilation passed
- Strict mode (`tsconfig.json`) validates type correctness
- No test framework exists; runtime verification requires Steam Deck deploy

## Key Insight
When passing async callbacks as props in React/TypeScript:
- Type the prop as returning `Promise<void>`
- Make the internal handler `async`
- `await` the callback before any subsequent operations (like closing modals)

## Files Modified
- `src/index.tsx` (2 small edits)
