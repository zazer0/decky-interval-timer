import {
  Button,
  ButtonItem,
  ButtonProps,
  ConfirmModal,
  Focusable,
  PanelSection,
  PanelSectionRow,
  showModal,
  staticClasses,
  ToggleField
} from "@decky/ui";

import {
  addEventListener,
  removeEventListener,
  callable,
  definePlugin,
  toaster,
} from "@decky/api";

import { FaClock, FaMinus, FaPlus, FaVolumeDown } from "react-icons/fa";
import { PropsWithChildren, useEffect, useLayoutEffect, useRef, useState } from "react";
import { SteamUtils } from "./utils/steam";

// Time calculation utilities
function getSecondsUntilTime(targetHour: number): number {
  const now = new Date();
  const target = new Date();
  target.setHours(targetHour, 0, 0, 0);

  // If the target time has already passed today, set it for tomorrow
  if (target <= now) {
    target.setDate(target.getDate() + 1);
  }

  // Calculate seconds until target time
  return Math.floor((target.getTime() - now.getTime()) / 1000);
}

function formatTimeUntil(targetHour: number): string {
  const hour12 = targetHour === 0 ? 12 : targetHour > 12 ? targetHour - 12 : targetHour;
  const period = targetHour < 12 ? 'AM' : 'PM';
  return `${hour12}:00 ${period}`;
}

// This function calls the python function "start_timer", which takes in no arguments and returns nothing.
// It starts a (python) timer which eventually emits the event 'timer_event'
const startTimer = callable<[seconds: number], void>("start_timer");
const cancelTimer = callable<[void], void>("cancel_timer");
const saveSubtleMode = callable<[subtle: boolean], void>("set_subtle_mode");

// This function opens a given URL in the browser
const loadRecents = callable<[void], void>("load_recents");
const loadSecondsRemaining = callable<[void], void>("load_remaining_seconds");
const loadSubtleMode = callable<[void], boolean>("load_subtle_mode");
const setDailyAlarm = callable<[slot: number, hour: number, minute: number], void>("set_daily_alarm");
const getDailyAlarms = callable<[], Record<string, {hour: number, minute: number, enabled: boolean}>>("get_daily_alarms");

type MinutesButtonProps = PropsWithChildren<ButtonProps & { type: 'positive' | 'negative' }>;

const MinutesButton = ({ children, type, ...props }: MinutesButtonProps) => {
  const disabled = props.disabled;

  const colorStyles: React.CSSProperties = disabled ?
    { backgroundColor: '#00000044', color: '#aaaaaa' } :
    { backgroundColor: type === 'positive' ? '#44aa44' : '#aa4444', color: '#ffffff' };

  return (
    <Button disabled={disabled} preferredFocus style={{
      display: 'flex',
      fontSize: 18,
      flexDirection: 'row',
      gap: 4,
      alignItems: 'center',
      padding: 8,
      paddingTop: 2,
      paddingBottom: 2,
      borderRadius: 8,
      border: 0,
      ...colorStyles
    }} {...props}>
      {children}
    </Button>
  )
}

interface TimePickerModalProps {
  currentHour: number;
  currentMinute: number;
  onSave: (hour: number, minute: number) => void;
  closeModal: () => void;
}

const TimePickerModal = ({ currentHour, currentMinute, onSave, closeModal }: TimePickerModalProps) => {
  const [hour, setHour] = useState(currentHour);
  const [minute, setMinute] = useState(currentMinute);

  const handleSave = () => {
    // Validate hour and minute ranges
    const validHour = Math.max(0, Math.min(23, hour));
    const validMinute = Math.max(0, Math.min(59, minute));
    onSave(validHour, validMinute);
    closeModal();
  };

  return (
    <ConfirmModal
      strTitle="Set Daily Alarm"
      strDescription="Set time for daily alarm (24-hour format)"
      strOKButtonText="Save"
      strCancelButtonText="Cancel"
      onOK={handleSave}
      onCancel={closeModal}
    >
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ fontSize: 14, color: '#ffffff' }}>Hour (0-23)</label>
          <input
            type="number"
            min="0"
            max="23"
            value={hour}
            onChange={(e) => setHour(parseInt(e.target.value) || 0)}
            style={{
              width: 80,
              padding: 8,
              fontSize: 16,
              textAlign: 'center',
              backgroundColor: '#2d3748',
              color: '#ffffff',
              border: '1px solid #4a5568',
              borderRadius: 4
            }}
          />
        </div>
        <div style={{ fontSize: 20, color: '#ffffff' }}>:</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ fontSize: 14, color: '#ffffff' }}>Minute (0-59)</label>
          <input
            type="number"
            min="0"
            max="59"
            value={minute}
            onChange={(e) => setMinute(parseInt(e.target.value) || 0)}
            style={{
              width: 80,
              padding: 8,
              fontSize: 16,
              textAlign: 'center',
              backgroundColor: '#2d3748',
              color: '#ffffff',
              border: '1px solid #4a5568',
              borderRadius: 4
            }}
          />
        </div>
      </div>
    </ConfirmModal>
  );
};

