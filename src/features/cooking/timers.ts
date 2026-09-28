import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Haptics } from '@capacitor/haptics';
import { Preferences } from '@capacitor/preferences';
import { isNative } from '@/platform/native';
import { t } from '@/i18n';

export interface Timer {
  id: number;
  label: string;
  recipeId: string | null;
  recipeTitle: string;
  durationSec: number;
  /** Epoch ms when it rings; null while paused. */
  endAt: number | null;
  /** Remaining ms while paused. */
  remainingMs: number;
  done: boolean;
}

interface TimersState {
  timers: Timer[];
  start: (t: Pick<Timer, 'label' | 'recipeId' | 'recipeTitle' | 'durationSec'>) => Promise<number>;
  pause: (id: number) => void;
  resume: (id: number) => void;
  addTime: (id: number, seconds: number) => void;
  remove: (id: number) => void;
  markDone: (id: number) => void;
}

export const TIMER_CHANNEL = 'timers';
let channelReady = false;

async function ensureChannel(): Promise<boolean> {
  if (!isNative()) return false;
  try {
    let perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') perm = await LocalNotifications.requestPermissions();
    if (perm.display !== 'granted') return false;
    if (!channelReady) {
      await LocalNotifications.createChannel({
        id: TIMER_CHANNEL,
        name: t('cooking.timers'),
        importance: 5,
        visibility: 1,
        vibration: true,
      });
      channelReady = true;
    }
    return true;
  } catch {
    return false;
  }
}

async function schedule(timer: Timer): Promise<void> {
  if (!timer.endAt || !(await ensureChannel())) return;
  await LocalNotifications.schedule({
    notifications: [
      {
        id: timer.id,
        title: t('cooking.timerDone'),
        body:
          t('cooking.timerDoneBody', { label: timer.label }) +
          (timer.recipeTitle ? ` · ${timer.recipeTitle}` : ''),
        channelId: TIMER_CHANNEL,
        schedule: { at: new Date(timer.endAt), allowWhileIdle: true },
        smallIcon: 'ic_stat_mijote',
        autoCancel: true,
        extra: { recipeId: timer.recipeId },
      },
    ],
  }).catch(() => undefined);
}

async function cancel(id: number): Promise<void> {
  if (!isNative()) return;
  await LocalNotifications.cancel({ notifications: [{ id }] }).catch(() => undefined);
}

const nextId = () => (Date.now() % 1_000_000_000) + Math.floor(Math.random() * 1000);

export const useTimers = create<TimersState>()(
  persist(
    (set, get) => ({
      timers: [],
      start: async (p) => {
        const timer: Timer = {
          ...p,
          id: nextId(),
          endAt: Date.now() + p.durationSec * 1000,
          remainingMs: p.durationSec * 1000,
          done: false,
        };
        set({ timers: [...get().timers, timer] });
        await schedule(timer);
        return timer.id;
      },
      pause: (id) => {
        set({
          timers: get().timers.map((x) =>
            x.id === id && x.endAt
              ? { ...x, remainingMs: Math.max(0, x.endAt - Date.now()), endAt: null }
              : x,
          ),
        });
        void cancel(id);
      },
      resume: (id) => {
        const timers = get().timers.map((x) =>
          x.id === id && !x.endAt ? { ...x, endAt: Date.now() + x.remainingMs } : x,
        );
        set({ timers });
        const tm = timers.find((x) => x.id === id);
        if (tm) void schedule(tm);
      },
      addTime: (id, seconds) => {
        const timers = get().timers.map((x) => {
          if (x.id !== id) return x;
          const base = x.done ? Date.now() : (x.endAt ?? Date.now());
          return x.endAt || x.done
            ? { ...x, done: false, endAt: base + seconds * 1000, durationSec: x.durationSec + seconds }
            : { ...x, remainingMs: x.remainingMs + seconds * 1000 };
        });
        set({ timers });
        const tm = timers.find((x) => x.id === id);
        if (tm?.endAt) {
          void cancel(id).then(() => schedule(tm));
        }
      },
      remove: (id) => {
        set({ timers: get().timers.filter((x) => x.id !== id) });
        void cancel(id);
      },
      markDone: (id) => {
        set({
          timers: get().timers.map((x) =>
            x.id === id ? { ...x, done: true, endAt: null, remainingMs: 0 } : x,
          ),
        });
      },
    }),
    {
      name: 'mijote.timers',
      storage: createJSONStorage(() => ({
        getItem: async (k) => (await Preferences.get({ key: k })).value,
        setItem: (k, v) => Preferences.set({ key: k, value: v }),
        removeItem: (k) => Preferences.remove({ key: k }),
      })),
      partialize: (s) => ({ timers: s.timers }),
    },
  ),
);

export function remainingMs(x: Timer, now = Date.now()): number {
  return x.endAt ? Math.max(0, x.endAt - now) : x.remainingMs;
}

let audioCtx: AudioContext | null = null;

/** Short three-beep chime played when a timer ends while the app is open. */
export function chime(): void {
  void Haptics.vibrate({ duration: 600 }).catch(() => undefined);
  try {
    audioCtx ??= new AudioContext();
    const ctx = audioCtx;
    [0, 0.35, 0.7].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + offset + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + offset);
      osc.stop(ctx.currentTime + offset + 0.32);
    });
  } catch {
    // audio unavailable
  }
}
