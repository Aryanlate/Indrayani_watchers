import { STATIONS } from '@/lib/mockData';
import { Card } from '@/components/primitives/Card';
import { StatusBadge } from '@/components/primitives/StatusBadge';
import {
  Activity,
  Sliders, Database, Radio, BarChart3, Map as MapIcon,
  Cpu, Thermometer, Waves, Droplets, Wifi, Clock, Save, Gauge,
  BookOpen, Award, Globe, Shield, AlertTriangle,
  ArrowRight, User, Users, GraduationCap,
  ChevronRight
} from 'lucide-react';

const sectionHeaderCls = 'text-[#E6EDF7] text-2xl md:text-3xl font-bold tracking-tight';
const sectionKickerCls = 'text-[#22D3EE] text-xs md:text-sm font-semibold uppercase tracking-[0.18em] mb-2';
const stationPillCls = 'inline-flex items-center gap-1 rounded-md border border-[#1E2C42] bg-[#0D1524] px-2 py-0.5 font-mono text-[11px] text-[#8A9BB4]';
const iconWrapCls = 'inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[#17243B] text-[#22D3EE] shrink-0';

const STUDY_ORDER = ['S1', 'S4', 'S3', 'S2', 'S5', 'S6'];

const STUDY_META: Record<string, { displayName: string; purpose: string; status: 'good' | 'moderate' | 'poor' | 'very-poor'; longDesc: string }> = {
  S1: {
    displayName: 'Dehu Ghat',
    purpose: 'Reference · Prati-Pandharpur',
    status: 'good',
    longDesc: 'Upstream reference station at the historic Dehu ghat — birthplace of Sant Tukaram. Low anthropogenic load; serves as the baseline for downstream delta against all other stations.',
  },
  S4: {
    displayName: 'Ravet Bridge',
    purpose: 'Pre-MIDC Baseline',
    status: 'moderate',
    longDesc: 'Upstream of Bhaskari MIDC inlet; last clean cross-section before industrial effluent enters at Chikhali-Bhosari. Captures the pre-industrial river state.',
  },
  S3: {
    displayName: 'Moshi',
    purpose: 'Sewage Outfall',
    status: 'poor',
    longDesc: 'Moshi PR-Charholi drain confluence — untreated domestic sewage + storm-water mix. Major dissolved-oxygen depression zone.',
  },
  S2: {
    displayName: 'Alandi',
    purpose: 'Pilgrimage Ghat',
    status: 'moderate',
    longDesc: 'Sant Dnyaneshwar Samadhi Mandir ghat. High-footfall pilgrimage site; Wari & Kartik immersion events drive episodic turbidity & organic loading.',
  },
  S5: {
    displayName: 'Charholi / Nirgudi',
    purpose: 'Post-MIDC Industrial',
    status: 'very-poor',
    longDesc: 'Downstream confluence after Bhaskari MIDC and additional industrial tributary. Persistent electrolyte load; heaviest cumulative industrial signature in the corridor.',
  },
  S6: {
    displayName: 'Tulapur Confluence',
    purpose: 'Indrayani + Bhima',
    status: 'poor',
    longDesc: 'Confluence with the Bhima river at Tulapur. Dilution + self-purification partially restores WQI; masks further load as the combined flow continues south.',
  },
};