interface AlarmButtonProps {
  slot: number;
  hour: number;
  minute: number;
  onClick: () => void;
}

const AlarmButton = ({ slot, hour, minute, onClick }: AlarmButtonProps) => {
  const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;

  return (
    <Button
      focusable
      onClick={onClick}
      style={{
        fontSize: 14,
        padding: '6px 12px',
        borderRadius: 6,
        backgroundColor: '#556677',
        color: '#ffffff',
        minWidth: '65px',
        textAlign: 'center',
        border: 0
      }}
    >
      {timeStr}
    </Button>
  );
};

const directoryPath = import.meta.url.substring(0, import.meta.url.lastIndexOf('/') + 1);

function Content() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [timerMinutes, setTimerMinutes] = useState(5);

  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [recentTimerSeconds, setRecentTimerSeconds] = useState<number[] | null>();
  const [subtleMode, setSubtleMode] = useState<boolean>(false);
  const [dailyAlarms, setDailyAlarms] = useState<Record<string, {hour: number, minute: number, enabled: boolean}>>({
    alarm_1: {hour: 21, minute: 0, enabled: true},
    alarm_2: {hour: 22, minute: 0, enabled: true},
    alarm_3: {hour: 23, minute: 0, enabled: true}
  });
  const [timePickerOpen, setTimePickerOpen] = useState<{open: boolean, slot: number, hour: number, minute: number}>({
    open: false, slot: 1, hour: 21, minute: 0
  });

  useEffect(() => {
    const handleRefreshRecents = (recents: number[]) => {
      setRecentTimerSeconds(recents);
    };

    const handleSecondsRemaining = (seconds: number) => {
      setSecondsRemaining(seconds);
    };

    const handleSubtleModeUpdate = (subtle: boolean) => {
      setSubtleMode(subtle);
    }

    addEventListener<[seconds: number]>("simple_timer_seconds_updated", handleSecondsRemaining);
    addEventListener<[recents: number[]]>("simple_timer_refresh_recents", handleRefreshRecents);
    addEventListener<[subtle: boolean]>("simple_timer_subtle", handleSubtleModeUpdate);

    loadRecents();
    loadSecondsRemaining();
    loadSubtleMode();
    loadDailyAlarms();

    return () => {
      removeEventListener("simple_timer_refresh_recents", handleRefreshRecents);
      removeEventListener("simple_timer_seconds_updated", handleSecondsRemaining);
      removeEventListener("simple_timer_subtle", handleSubtleModeUpdate);
    }
  }, []);

  const handleAlarmClick = (slot: number) => {
    const alarmKey = `alarm_${slot}`;
    const alarm = dailyAlarms[alarmKey];
    setTimePickerOpen({
      open: true,
      slot,
      hour: alarm.hour,
      minute: alarm.minute
    });
  };

  const handleAlarmSave = async (hour: number, minute: number) => {
    await setDailyAlarm(timePickerOpen.slot, hour, minute);

    // Update local state
    const alarmKey = `alarm_${timePickerOpen.slot}`;
    setDailyAlarms(prev => ({
      ...prev,
      [alarmKey]: { hour, minute, enabled: true }
    }));
  };

  const loadDailyAlarms = async () => {
    try {
      const alarms = await getDailyAlarms();
      setDailyAlarms(alarms);
    } catch (error) {
      console.error("Failed to load daily alarms:", error);
    }
  };

  useLayoutEffect(() => {
    containerRef?.current?.scrollTo(0, 0);
  }, []);

  return (
    <div id="container" ref={containerRef}>
      <PanelSection>
        {secondsRemaining <= 0 ? (
          <PanelSectionRow>
            <Focusable preferredFocus flow-children="row" style={{ display: 'flex', flex: '1 1 auto', justifyContent: 'center', flexDirection: 'row', gap: 8 }}>
              <MinutesButton focusable type='positive' onClick={() => setTimerMinutes(prev => prev + 5)}>
                <FaPlus size={8} /><span>5</span>
              </MinutesButton>
              <MinutesButton focusable type='positive' onClick={() => setTimerMinutes(prev => prev + 10)}>
                <FaPlus size={8} /><span>10</span>
              </MinutesButton>
              <MinutesButton focusable type='positive' onClick={() => setTimerMinutes(prev => prev + 30)}>
                <FaPlus size={8} /><span>30</span>
              </MinutesButton>
            </Focusable>
          </PanelSectionRow>
        ) : null}

        {secondsRemaining <= 0 ? (
          <PanelSectionRow>
            <Focusable flow-children="row" style={{ display: 'flex', justifyContent: 'center', gap: 8, paddingBottom: 8 }}>
              {Object.entries(dailyAlarms).map(([key, alarm], idx) => (
                <AlarmButton
                  key={key}
                  slot={idx + 1}
                  hour={alarm.hour}
                  minute={alarm.minute}
                  onClick={() => handleAlarmClick(idx + 1)}
                />
              ))}
            </Focusable>
          </PanelSectionRow>
        ) : null}

        <PanelSectionRow>
          {secondsRemaining > 0 ? (
            <>
              <ButtonItem onClick={async () => await cancelTimer()} bottomSeparator="none" layout="below">
                Cancel Timer<br />
                { secondsRemaining < 60 ? `Less than a minute` : `< ${Math.ceil(secondsRemaining / 60)} minute${secondsRemaining > 60 ? 's' : ''}` }
              </ButtonItem>
            </>
          ) : (
            <ButtonItem onClick={async () => await startTimer(timerMinutes * 60)} bottomSeparator="none" layout="below">Begin Timer<br />({timerMinutes} minutes)</ButtonItem>
          )}
        </PanelSectionRow>

        {secondsRemaining <= 0 ? (
          <PanelSectionRow>
            <Focusable flow-children="row" style={{ display: 'flex', paddingBottom: 16, flex: '1 1 auto', justifyContent: 'center', flexDirection: 'row', gap: 8 }}>
              <MinutesButton focusable type='negative' disabled={timerMinutes <= 5} onClick={() => setTimerMinutes(prev => prev - 5)}>
                <FaMinus size={8} /><span>5</span>
              </MinutesButton>
              <MinutesButton focusable type='negative' disabled={timerMinutes <= 10} onClick={() => setTimerMinutes(prev => prev - 10)}>
                <FaMinus size={8} /><span>10</span>
              </MinutesButton>
              <MinutesButton focusable type='negative' disabled={timerMinutes <= 30} onClick={() => setTimerMinutes(prev => prev - 30)}>
                <FaMinus size={8} /><span>30</span>
              </MinutesButton>
            </Focusable>
          </PanelSectionRow>
        ) : null}

        <PanelSectionRow>
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
        </PanelSectionRow>
      </PanelSection>

      <PanelSection title="Recent Timers" spinner={!recentTimerSeconds}>
        <PanelSectionRow>
          {recentTimerSeconds?.length === 0 ? (
            <p>You have no recent timers. You can quickly restart your last 5 timers here.</p>
          ) : (
            recentTimerSeconds?.map((seconds, idx) => (
              <ButtonItem highlightOnFocus={secondsRemaining === 0} disabled={secondsRemaining > 0} layout="below" key={`${idx}-seconds`} onClick={async () => { containerRef.current?.scrollTo(0,0); startTimer(seconds); }}>Start {seconds / 60} Minute Timer</ButtonItem>
            ))
          )}
        </PanelSectionRow>
      </PanelSection>

      <PanelSection>
        <PanelSectionRow>
          <ButtonItem disabled bottomSeparator="none" layout="below">decktools.xyz/donate <span style={{ color: 'pink' }}>&lt;3</span></ButtonItem>
        </PanelSectionRow>
      </PanelSection>

      {timePickerOpen.open && (
        <TimePickerModal
          currentHour={timePickerOpen.hour}
          currentMinute={timePickerOpen.minute}
          onSave={handleAlarmSave}
          closeModal={() => setTimePickerOpen({ ...timePickerOpen, open: false })}
        />
      )}
    </div>
  );
};

export default definePlugin(() => {
  const handleTimerComplete = (message:string, subtle: boolean) => {
    const Alarm = () => <audio src={directoryPath + 'alarm.mp3'} autoPlay />;
    
    (window.document.getElementById('alarm-sound') as HTMLAudioElement)?.play();

    if (subtle) {
      toaster.toast({
        title: message,
        body: "Your timer has finished."
      })
    } else {
      showModal(<ConfirmModal 
          children={<Alarm />}
          strTitle={message} 
          strDescription="Your timer has finished. You can either suspend now, or ignore the alert." 
          strOKButtonText="Suspend Now"
          strCancelButtonText="Ignore"
          onOK={async () => await SteamUtils.suspend()}
      />);
    }
  }

  // Note: Daily alarms also use the simple_timer_event, so they are automatically
  // handled by the existing handleTimerComplete function in the plugin definition
  addEventListener<[message: string, subtle: boolean]>("simple_timer_event", handleTimerComplete);

  return {
    name: "Simple Timer",
    titleView: <div className={staticClasses.Title}>Simple Timer</div>,
    content: <Content />,
    icon: <FaClock />,
    onDismount: () => removeEventListener("simple_timer_event", handleTimerComplete),
  };
});
