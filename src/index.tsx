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

// // Time calculation utilities
// function getSecondsUntilTime(targetHour: number): number {
//   const now = new Date();
//   const target = new Date();
//   target.setHours(targetHour, 0, 0, 0);

//   // If the target time has already passed today, set it for tomorrow
//   if (target <= now) {
//     target.setDate(target.getDate() + 1);
//   }

//   // Calculate seconds until target time
//   return Math.floor((target.getTime() - now.getTime()) / 1000);
// }

// function formatTimeUntil(targetHour: number): string {
//   const hour12 = targetHour === 0 ? 12 : targetHour > 12 ? targetHour - 12 : targetHour;
//   const period = targetHour < 12 ? 'AM' : 'PM';
//   return `${hour12}:00 ${period}`;
// }

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

interface AlarmButtonProps {
  slot: number;
  hour: number;
  minute: number;
  isSelected: boolean;
  onClick: () => void;
}

const AlarmButton = ({ hour, minute, isSelected, onClick }: AlarmButtonProps) => {
  const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;

  const selectedStyles: React.CSSProperties = isSelected ? {
    backgroundColor: '#4488ff',
    border: '2px solid #88bbff',
    boxShadow: '0 0 8px #4488ff'
  } : {
    backgroundColor: '#556677',
    border: 0
  };

  return (
    <Button
      focusable
      onClick={onClick}
      style={{
        fontSize: 14,
        padding: '6px 12px',
        borderRadius: 6,
        color: '#ffffff',
        minWidth: '65px',
        textAlign: 'center',
        ...selectedStyles
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
  const [selectedAlarm, setSelectedAlarm] = useState<'start' | 'end' | null>(null);

  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [recentTimerSeconds, setRecentTimerSeconds] = useState<number[] | null>();
  const [subtleMode, setSubtleMode] = useState<boolean>(false);
  const [dailyAlarms, setDailyAlarms] = useState<Record<string, {hour: number, minute: number, enabled: boolean}>>({
    alarm_1: {hour: 21, minute: 0, enabled: true},
    alarm_2: {hour: 22, minute: 0, enabled: true},
    alarm_3: {hour: 23, minute: 0, enabled: true}
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
    const alarmType = slot === 1 ? 'start' : 'end';
    setSelectedAlarm(prev => prev === alarmType ? null : alarmType);
  };

  const adjustAlarmTime = (slot: number, deltaMinutes: number) => {
    const alarmKey = `alarm_${slot}`;
    const alarm = dailyAlarms[alarmKey];

    let totalMinutes = alarm.hour * 60 + alarm.minute + deltaMinutes;

    // Handle underflow (wrap to previous day)
    if (totalMinutes < 0) {
      totalMinutes = 24 * 60 + totalMinutes;
    }
    // Handle overflow (wrap to next day)
    if (totalMinutes >= 24 * 60) {
      totalMinutes = totalMinutes % (24 * 60);
    }

    const newHour = Math.floor(totalMinutes / 60);
    const newMinute = totalMinutes % 60;

    setDailyAlarms(prev => ({
      ...prev,
      [alarmKey]: { ...prev[alarmKey], hour: newHour, minute: newMinute }
    }));

    setDailyAlarm(slot, newHour, newMinute);
  };

  const handlePlusClick = (minutes: number) => {
    if (selectedAlarm) {
      adjustAlarmTime(selectedAlarm === 'start' ? 1 : 2, minutes);
    } else {
      setTimerMinutes(prev => prev + minutes);
    }
  };

  const handleMinusClick = (minutes: number) => {
    if (selectedAlarm) {
      adjustAlarmTime(selectedAlarm === 'start' ? 1 : 2, -minutes);
    } else {
      setTimerMinutes(prev => Math.max(5, prev - minutes));
    }
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
              <MinutesButton focusable type='positive' onClick={() => handlePlusClick(5)}>
                <FaPlus size={8} /><span>5</span>
              </MinutesButton>
              <MinutesButton focusable type='positive' onClick={() => handlePlusClick(10)}>
                <FaPlus size={8} /><span>10</span>
              </MinutesButton>
              <MinutesButton focusable type='positive' onClick={() => handlePlusClick(30)}>
                <FaPlus size={8} /><span>30</span>
              </MinutesButton>
            </Focusable>
          </PanelSectionRow>
        ) : null}

        {secondsRemaining <= 0 ? (
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
                    isSelected={selectedAlarm === (idx === 0 ? 'start' : 'end')}
                    onClick={() => handleAlarmClick(idx + 1)}
                  />
                </div>
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
              <MinutesButton focusable type='negative' disabled={!selectedAlarm && timerMinutes <= 5} onClick={() => handleMinusClick(5)}>
                <FaMinus size={8} /><span>5</span>
              </MinutesButton>
              <MinutesButton focusable type='negative' disabled={!selectedAlarm && timerMinutes <= 10} onClick={() => handleMinusClick(10)}>
                <FaMinus size={8} /><span>10</span>
              </MinutesButton>
              <MinutesButton focusable type='negative' disabled={!selectedAlarm && timerMinutes <= 30} onClick={() => handleMinusClick(30)}>
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
      const modalResult = showModal(<ConfirmModal
          children={<Alarm />}
          strTitle={message}
          strDescription="Your timer has finished. You can either suspend now, or ignore the alert."
          strOKButtonText="Suspend Now"
          strCancelButtonText="(3s)"
          bCancelDisabled={true}
          onOK={async () => { await SteamUtils.suspend(); modalResult.Close(); }}
          onCancel={() => {}}
      />);

      // Countdown: update modal at 1s, 2s, 3s
      setTimeout(() => modalResult.Update(<ConfirmModal
          children={<Alarm />}
          strTitle={message}
          strDescription="Your timer has finished. You can either suspend now, or ignore the alert."
          strOKButtonText="Suspend Now"
          strCancelButtonText="(2s)"
          bCancelDisabled={true}
          onOK={async () => { await SteamUtils.suspend(); modalResult.Close(); }}
          onCancel={() => {}}
      />), 1000);

      setTimeout(() => modalResult.Update(<ConfirmModal
          children={<Alarm />}
          strTitle={message}
          strDescription="Your timer has finished. You can either suspend now, or ignore the alert."
          strOKButtonText="Suspend Now"
          strCancelButtonText="(1s)"
          bCancelDisabled={true}
          onOK={async () => { await SteamUtils.suspend(); modalResult.Close(); }}
          onCancel={() => {}}
      />), 2000);

      setTimeout(() => modalResult.Update(<ConfirmModal
          children={<Alarm />}
          strTitle={message}
          strDescription="Your timer has finished. You can either suspend now, or ignore the alert."
          strOKButtonText="Suspend Now"
          strCancelButtonText="Ignore"
          bCancelDisabled={true}
          onOK={async () => { await SteamUtils.suspend(); modalResult.Close(); }}
          onCancel={() => modalResult.Close()}
      />), 3000);
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