const HARDWARE = [
  {
    icon: Cpu,
    name: 'ESP32-WROOM-32',
    role: 'Host MCU',
    spec: 'Dual-core LX6 @ 240 MHz · 520 KB SRAM · 4 MB Flash · 802.11 b/g/n + BT 4.2 BR/EDR + BLE',
  },
  {
    icon: Droplets,
    name: 'pH Analog v1.1',
    role: 'pH Sensor',
    spec: 'E-201-C-BNC probe · 0–14 pH · ±0.01 pH resolution · 2-point NIST calibration @ 4.01 / 7.00 buffers',
  },
  {
    icon: Waves,
    name: 'Turbidity Nephelometer',
    role: 'NTU Sensor',
    spec: 'DS18B20-compensated IR 940 nm nephelometric head · 0–1000 NTU · ±5 % FS · Formazin standards',
  },
  {
    icon: Gauge,
    name: 'EC-TDS Probe K=1',
    role: 'Conductivity / TDS',
    spec: 'K=1 graphite probe · 0–10 mS/cm · 0–5000 ppm TDS · automatic DS18B20 temperature compensation',
  },
  {
    icon: Thermometer,
    name: 'DS18B20',
    role: 'Water Temp',
    spec: 'Waterproof One-Wire digital · −55 °C → +125 °C · ±0.5 °C accuracy · stainless-steel housing',
  },
  {
    icon: Save,
    name: 'MicroSD + SPI',
    role: 'Local Logging',
    spec: '16 GB Class-10 · FAT32 · per-reading CSV append · line CRC16 checksum · write-retry on write-slow cards',
  },
  {
    icon: Clock,
    name: 'DS3231 RTC',
    role: 'Time Reference',
    spec: 'I²C ±2 ppm TCXO · CR2032 backup · unix-timestamp per reading · drift < 1 min/year',
  },
  {
    icon: Wifi,
    name: 'Wi-Fi + LoRa SX1278',
    role: 'Dual Comm',
    spec: 'Primary: HTTPS POST / Wi-Fi. Fallback: LoRa 433 MHz 2–5 km suburban, 20 dBm · adaptive SF7–SF12',
  },
];

const ARCH_NODES = [
  { n: 1, icon: Activity, label: 'Sense', desc: '5-channel analog + 1-Wire poll at 3s cycle, ESP32 mutex-scheduled ADC oversampling' },
  { n: 2, icon: Sliders, label: 'Calibrate', desc: 'NIST-traceable curves · polynomial linearization · per-sensor EEPROM offsets' },
  { n: 3, icon: Database, label: 'Log', desc: 'DS3231 timestamp · CRC16 CSV append to SD · in-memory 256-sample ring buffer' },
  { n: 4, icon: Radio, label: 'Transmit', desc: 'Wi-Fi HTTPS POST / Supabase SSE · LoRa 433 MHz store-and-forward fallback' },
  { n: 5, icon: BarChart3, label: 'Analyse', desc: '72-h rolling · 4 anomaly algos · CUSUM · threshold → severity triage' },
  { n: 6, icon: MapIcon, label: 'Map', desc: '6-station WQI composite · MapLibre GL · live telemetry dashboard' },
];

const STANDARDS = [
  {
    icon: Award,
    body: 'BIS IS 10500:2012',
    issuer: 'Bureau of Indian Standards — Drinking Water Specification (Second Revision)',
    lines: ['pH 6.5 – 8.5', 'DO ≥ 5 mg/L', 'Turbidity ≤ 5 NTU', 'TDS ≤ 500 mg/L'],
    accent: '#22D3EE',
  },
  {
    icon: Shield,
    body: 'CPCB Classification',
    issuer: 'Central Pollution Control Board — Class B (Bathing Water)',
    lines: ['DO ≥ 5 mg/L', 'BOD₅ ≤ 3 mg/L', 'FC ≤ 500 MPN/100 mL', 'pH 6.5 – 8.5'],
    accent: '#22C55E',
  },
  {
    icon: Globe,
    body: 'WHO Drinking 5th Ed.',
    issuer: 'World Health Organization — Guideline values',
    lines: ['pH 6.5 – 8.0', 'Turbidity < 1 NTU', 'TDS 600 mg/L guidance', 'Aesthetic & health-based'],
    accent: '#FDE047',
  },
  {
    icon: BookOpen,
    body: 'CCME / NSF WQI',
    issuer: 'Canadian Council of Ministers of the Environment · NSF Water Quality Index',
    lines: ['≥ 80 Excellent / Good', '50–80 Moderate', '25–50 Poor', '< 25 Marginal'],
    accent: '#F97316',
  },
];

type FindingTone = 'good' | 'moderate' | 'poor' | 'very-poor';

interface Finding {
  headline: string;
  narrative: string;
  stationId: string;
  tone: FindingTone;
  stat: string;
}

