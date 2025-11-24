import decky
import os
import json
import asyncio
import time
from datetime import datetime, date

class SettingsManager:
    def __init__(self, name, settings_directory):
        self._name = name
        self._settings_directory = settings_directory
        self._settings_path = os.path.join(self._settings_directory, f"{name}.json")
        self._settings = {}

    def read(self):
        try:
            if not os.path.exists(self._settings_directory):
                os.makedirs(self._settings_directory, exist_ok=True)
            
            if os.path.exists(self._settings_path):
                with open(self._settings_path, 'r') as f:
                    self._settings = json.load(f)
            else:
                self._settings = {}
            return True
        except Exception as e:
            decky.logger.error(f"Failed to read settings: {e}")
            return False

    def commit(self):
        try:
            if not os.path.exists(self._settings_directory):
                os.makedirs(self._settings_directory, exist_ok=True)
                
            with open(self._settings_path, 'w') as f:
                json.dump(self._settings, f, indent=4)
            return True
        except Exception as e:
            decky.logger.error(f"Failed to save settings: {e}")
            return False

    def getSetting(self, key, default):
        return self._settings.get(key, default)

    def setSetting(self, key, value):
        self._settings[key] = value

# Constants
settings_key_subtle_mode = "subtle_mode"
settings_key_recent_timers = "recent_timers_seconds"
settings_key_timer_end = "timer_end"
settings_key_daily_alarms = "daily_alarms"
settings_key_interval_timer = "interval_timer"

