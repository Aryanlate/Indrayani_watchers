'use client';

import React, { useState } from 'react';
import { useRiverStore, DEFAULT_ALERT_RULES } from '@/lib/store';
import { AlertRulesConfig } from '@/lib/types';
import { Sliders, RotateCcw, Check, X, Shield, Cpu, Activity } from 'lucide-react';

interface AlertRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AlertRulesModal({ isOpen, onClose }: AlertRulesModalProps) {
  const { alertRules, setAlertRules, resetAlertRulesToDefault } = useRiverStore();
  const [formData, setFormData] = useState<AlertRulesConfig>(alertRules);
  const [savedNotice, setSavedNotice] = useState(false);

  // Sync state with store on open
  React.useEffect(() => {
    if (isOpen) {
      setFormData(alertRules);
      setSavedNotice(false);
    }
  }, [isOpen, alertRules]);

  if (!isOpen) return null;

  const handleChange = (field: keyof AlertRulesConfig, val: number) => {
    setFormData((prev) => ({ ...prev, [field]: val }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setAlertRules(formData);
    setSavedNotice(true);
    setTimeout(() => {
      setSavedNotice(false);
      onClose();
    }, 1200);
  };

  const handleReset = () => {
    resetAlertRulesToDefault();
    setFormData(DEFAULT_ALERT_RULES);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-[#1E2C42] bg-[#121C2E] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#1E2C42] px-6 py-4 bg-[#0B1220]/60">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#22D3EE]/30 bg-[#22D3EE]/10 text-[#22D3EE]">
              <Sliders className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#E6EDF7]">
                Anomaly Detection &amp; Alert Rules
              </h3>
              <p className="text-xs text-[#8A9BB4]">
                Configure AI/statistical sensitivity thresholds (persisted locally)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#8A9BB4] hover:bg-[#1E2C42] hover:text-[#E6EDF7] transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Section 1: AI & Statistical Z-Score */}
          <div className="rounded-xl border border-[#1E2C42] bg-[#0B1220]/40 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Cpu className="h-4 w-4 text-[#22D3EE]" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#E6EDF7]">
                1. Statistical Z-Score Outlier Engine
              </h4>
            </div>
            <p className="text-xs text-[#8A9BB4] mb-3">
              Flags readings that deviate beyond $\sigma$ standard deviations from the station&apos;s 24-hour rolling baseline.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#CBD5E1] mb-1">
                  Z-Score Anomaly Threshold ($\sigma$)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="1.0"
                    max="5.0"
                    value={formData.zScoreThreshold}
                    onChange={(e) => handleChange('zScoreThreshold', parseFloat(e.target.value) || 2.5)}
                    className="w-full rounded-lg border border-[#1E2C42] bg-[#121C2E] px-3 py-2 font-mono text-xs text-[#E6EDF7] focus:border-[#22D3EE] focus:outline-none"
                  />
                  <span className="absolute right-3 top-2 text-xs font-mono text-[#8A9BB4]">σ (StdDev)</span>
                </div>
                <span className="text-[10px] text-[#8A9BB4]">Default: 2.5σ (98.8% confidence interval)</span>
              </div>
            </div>
          </div>

          {/* Section 2: Rate-of-Change (Industrial Signature) */}
          <div className="rounded-xl border border-[#1E2C42] bg-[#0B1220]/40 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="h-4 w-4 text-[#EF4444]" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#E6EDF7]">
                2. Rate-of-Change (Industrial Discharge Signature)
              </h4>
            </div>
            <p className="text-xs text-[#8A9BB4] mb-3">
              Sudden turbidity surges and acute dissolved oxygen drops indicate toxic effluent flush events.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#CBD5E1] mb-1">
                  Turbidity Rise Threshold (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="10"
                    max="300"
                    value={formData.turbidityRocPercent}
                    onChange={(e) => handleChange('turbidityRocPercent', parseFloat(e.target.value) || 40)}
                    className="w-full rounded-lg border border-[#1E2C42] bg-[#121C2E] px-3 py-2 font-mono text-xs text-[#E6EDF7] focus:border-[#22D3EE] focus:outline-none"
                  />
                  <span className="absolute right-3 top-2 text-xs font-mono text-[#8A9BB4]">% rise</span>
                </div>
                <span className="text-[10px] text-[#8A9BB4]">Default: +40% in window</span>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#CBD5E1] mb-1">
                  DO Depletion Threshold (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="10"
                    max="90"
                    value={formData.doDropPercent}
                    onChange={(e) => handleChange('doDropPercent', parseFloat(e.target.value) || 25)}
                    className="w-full rounded-lg border border-[#1E2C42] bg-[#121C2E] px-3 py-2 font-mono text-xs text-[#E6EDF7] focus:border-[#22D3EE] focus:outline-none"
                  />
                  <span className="absolute right-3 top-2 text-xs font-mono text-[#8A9BB4]">% drop</span>
                </div>
                <span className="text-[10px] text-[#8A9BB4]">Default: -25% in window</span>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#CBD5E1] mb-1">
                  Rate Window Duration
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="5"
                    max="120"
                    value={formData.rocTimeWindowMin}
                    onChange={(e) => handleChange('rocTimeWindowMin', parseFloat(e.target.value) || 30)}
                    className="w-full rounded-lg border border-[#1E2C42] bg-[#121C2E] px-3 py-2 font-mono text-xs text-[#E6EDF7] focus:border-[#22D3EE] focus:outline-none"
                  />
                  <span className="absolute right-3 top-2 text-xs font-mono text-[#8A9BB4]">minutes</span>
                </div>
                <span className="text-[10px] text-[#8A9BB4]">Default: 30 mins</span>
              </div>
            </div>
          </div>

          {/* Section 3: Statutory BIS IS 10500:2012 Thresholds */}
          <div className="rounded-xl border border-[#1E2C42] bg-[#0B1220]/40 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="h-4 w-4 text-[#FDE047]" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#E6EDF7]">
                3. Statutory BIS IS 10500:2012 Thresholds
              </h4>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#CBD5E1] mb-1">pH Min</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.phMin}
                  onChange={(e) => handleChange('phMin', parseFloat(e.target.value) || 6.5)}
                  className="w-full rounded-lg border border-[#1E2C42] bg-[#121C2E] px-3 py-2 font-mono text-xs text-[#E6EDF7] focus:border-[#22D3EE] focus:outline-none"
                />
                <span className="text-[10px] text-[#8A9BB4]">BIS: 6.5</span>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#CBD5E1] mb-1">pH Max</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.phMax}
                  onChange={(e) => handleChange('phMax', parseFloat(e.target.value) || 8.5)}
                  className="w-full rounded-lg border border-[#1E2C42] bg-[#121C2E] px-3 py-2 font-mono text-xs text-[#E6EDF7] focus:border-[#22D3EE] focus:outline-none"
                />
                <span className="text-[10px] text-[#8A9BB4]">BIS: 8.5</span>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#CBD5E1] mb-1">DO Min (mg/L)</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.doMinMgL}
                  onChange={(e) => handleChange('doMinMgL', parseFloat(e.target.value) || 5.0)}
                  className="w-full rounded-lg border border-[#1E2C42] bg-[#121C2E] px-3 py-2 font-mono text-xs text-[#E6EDF7] focus:border-[#22D3EE] focus:outline-none"
                />
                <span className="text-[10px] text-[#8A9BB4]">Min: 5.0 mg/L</span>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#CBD5E1] mb-1">Turbidity Max</label>
                <input
                  type="number"
                  step="0.5"
                  value={formData.turbidityMaxNtu}
                  onChange={(e) => handleChange('turbidityMaxNtu', parseFloat(e.target.value) || 5.0)}
                  className="w-full rounded-lg border border-[#1E2C42] bg-[#121C2E] px-3 py-2 font-mono text-xs text-[#E6EDF7] focus:border-[#22D3EE] focus:outline-none"
                />
                <span className="text-[10px] text-[#8A9BB4]">Max: 5.0 NTU</span>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#CBD5E1] mb-1">TDS Max (ppm)</label>
                <input
                  type="number"
                  value={formData.tdsMaxPpm}
                  onChange={(e) => handleChange('tdsMaxPpm', parseFloat(e.target.value) || 500)}
                  className="w-full rounded-lg border border-[#1E2C42] bg-[#121C2E] px-3 py-2 font-mono text-xs text-[#E6EDF7] focus:border-[#22D3EE] focus:outline-none"
                />
                <span className="text-[10px] text-[#8A9BB4]">BIS: 500 ppm</span>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#CBD5E1] mb-1">Conductivity Max</label>
                <input
                  type="number"
                  value={formData.conductivityMaxUscm}
                  onChange={(e) => handleChange('conductivityMaxUscm', parseFloat(e.target.value) || 1000)}
                  className="w-full rounded-lg border border-[#1E2C42] bg-[#121C2E] px-3 py-2 font-mono text-xs text-[#E6EDF7] focus:border-[#22D3EE] focus:outline-none"
                />
                <span className="text-[10px] text-[#8A9BB4]">Max: 1000 µS/cm</span>
              </div>
            </div>
          </div>

          {/* Footer Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-[#1E2C42]">
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#1E2C42] bg-[#0B1220] px-3.5 py-2 text-xs font-medium text-[#8A9BB4] hover:bg-[#1E2C42] hover:text-[#E6EDF7] transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset to BIS Defaults
            </button>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-[#1E2C42] px-4 py-2 text-xs font-medium text-[#8A9BB4] hover:text-[#E6EDF7] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#22D3EE] bg-[#22D3EE] px-5 py-2 text-xs font-bold text-[#0B1220] hover:bg-[#38BDF8] transition-all shadow-[0_0_15px_rgba(34,211,238,0.3)]"
              >
                {savedNotice ? (
                  <>
                    <Check className="h-3.5 w-3.5" /> Saved to LocalStorage
                  </>
                ) : (
                  'Save & Apply Rules'
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AlertRulesModal;