const FINDINGS: Finding[] = [
  {
    stat: '+140% NTU · DO 2.3 mg/L',
    headline: 'S4 Chikhali MIDC evening-shift turbidity spike with 18-min hypoxia lag',
    narrative: 'Turbidity rises 85 NTU during second-shift discharge at Chikhali-Bhosari, followed 18 minutes later by dissolved-oxygen depression to 2.3 mg/L — below the 5 mg/L CPCB Class-B bathing limit. Temporal fingerprint matches factory effluent discharge schedules.',
    stationId: 'S4',
    tone: 'very-poor',
  },
  {
    stat: '720 ppm TDS · −40% benthic',
    headline: 'S5 Charholi persistent MIDC electrolyte baseline',
    narrative: 'Charholi/Nirgudi carries a persistent 720-ppm TDS signature dominated by sulfate/chloride electrolyte load; kick-sample macroinvertebrate count is 40% lower than the S1 Dehu reference reach — a biodiversity-loss signature.',
    stationId: 'S5',
    tone: 'very-poor',
  },
  {
    stat: '120–180 NTU · DO 4.2',
    headline: 'S2 Alandi Wari & Kartik episodic loading',
    narrative: 'Pandharpur Wari (Ashadhi Ekadashi) and Kartik idol-immersion events drive 120–180 NTU with organic soaps and flower-offering decomposition. DO rebounds in 48–72 h, but reaches a 4.2 mg/L dip during peak flow.',
    stationId: 'S2',
    tone: 'poor',
  },
  {
    stat: 'WQI 78–88 · ΔDO 0.8',
    headline: 'S1 Dehu reference reach stable',
    narrative: 'The upstream Dehu ghat is our cleanest reach: WQI consistently 78–88 (Good), diurnal DO swings only ~0.8 mg/L — a stable reference against which downstream delta at every other station is normalized.',
    stationId: 'S1',
    tone: 'good',
  },
  {
    stat: 'WQI 62 · dilution recovery',
    headline: 'S6 Tulapur confluence dilutes, does not purify',
    narrative: 'Confluence with the Bhama Askhed dam tailwater restores composite WQI to 62 (moderate) via hydraulic dilution. Bhima/self-purification credit cannot be claimed; combined flow transports unresolved loading further downstream.',
    stationId: 'S6',
    tone: 'moderate',
  },
  {
    stat: 'Pre-monsoon worst',
    headline: 'Seasonal: Apr–May concentration · Jun–Sep dilution · Oct nutrient',
    narrative: 'Pre-monsoon (Apr–May) concentrates all parameters in lowest flow; monsoon (Jun–Sep) dilutes but washes impervious-surface runoff; post-monsoon Oct runoff delivers a 15-day nutrient peak → algal bloom risk through November.',
    stationId: 'S3',
    tone: 'poor',
  },
];

function SectionHeader({ kicker, title, desc }: { kicker: string; title: string; desc?: string }) {
  return (
    <div className="mb-8 md:mb-10">
      <p className={sectionKickerCls}>{kicker}</p>
      <h2 className={sectionHeaderCls}>{title}</h2>
      {desc && <p className="mt-3 max-w-3xl text-sm md:text-base text-[#8A9BB4] leading-relaxed">{desc}</p>}
    </div>
  );
}

