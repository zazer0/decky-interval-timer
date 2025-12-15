# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
Decky Interval Timer is a Decky Plugin for Steam Deck that shows popup reminders every 5 minutes during a configurable time window. Users can also set one-off manual timers. The plugin uses a TypeScript/React frontend with a Python backend.

## Build and Development Commands

### Building
```bash
pnpm run build     # Build the plugin and copy alarm.mp3 to dist
pnpm run watch     # Watch for changes and rebuild automatically
```

### Installation Requirements
- Uses pnpm for package management
- Requires @decky/rollup for building
- TypeScript compilation via rollup configuration

## Architecture

### Frontend (TypeScript/React)
- **Entry Point**: `src/index.tsx` - Main React component that provides the timer UI
- **Key Dependencies**:
  - @decky/ui - UI components from Decky framework
  - @decky/api - API functions for plugin communication
  - react-icons - Icon components

### Backend (Python)
- **Entry Point**: `main.py` - Python plugin class handling timer logic
- **Timer State**: Persisted using SettingsManager for timer resumption after reload
- **Event System**: Uses decky.emit() to communicate with frontend

### Frontend-Backend Communication
The plugin uses callable functions and event listeners:
- **Callables** (Frontend → Backend):
  - `start_timer(seconds)` - Start a one-off timer
  - `cancel_timer()` - Cancel active timer
  - `set_subtle_mode(subtle)` - Toggle subtle mode
  - `load_recents()` - Load recent timers
  - `load_remaining_seconds()` - Get timer status
  - `load_subtle_mode()` - Get subtle mode setting
  - `set_daily_alarm(slot, hour, minute)` - Set interval start/end time
  - `get_daily_alarms()` - Get interval alarm configurations

- **Events** (Backend → Frontend):
  - `simple_timer_event` - Timer completion notification
  - `simple_timer_seconds_updated` - Timer tick updates
  - `simple_timer_refresh_recents` - Recent timers list update
  - `simple_timer_subtle` - Subtle mode state update

### Key Features
1. **Interval Reminders**: Background loop triggers popup every 5 minutes during configured start/end time window (alarm_1 = start, alarm_2 = end)
2. **One-off Timers**: Manual timers that persist across plugin reload using settings storage
3. **Subtle Mode**: Toggle between fullscreen modal or toast notifications
4. **Recent Timers**: Stores last 5 timer durations for quick restart
5. **Suspend Integration**: Can automatically suspend Steam Deck when timer expires

## File Structure Patterns
- TypeScript components use ESNext modules with `@decky/*` imports
- Python backend uses async/await pattern for all plugin methods
- Settings stored in JSON via SettingsManager in DECKY_PLUGIN_SETTINGS_DIR
- Audio asset (alarm.mp3) copied to dist during build