import { create } from 'zustand';
import { Station, Reading, Alert, AlertRulesConfig } from './types';
import { STATIONS } from './mockData';

export const DEFAULT_ALERT_RULES: AlertRulesConfig = {
  zScoreThreshold: 2.5,
  turbidityRocPercent: 40,
  doDropPercent: 25,
  rocTimeWindowMin: 30,
  phMin: 6.5,
  phMax: 8.5,
  doMinMgL: 5.0,
  turbidityMaxNtu: 5.0,
  tdsMaxPpm: 500,
  conductivityMaxUscm: 1000,
};

const RULES_STORAGE_KEY = 'indrayani_alert_rules';
const READ_ALERTS_STORAGE_KEY = 'indrayani_read_alerts';

function getInitialRules(): AlertRulesConfig {
  if (typeof window === 'undefined') return DEFAULT_ALERT_RULES;
  try {
    const item = localStorage.getItem(RULES_STORAGE_KEY);
    if (item) return { ...DEFAULT_ALERT_RULES, ...JSON.parse(item) };
  } catch {
    // Ignore localStorage parse error
  }
  return DEFAULT_ALERT_RULES;
}

function getInitialReadAlertIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const item = localStorage.getItem(READ_ALERTS_STORAGE_KEY);
    if (item) return JSON.parse(item);
  } catch {
    // Ignore
  }
  return [];
}

export interface RiverWatchState {
  stations: Station[];
  latestReadings: Record<string, Reading>;
  alerts: Alert[];
  readAlertIds: string[];
  activeCriticalToastAlert: Alert | null;
  alertRules: AlertRulesConfig;
  streamStatus: 'connecting' | 'connected' | 'disconnected';
  lastStreamMessageTime: string | null;

  // Actions
  setStreamStatus: (status: 'connecting' | 'connected' | 'disconnected') => void;
  updateReading: (reading: Reading) => void;
  setAllReadings: (readings: Reading[]) => void;
  addAlert: (alert: Alert) => void;
  setAlerts: (alerts: Alert[]) => void;
  markAlertAsRead: (alertId: string) => void;
  markAllAlertsRead: () => void;
  dismissCriticalToast: () => void;
  setAlertRules: (rules: AlertRulesConfig) => void;
  resetAlertRulesToDefault: () => void;
}

export const useRiverStore = create<RiverWatchState>((set) => ({
  stations: STATIONS,
  latestReadings: {},
  alerts: [],
  readAlertIds: getInitialReadAlertIds(),
  activeCriticalToastAlert: null,
  alertRules: getInitialRules(),
  streamStatus: 'disconnected',
  lastStreamMessageTime: null,

  setStreamStatus: (status) => set({ streamStatus: status }),

  updateReading: (reading) =>
    set((state) => ({
      latestReadings: {
        ...state.latestReadings,
        [reading.stationId]: reading,
      },
      lastStreamMessageTime: new Date().toISOString(),
    })),

  setAllReadings: (readings) =>
    set((state) => {
      const updated = { ...state.latestReadings };
      for (const r of readings) {
        updated[r.stationId] = r;
      }
      return { latestReadings: updated };
    }),

  addAlert: (alert) =>
    set((state) => {
      // Avoid duplicate alert ids
      const exists = state.alerts.some((a) => String(a.id) === String(alert.id));
      if (exists) return state;

      // Trigger critical slide-in toast if critical
      const activeCritical =
        alert.severity === 'critical' ? alert : state.activeCriticalToastAlert;

      return {
        alerts: [alert, ...state.alerts.slice(0, 49)], // keep latest 50
        activeCriticalToastAlert: activeCritical,
        lastStreamMessageTime: new Date().toISOString(),
      };
    }),

  setAlerts: (alerts) =>
    set((state) => {
      // If there's a new critical alert not seen before, show toast
      const latestCritical = alerts.find(
        (a) => a.severity === 'critical' && !state.readAlertIds.includes(String(a.id))
      );
      return {
        alerts,
        activeCriticalToastAlert: latestCritical || state.activeCriticalToastAlert,
      };
    }),

  markAlertAsRead: (alertId) =>
    set((state) => {
      if (state.readAlertIds.includes(alertId)) return state;
      const updated = [...state.readAlertIds, alertId];
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(READ_ALERTS_STORAGE_KEY, JSON.stringify(updated));
        } catch {
          // Ignore
        }
      }
      return { readAlertIds: updated };
    }),

  markAllAlertsRead: () =>
    set((state) => {
      const allIds = state.alerts.map((a) => String(a.id));
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(READ_ALERTS_STORAGE_KEY, JSON.stringify(allIds));
        } catch {
          // Ignore
        }
      }
      return { readAlertIds: allIds };
    }),

  dismissCriticalToast: () => set({ activeCriticalToastAlert: null }),

  setAlertRules: (rules) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(rules));
      } catch {
        // Ignore
      }
    }
    set({ alertRules: rules });
  },

  resetAlertRulesToDefault: () => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(RULES_STORAGE_KEY);
      } catch {
        // Ignore
      }
    }
    set({ alertRules: DEFAULT_ALERT_RULES });
  },
}));