class Plugin:
    timer_task = None
    alarm_checker_task = None
    settings = None

    async def _main(self):
        self.loop = asyncio.get_event_loop()
        self.seconds_remaining = 0
        
        # Initialize Settings
        self.settingsDir = decky.DECKY_PLUGIN_SETTINGS_DIR
        decky.logger.info(f'Simple Timer: Settings path = {os.path.join(self.settingsDir, "settings.json")}')
        self.settings = SettingsManager(name="settings", settings_directory=self.settingsDir)
        self.settings.read()

        timer_end_ts = self.settings.getSetting(settings_key_timer_end, None)

        if timer_end_ts is not None:
            future = datetime.fromtimestamp(timer_end_ts)
            self.seconds_remaining = self.get_time_difference(future.timestamp())
            if self.seconds_remaining <= 0:
                decky.logger.info("Found expired timer -- cancelling")
                await self.cancel_timer()
            else:
                decky.logger.info("Found existing timer -- resuming")
                await self.start_timer(self.seconds_remaining)

        await self.load_recents()
        await self.load_subtle_mode()

        # Start daily alarm checker
        self.alarm_checker_task = self.loop.create_task(self.alarm_checker_loop())

        decky.logger.info("Simple Timer has been initialised.")

    async def _unload(self):
        await self.cancel_timer()
        if self.alarm_checker_task is not None:
            self.alarm_checker_task.cancel()
        decky.logger.info("Simple Timer has been unloaded.")

    async def _uninstall(self):
        decky.logger.info("Simple Timer has been uninstalled.")

    async def _migration(self):
        decky.logger.info("Simple Timer is being migrated.")
        # Add migration logic if needed, typically handled by decky.migrate_settings etc
        # existing migration code from original file:
        decky.migrate_logs(os.path.join(decky.DECKY_USER_HOME, ".config", "decky-simple-timer", "template.log"))
        decky.migrate_settings(
            os.path.join(decky.DECKY_HOME, "settings", "template.json"),
            os.path.join(decky.DECKY_USER_HOME, ".config", "decky-simple-timer"))

        decky.migrate_runtime(
            os.path.join(decky.DECKY_HOME, "template"),
            os.path.join(decky.DECKY_USER_HOME, ".local", "share", "decky-simple-timer"))

    def get_time_difference(self, target_timestamp):
        return target_timestamp - time.time()
    
    # region: Settings
    # Wrapper methods to maintain frontend compatibility if called directly (though they are mostly internal usage now)
    # Actually frontend calls 'start_timer' etc.
    # The original code exposed these via Plugin methods?
    # In Decky, public methods of Plugin class are exposed to frontend.
    # The original code had `async def settings_read(self):` etc. 
    # I should keep them if the frontend calls them. 
    # Checking src/index.tsx: 
    # It calls: start_timer, cancel_timer, set_subtle_mode, load_recents, load_remaining_seconds, load_subtle_mode, set_daily_alarm, get_daily_alarms.
    # It DOES NOT call settings_read, settings_commit, etc directly.
    # So I can keep those internal or just use self.settings directly.
    
    async def settings_read(self):
        decky.logger.info('Reading settings')
        return self.settings.read()
    
    async def settings_commit(self):
        decky.logger.info('Saving settings')
        return self.settings.commit()
    
    async def settings_getSetting(self, key: str, defaults):
        # decky.logger.info('Get {}'.format(key)) # Reduced logging spam
        return self.settings.getSetting(key, defaults)
    
    async def settings_setSetting(self, key: str, value):
        decky.logger.info('Set {}: {}'.format(key, value))
        return self.settings.setSetting(key, value)

    # endregion

    async def start_timer(self, seconds: int):
        decky.logger.info("Simple Timer: Starting Timer for {} seconds. Saving Recent Timers.".format(seconds))

        new_timers = await self.settings_getSetting(settings_key_recent_timers, [])
        if len(new_timers) > 4: 
            new_timers.pop()

        new_timers.insert(0, seconds)
        await self.settings_setSetting(settings_key_recent_timers, new_timers)
        await self.settings_commit()

        # Emits the event to the frontend
        await self.load_recents()

        self.seconds_remaining = seconds
        await self.load_remaining_seconds()

        # Stores the timestamp of the expected alarm end
        future_time = time.time() + seconds
        future_timestamp = datetime.fromtimestamp(future_time)

        await self.settings_setSetting(settings_key_timer_end, future_time)
        await self.settings_commit()

        # Cancel existing task if any
        if self.timer_task is not None:
            self.timer_task.cancel()
            
        self.timer_task = self.loop.create_task(self.timer_handler(future_timestamp))

    async def timer_handler(self, timer_end: datetime):
        self.seconds_remaining = self.get_time_difference(timer_end.timestamp())

        while self.seconds_remaining > 0:
            await asyncio.sleep(5)

            self.seconds_remaining = self.get_time_difference(timer_end.timestamp())

            if (self.seconds_remaining <= -10):
                await self.cancel_timer()
                await decky.emit("simple_timer_event", "Your timer has expired!", True)
                return

            await decky.emit("simple_timer_seconds_updated", self.seconds_remaining)
        
        self.seconds_remaining = 0
        await decky.emit("simple_timer_seconds_updated", self.seconds_remaining)

        subtle = await self.settings_getSetting(settings_key_subtle_mode, False)
        await decky.emit("simple_timer_event", "Your session has ended!", subtle)

    async def cancel_timer(self):
        self.seconds_remaining = 0
        await decky.emit("simple_timer_seconds_updated", self.seconds_remaining)
        if self.timer_task is not None:
            self.timer_task.cancel()
            self.timer_task = None
        
    async def load_recents(self):
        recent_timers = await self.settings_getSetting(settings_key_recent_timers, [])

        if len(recent_timers) == 0:
            decky.logger.info("Simple Timer did not detect any Recent Timers.")
        
        await decky.emit("simple_timer_refresh_recents", recent_timers)

    async def set_subtle_mode(self, subtle):
        await self.settings_setSetting(settings_key_subtle_mode, subtle)
        await self.settings_commit()
        await self.load_subtle_mode()

    async def load_subtle_mode(self):
        subtle = await self.settings_getSetting(settings_key_subtle_mode, False)
        await decky.emit("simple_timer_subtle", subtle)

    async def load_remaining_seconds(self):
        await decky.emit("simple_timer_seconds_updated", self.seconds_remaining)

    async def set_daily_alarm(self, slot: int, hour: int, minute: int):
        """Set a daily alarm for slot 1, 2, or 3"""
        alarms = await self.settings_getSetting(settings_key_daily_alarms, {})
        alarm_key = f"alarm_{slot}"

        # Get current date for last_triggered tracking
        today = date.today().isoformat()

        alarms[alarm_key] = {
            "hour": hour,
            "minute": minute,
            "enabled": True,
            "last_triggered": None
        }

        await self.settings_setSetting(settings_key_daily_alarms, alarms)
        await self.settings_commit()
        decky.logger.info(f"Set daily alarm {slot} to {hour:02d}:{minute:02d}")

    async def get_daily_alarms(self):
        """Get all daily alarm configurations"""
        alarms = await self.settings_getSetting(settings_key_daily_alarms, {})

        # Return default alarms if none set
        defaults = {
            "alarm_1": {"hour": 22, "minute": 55, "enabled": True},
            "alarm_2": {"hour": 22, "minute": 57, "enabled": True},
            "alarm_3": {"hour": 22, "minute": 59, "enabled": True}
        }

        # Merge with defaults for any missing alarms
        updated = False
        for key, default in defaults.items():
            if key not in alarms:
                alarms[key] = default
                updated = True
        
        if updated:
            await self.settings_setSetting(settings_key_daily_alarms, alarms) # Don't commit here to avoid disk thrash on every read, or do? It's rare.
            # Let's not commit on read to be safe, just return merged.

        return alarms

    async def set_interval_timer(self, start_hour: int, start_minute: int, end_hour: int, end_minute: int):
        """Set the interval timer start and end times"""
        interval = {
            "start_hour": start_hour,
            "start_minute": start_minute,
            "end_hour": end_hour,
            "end_minute": end_minute,
            "enabled": True,
            "last_triggered_key": None
        }
        await self.settings_setSetting(settings_key_interval_timer, interval)
        await self.settings_commit()
        decky.logger.info(f"Set interval timer: {start_hour:02d}:{start_minute:02d} - {end_hour:02d}:{end_minute:02d}")

    async def get_interval_timer(self):
        """Get the interval timer configuration"""
        default = {
            "start_hour": 18,
            "start_minute": 0,
            "end_hour": 22,
            "end_minute": 0,
            "enabled": False,
            "last_triggered_key": None
        }
        return await self.settings_getSetting(settings_key_interval_timer, default)

    async def toggle_interval_timer(self, enabled: bool):
        """Enable or disable the interval timer"""
        interval = await self.get_interval_timer()
        interval["enabled"] = enabled
        await self.settings_setSetting(settings_key_interval_timer, interval)
        await self.settings_commit()
        decky.logger.info(f"Interval timer enabled: {enabled}")

    async def alarm_checker_loop(self):
        """Background task that checks for daily alarm triggers every 30 seconds"""
        while True:
            try:
                await asyncio.sleep(30)  # Check every 30 seconds
                await self.check_daily_alarms()
            except asyncio.CancelledError:
                decky.logger.info("Daily alarm checker task cancelled")
                break
            except Exception as e:
                decky.logger.error(f"Error in daily alarm checker: {e}")

    async def check_daily_alarms(self):
        """Check if any daily alarms should trigger now"""
        now = datetime.now()
        current_hour = now.hour
        current_minute = now.minute
        today = date.today().isoformat()

        alarms = await self.settings_getSetting(settings_key_daily_alarms, {})
        
        updated_alarms = False

        for alarm_key, alarm_data in alarms.items():
            if not alarm_data.get("enabled", True):
                continue

            # Check if this alarm should trigger now
            if (alarm_data["hour"] == current_hour and
                alarm_data["minute"] == current_minute and
                alarm_data.get("last_triggered") != today):

                # Trigger the alarm
                slot = alarm_key.split("_")[1]  # Extract slot number from "alarm_1" etc
                decky.logger.info(f"Triggering daily alarm {slot} at {current_hour:02d}:{current_minute:02d}")

                # Update last triggered date
                alarm_data["last_triggered"] = today
                updated_alarms = True

                # Emit alarm event (reuse existing timer event)
                subtle = await self.settings_getSetting(settings_key_subtle_mode, False)
                await decky.emit("simple_timer_event", f"Daily Alarm {slot}", subtle)
        
        if updated_alarms:
            await self.settings_setSetting(settings_key_daily_alarms, alarms)
            await self.settings_commit()