function StationIDPill({ id }: { id: string }) {
  return <span className={stationPillCls}>{id}</span>;
}

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
      <div className="pt-10 md:pt-14 pb-10 md:pb-14">
        <p className={sectionKickerCls}>Project Brief</p>
        <h1 className="text-[#E6EDF7] text-3xl md:text-5xl font-bold tracking-tight leading-tight">
          Indrayani Watchers
          <span className="block mt-2 text-[#22D3EE]">· 42.8 km of instrumented river corridor</span>
        </h1>
        <p className="mt-5 max-w-3xl text-sm md:text-base text-[#8A9BB4] leading-relaxed">
          An open, community-driven water-quality monitoring initiative coupling real-time IoT
          with public scholarship at six stations along the Indrayani, from Dehu
          ghat to the Tulapur confluence with the Bhima.
        </p>
      </div>

      {/* FR6.1 Problem Statement */}
      <section id="problem" className="mb-14 md:mb-20">
        <SectionHeader
          kicker="01 · Problem"
          title="Why we started watching"
        />
        <div className="grid gap-6 lg:grid-cols-5">
          <Card className="p-6 md:p-8 lg:col-span-3">
            <p className="text-[#E6EDF7] text-sm md:text-base leading-7">
              The Indrayani is a sacred and agriculturally vital tributary of the
              Bhima, flowing 90 km through Lonavala, Dehu, Alandi, and Pune
              district. It supplies drinking-water intakes, feeds the Bhaskari
              command-aquifer recharge, and hosts some of Maharashtra&rsquo;s most
              revered ghats at Dehu (Sant Tukaram) and Alandi (Sant
              Dnyaneshwar).
            </p>
            <p className="mt-4 text-[#E6EDF7] text-sm md:text-base leading-7">
              Field reconnaissance in 2024–25 documented three persistent
              degradation drivers: (1) Bhaskari MIDC Chikhali–Bhosari
              industrial discharge, (2) Moshi–Charholi domestic sewage outfalls
              bypassing treatment, and (3) episodic turbidity & organic loading
              during pilgrimage immersion events at Alandi during Wari & Kartik.
            </p>
            <p className="mt-4 text-[#8A9BB4] text-sm md:text-base leading-7">
              Regulatory monitoring is quarterly at best; we needed a public,
              real-time, calibration, auditable signal at a 3-second cadence so
              citizens, researchers, and agencies can see the river on a screen, detect
              anomalies within 18 minutes of occurrence, and act with evidence.
            </p>
          </Card>

          <Card className="p-6 md:p-8 lg:col-span-2" style={{ borderLeftWidth: 3, borderLeftColor: 'rgba(34, 211, 238, 0.6)' }}>
            <div className="flex items-center gap-3">
              <div className={iconWrapCls}><Shield size={18} /></div>
              <h3 className="text-[#E6EDF7] font-semibold">Regulatory frame</h3>
            </div>
            <p className="mt-4 text-[#E6EDF7] text-sm leading-7">
              Every live reading is compared simultaneously against{' '}
              <span className="font-semibold">BIS IS 10500:2012</span> drinking-water limits, <span className="font-semibold">CPCB Class-B</span> bathing-water criteria, and the <span className="font-semibold">WHO 5th Ed.</span> guidance, and reduced to a single <span className="text-[#22D3EE] font-semibold">CCME/NSF WQI</span> composite score per station.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              {[
                ['pH', '6.5 – 8.5'],
                ['DO', '≥ 5 mg/L'],
                ['Turbidity', '≤ 5 NTU'],
                ['TDS', '≤ 500 ppm'],
              ].map(([k, v]) => (
                <div key={k} className="rounded-lg border border-[#1E2C42] bg-[#0D1524] px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wider text-[#8A9BB4]">{k}</p>
                  <p className="mt-0.5 font-mono text-sm text-[#E6EDF7]">{v}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {[
            ['42.8 km', 'Instrumented corridor'],
            ['6 stations', 'S1 → S6 longitudinal'],
            ['5 parameters', 'pH · DO · NTU · TDS · T°'],
            ['3 s', 'Telemetry cadence'],
          ].map(([v, l]) => (
            <Card key={l} className="p-4 md:p-5">
              <p className="text-[#22D3EE] font-mono text-2xl md:text-3xl font-semibold tracking-tight">{v}</p>
              <p className="mt-1 text-xs md:text-sm text-[#8A9BB4]">{l}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* FR6.2 Six-Station Study Area */}
      <section id="stations" className="mb-14 md:mb-20">
        <SectionHeader
          kicker="02 · Study Area"
          title="Six stations from Dehu to the Tulapur confluence"
          desc="A longitudinal reference-baseline-outfall-pilgrimage-industrial-confluence transect, ordered by the hypothesis we study them — not by river km."
        />
        <div className="grid gap-4 md:gap-5 md:grid-cols-2 xl:grid-cols-3">
          {STUDY_ORDER.map((sid, idx) => {
            const st = STATIONS.find((s) => s.id === sid)!;
            const meta = STUDY_META[sid];
            return (
              <Card key={sid} className="p-5 md:p-6 flex flex-col gap-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                  <StationIDPill id={st.id} />
                  <span className="text-[11px] uppercase tracking-[0.14em] text-[#8A9BB4]">0{idx + 1}</span>
                  </div>
                  <StatusBadge status={meta.status} size="sm" />
                </div>
                <div>
                  <h3 className="text-[#E6EDF7] text-lg font-semibold">{meta.displayName}</h3>
                  <p className="mt-0.5 text-[#22D3EE] text-xs md:text-sm font-medium">{meta.purpose}</p>
                </div>
                <p className="text-[#8A9BB4] text-sm leading-6 flex-1">{meta.longDesc}</p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-2 border-t border-[#1E2C42] text-xs font-mono text-[#8A9BB4]">
                  <span>lat {st.lat.toFixed(4)}°N</span>
                  <span>lng {st.lng.toFixed(4)}°E</span>
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      {/* FR6.3 Hardware */}
      <section id="hardware" className="mb-14 md:mb-20">
        <SectionHeader
          kicker="03 · Hardware"
          title="A field node, eight boards, one node every station"
          desc="Off-the-shelf modules, NIST-traceable calibrations, and a calibration schedule that keeps honest low-cost sensors honest. Every node logs locally before it transmits remotely."
        />
        <div className="grid gap-4 md:gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {HARDWARE.map((h) => (
            <Card key={h.name} className="p-5 flex flex-col gap-3">
              <div className={iconWrapCls}><h.icon size={18} /></div>
              <div>
                <p className="text-[#E6EDF7] font-semibold leading-snug">{h.name}</p>
                <p className="text-[11px] uppercase tracking-[0.14em] text-[#22D3EE] mt-0.5">{h.role}</p>
              </div>
              <p className="text-[#8A9BB4] text-sm leading-6">{h.spec}</p>
            </Card>
          ))}
        </div>

        <Card className="mt-6 p-5 md:p-6">
          <div className="flex flex-col md:flex-row md:items-start md:items-center gap-4">
            <div className={iconWrapCls}><Sliders size={18} /></div>
            <div className="flex-1">
              <h4 className="text-[#E6EDF7] font-semibold">Calibration schedule</h4>
              <p className="mt-1 text-sm text-[#8A9BB4] leading-relaxed">
                pH weekly (NIST 4.01 / 7.00 two-point). EC-TDS bi-weekly 1413 µS/cm
                standard. Turbidity monthly formazin 0.1 / 10 / 100 NTU
                three-point. Temperature & conductivity-curve reference DS18B20 ±0.5 °C 0 °C ice-bath spot-check on every 90-day field rotation.
              </p>
            </div>
          </div>
        </Card>
      </section>

      {/* FR6.4 Architecture Horizontal Flow */}
      <section id="architecture" className="mb-14 md:mb-20">
        <SectionHeader
          kicker="04 · Architecture"
          title="Sense → Calibrate → Log → Transmit → Analyse → Map"
          desc="Six stages, 3 seconds end-to-end. Local-first: the node never trusts the network."
        />
        <div className="relative">
          <div className="flex flex-col md:flex-row md:items-stretch gap-3 md:gap-0 md:overflow-x-auto scrollbar-hide">
            {ARCH_NODES.map((nd, i) => (
              <div key={nd.label} className="flex md:min-w-[220px] md:items-stretch">
                <Card className="p-5 flex flex-col gap-3 h-full">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#17243B] text-[#22D3EE] font-mono text-xs font-semibold">
                      0{nd.n}
                    </span>
                    <div className="h-8 w-8 rounded-lg border border-[#1E2C42] bg-[#0D1524] flex items-center justify-center text-[#22D3EE]">
                      <nd.icon size={16} />
                    </div>
                  </div>
                  <h4 className="text-[#E6EDF7] text-lg font-semibold tracking-tight">{nd.label}</h4>
                  <p className="text-[#8A9BB4] text-sm leading-6">{nd.desc}</p>
                </Card>
                {i < ARCH_NODES.length - 1 && (
                  <div className="hidden md:flex items-center justify-center px-2 text-[#22D3EE]">
                    <ChevronRight size={22} strokeWidth={2.2} />
                  </div>
                )}
                {i < ARCH_NODES.length - 1 && (
                  <div className="md:hidden flex items-center justify-center py-2 text-[#22D3EE]">
                    <ArrowRight size={20} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs md:text-sm text-[#8A9BB4]">
          <span className="inline-flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#22D3EE]" />
            3 s end-to-end telemetry
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#22C55E]" />
            72 h rolling history
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#FDE047]" />
            4 detection algorithms
          </span>
        </div>
      </section>

      {/* FR6.5 Standards */}
      <section id="standards" className="mb-14 md:mb-20">
        <SectionHeader
          kicker="05 · Standards"
          title="Four authorities, one display"
          desc="We do not pick a single standard; we show the reading against all four and let the reader reason which applies to their question."
        />
        <div className="grid gap-4 md:gap-5 md:grid-cols-2 xl:grid-cols-4">
          {STANDARDS.map((s) => (
            <Card key={s.body} className="p-5 md:p-6 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div
                  className="h-9 w-9 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${s.accent}1A`, color: s.accent, border: `1px solid ${s.accent}40` }}
                >
                  <s.icon size={17} />
                </div>
                <h4 className="text-[#E6EDF7] font-semibold leading-snug">{s.body}</h4>
              </div>
              <p className="text-[#8A9BB4] text-xs leading-5">{s.issuer}</p>
              <ul className="flex flex-col gap-1.5 pt-2 border-t border-[#1E2C42]">
                {s.lines.map((l) => (
                  <li key={l} className="flex items-center gap-2 text-sm text-[#E6EDF7]">
                    <span className="h-1 w-1 rounded-full" style={{ backgroundColor: s.accent }} />
                    <span className="font-mono text-[13px]">{l}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </section>

      {/* FR6.6 Key Findings */}
      <section id="findings" className="mb-14 md:mb-20">
        <SectionHeader
          kicker="06 · Key Findings"
          title="Six things the 90-day pilot answered"
          desc="Field + telemetry synthesis across the dry-season pilot. Each card = one reproducible result, tagged by station and severity."
        />
        <div className="grid gap-4 md:gap-5 md:grid-cols-2">
          {FINDINGS.map((f, idx) => (
            <Card key={f.headline} className="p-5 md:p-6 flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className="inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-mono font-semibold tracking-wide"
                  style={{
                    backgroundColor:
                      f.tone === 'good'
                        ? 'rgba(34, 197, 94, 0.10)'
                        : f.tone === 'moderate'
                        ? 'rgba(253, 224, 71, 0.10)'
                        : f.tone === 'poor'
                        ? 'rgba(249, 115, 22, 0.10)'
                        : 'rgba(239, 68, 68, 0.10)',
                    borderColor:
                      f.tone === 'good'
                        ? 'rgba(34, 197, 94, 0.28)'
                        : f.tone === 'moderate'
                        ? 'rgba(253, 224, 71, 0.28)'
                        : f.tone === 'poor'
                        ? 'rgba(249, 115, 22, 0.28)'
                        : 'rgba(239, 68, 68, 0.28)',
                    color:
                      f.tone === 'good'
                        ? '#22C55E'
                        : f.tone === 'moderate'
                        ? '#FDE047'
                        : f.tone === 'poor'
                        ? '#F97316'
                        : '#EF4444',
                  }}
                >
                  <AlertTriangle className="mr-1.5" size={12} />
                  Finding 0{idx + 1}
                </span>
                <StationIDPill id={f.stationId} />
                <StatusBadge status={f.tone} size="sm" showDot />
              </div>
              <p className="text-[#22D3EE] font-mono text-sm md:text-base font-semibold tracking-tight">{f.stat}</p>
              <h4 className="text-[#E6EDF7] text-base md:text-lg font-semibold leading-snug">{f.headline}</h4>
              <p className="text-[#8A9BB4] text-sm leading-6">{f.narrative}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* FR6.7 Team Credits */}
      <section id="team" className="mb-14 md:mb-20">
        <SectionHeader
          kicker="07 · Team"
          title="A four-person capstone, one guide, one department"
        />
        <Card className="p-6 md:p-8" style={{ borderLeftWidth: 3, borderLeftColor: 'rgba(34, 211, 238, 0.6)' }}>
          <div className="flex flex-col md:flex-row md:items-center gap-5">
            <div
              className="h-16 w-16 md:h-20 md:w-20 shrink-0 rounded-2xl border border-[#1E2C42] bg-gradient-to-br from-[#17243B] to-[#0D1524] flex items-center justify-center text-[#22D3EE]"
            >
              <GraduationCap size={34} />
            </div>
            <div className="flex-1">
              <p className="text-[#22D3EE] text-xs font-semibold uppercase tracking-[0.18em]">Project Guide</p>
              <h3 className="mt-1 text-[#E6EDF7] text-2xl md:text-3xl font-bold tracking-tight">Prof. Vinayak Kulkarni</h3>
              <p className="mt-1 text-[#8A9BB4] text-sm md:text-base">
                Electronics &amp; Telecommunication Engineering · MIT Academy of Engineering, Alandi · Savitribai Phule Pune University
              </p>
            </div>
            <div className="hidden md:flex flex-col items-end gap-1 text-xs text-[#8A9BB4]">
              <span>ENTC Department</span>
              <span>MIT AOE · Alandi (D)</span>
              <span>Pune · Maharashtra</span>
            </div>
          </div>
        </Card>

        <p className="mt-6 text-[#E6EDF7] text-sm md:text-base font-semibold">
          B.E. Final Year Project · ENTC Dept · MIT AOE Alandi (SPPU)
        </p>

        <div className="mt-4 grid gap-4 md:gap-5 sm:grid-cols-2">
          {[
            {
              name: 'Snehal Landge', role: 'Hardware & Firmware',
              lines: ['ESP32 firmware', 'PCB routing & layout', 'calibration schedules', 'enclosure & field deployment'],
              tone: '#22D3EE',
            },
            {
              name: 'Yashraj Panhale', role: 'Backend & Detection',
              lines: ['Node / Express ingest', 'Supabase row-level SSE streams', 'anomaly detection algorithms', 'alert rule-engine'],
              tone: '#22C55E',
            },
            {
              name: 'Aryan Late', role: 'Frontend & Mapping',
              lines: ['Next.js 14 dashboard', 'MapLibre GL live map', 'Recharts telemetry', 'a11y & responsiveness'],
              tone: '#FDE047',
            },
            {
              name: 'Shubham Uttarwar', role: 'Field & Baselines',
              lines: ['Field deployment surveys', 'enclosure & node baseline data collection', 'reach habitat field notes', 'GPS waypoints'],
              tone: '#F97316',
            },
          ].map((m) => (
            <Card key={m.name} className="p-5 md:p-6 flex flex-col gap-4">
              <div className="flex items-center gap-4">
                <div
                  className="h-12 w-12 shrink-0 rounded-xl border border-[#1E2C42] bg-[#0D1524] flex items-center justify-center"
                  style={{ color: m.tone }}
                >
                  <User size={22} />
                </div>
                <div>
                  <h4 className="text-[#E6EDF7] text-lg font-semibold tracking-tight">{m.name}</h4>
                  <p className="text-[#8A9BB4] text-xs md:text-sm">{m.role}</p>
                </div>
              </div>
              <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 pt-3 border-t border-[#1E2C42]">
                {m.lines.map((l) => (
                  <li key={l} className="text-xs md:text-sm text-[#E6EDF7] flex items-start gap-1.5">
                    <span
                      className="mt-1.5 h-1 w-1 shrink-0 rounded-full"
                      style={{ backgroundColor: m.tone }}
                    />
                    <span>{l}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>

        <div className="mt-8 flex flex-col sm:flex-row items-start sm:items-center gap-4 rounded-xl border border-[#1E2C42] bg-[#0D1524] px-5 py-4">
          <Users className="text-[#8A9BB4] shrink-0" size={20} />
          <p className="text-sm text-[#8A9BB4] leading-6">
            <span className="text-[#E6EDF7] font-semibold">ENTC Department, MIT Academy of Engineering, Alandi (D).</span> Savitribai Phule Pune University · B.E. Final Year Capstone 2024–25 ·{' '}
            <span className="text-[#22D3EE]">Open-source release under MIT.</span>
          </p>
        </div>
      </section>
    </div>
  );
}
