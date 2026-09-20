# Part 9 — Polish, Responsiveness & About Page

## Problem

The Indrayani Watch application requires a final polish pass covering mobile responsiveness, loading experience, error/empty states, accessibility, performance, a comprehensive About page, and a footer disclaimer. The current implementation:
- Lacks mobile-optimized navigation (bottom tab bar is an in-header row)
- Has no horizontal snap-scroll carousel for the station grid on mobile
- Uses a slide-in side panel for map stations instead of a mobile bottom sheet
- Missing skeleton screens that match final layout dimensions (no CLS prevention)
- Missing retry actions in empty/error states across data components
- No keyboard-navigable map markers or ARIA live region for alerts
- Unmemoised chart data, no 30fps map throttling on low-end devices, no lazy-loaded news images
- About page is a minimal stub
- No footer disclaimer

## Users

- **Mobile users** (≤ 380px viewport): Citizens and field inspectors accessing the dashboard and map from phones
- **Desktop users**: Researchers and municipal officers at control room workstations
- **Screen reader & keyboard users**: Accessibility-first stakeholders
- **Low-end device users**: Phones with limited GPU / CPU resources

## Goals

1. Deliver a mobile-first responsive design that is fully usable at 380px width
2. Eliminate Cumulative Layout Shift (CLS) from loading states with dimension-matched skeletons
3. Ensure every data-fetching component has empty and error states with a retry action
4. Achieve WCAG 2.1 AA compliance (4.5:1 contrast, keyboard navigation, ARIA live regions, prefers-reduced-motion)
5. Optimize render performance for low-end devices
6. Deliver a comprehensive `/about` page presenting the full project
7. Add a footer disclaimer across all pages

## Non-Goals

- No backend API changes or new routes
- No database schema changes
- No changes to existing visual design system colors or typography tokens
- No reworking of alert detection algorithms

---

## Functional Requirements (FR)

### FR1: Mobile Responsiveness

#### FR1.1 Station Grid → Horizontal Snap-Scroll Carousel
- On viewports < 640px (sm breakpoint), `StationGrid` renders as a horizontally-scrolling carousel
- Uses CSS `scroll-snap-type: x mandatory` + `scroll-snap-align: start`
- Each station card is ~85% of viewport width (not full-width), showing peek of next card
- Left/right scroll hint indicators (gradient fades) on mobile
- No scroll bars visible on mobile (webkit scrollbar hidden)
- On ≥640px, existing 2-3 column grid remains unchanged

#### FR1.2 Map Side Panel → Mobile Bottom Sheet
- On viewports < 1024px (lg breakpoint), `StationSidePanel` renders as a bottom sheet instead of right-side slide-in
- Bottom sheet: rounded top corners (rounded-t-2xl), slides up from bottom, max-height 85vh, scrollable content
- Full-screen backdrop overlay (backdrop-blur-sm) that dismisses on click
- Handle bar (1px, 36px wide, centered pill) at top of bottom sheet for visual affordance
- On ≥1024px, existing right-side slide-in panel behaviour unchanged

#### FR1.3 Navigation → Bottom Tab Bar (mobile)
- On viewports < 768px (md breakpoint), desktop top nav links are hidden
- Bottom tab bar fixed to bottom of viewport (bottom-0, w-full), 4 links + alerts bell
- Bottom tab item: icon + text label, 56px height, active state with cyan text and 2px top border indicator
- Main content area has padding-bottom equal to tab bar height (64px) to avoid clipping
- Alert bell badge count (red pill) shows over the Alerts tab icon
- On ≥768px, existing top navbar nav links remain active
- Footer disclaimer sits above bottom tab bar on mobile, below main content on desktop

### FR2: Loading Skeletons (Zero CLS)

#### FR2.1 Station Grid Skeleton
- Skeleton cards match `StationCard` exact dimensions: same border-radius, same padding, same 3px left-border placeholder
- Skeleton contains: 40px header (title block + status badge block), 4 KPI blocks (2x2 grid with same widths), 40px sparkline placeholder
- Uses `animate-pulse` but disabled under `prefers-reduced-motion`
- Shown while initial readings load (before mockData populates); never shown if data already seeded

#### FR2.2 Map Loading Skeleton
- Replaces the current spinner with a skeleton that matches `RiverMap` container:
  - Map canvas: same `h-[calc(100vh-64px)]` with gradient mock terrain (dark slate to slightly lighter slate)
  - Top-left overlay controls skeleton (4 pill placeholders matching MapOverlayControls layout)
  - Bottom time scrubber skeleton (same height, pill/handle placeholders)
- No layout shift between skeleton and real map

#### FR2.3 Comparison Chart Skeleton
- Height matches chart container (340px) exactly
- Header skeleton: title block + 2 filter bar placeholders (same widths as param + range selectors)
- Chart body: 2 horizontal grid lines + 6 thin diagonal line placeholders matching station line traces
- BIS banner skeleton row (same height)

#### FR2.4 Station Side Panel Skeleton
- Header block (station ID pill, name, status badge), WQI banner block, breaches banner placeholder
- 5 radial gauge placeholders (2 col + 1 span-2, same grid layout)
- 24h mini-chart skeleton bar
- Link-to-station CTA button skeleton

#### FR2.5 Alert List Skeleton
- 3 alert item placeholders matching exact height and layout of real alerts:
  - Severity badge block, station name block, timestamp block
  - 2 lines of text (message + cause hint)
  - 3 diagnostic footer blocks + 2 button placeholders

### FR3: Empty & Error States with Retry

#### FR3.1 Dashboard / Station Data
- **Empty state** (no readings available): Illustrated "No telemetry data" panel with a retry button that calls `force re-seed + re-poll`
- **Error state** (fetch failed / stream disconnected): "Telemetry connection lost" card with red icon, error message, and a prominent "Reconnect" button that triggers `apiClient.connectStream()` + re-poll

#### FR3.2 News Page
- **Empty state** (no articles): Already exists per code review but needs a "Try refreshing" retry button that calls `fetchNews(true)`
- **Error state**: Banner notice (already present) enhanced with a "Retry fetch" inline button next to the message (not just "displaying cached")

#### FR3.3 Alerts Page
- **Empty state** (no alerts): Already has "No Matching Alerts Found" but needs reset-filters-to-see-all + "Simulate anomaly" buttons if zero alerts total
- **Error state** (fetch fails): Add error banner with retry action at top of page

#### FR3.4 Station Detail / Station Side Panel
- **Empty state** (no station data): "Station offline" panel with last-known-good timestamp if available
- **Error state** (history fetch failed): Warning block with "Retry loading history" button

#### FR3.5 Map
- **Error state** (MapLibre fails to initialize): Full-coverage panel with "Map failed to load" + "Retry map initialization" button that triggers component remount via key change

### FR4: Accessibility

#### FR4.1 Keyboard-Navigable Map Markers
- Each station marker DOM element has `tabindex="0"`
- Markers are focusable via Tab key
- On Enter or Space keypress, the marker opens the side panel / bottom sheet (same as click)
- Focus ring is visible around focused marker (2px cyan outline, offset 2px)
- Map container has `aria-label="Indrayani River monitoring map. Use arrow keys to pan, + / - to zoom, Tab to focus station markers."`

#### FR4.2 ARIA Live Region for Critical Alerts
- Add a persistent visually-hidden `role="status"` (polite) live region in `layout.tsx` or `AlertToast`
- When a new critical alert arrives (severity=critical), announce: `"CRITICAL ALERT at Station X: message"`
- When a new warning alert arrives and no critical is pending, announce: `"Warning at Station X: message"` (polite, low priority)
- Existing `role="alert"` on the toast div is preserved for assistive tech interrupt

#### FR4.3 Contrast Verification (≥ 4.5:1)
- Verify all text-on-background combinations:
  - `#E6EDF7` on `#0B1220` → pass (~15.5:1)
  - `#8A9BB4` on `#0B1220` → pass (~6.8:1)
  - `#22D3EE` on `#0B1220` → pass (~7.8:1)
  - Status colors on dark backgrounds: `#22C55E` good, `#EAB308` verify ≥4.5:1 (may need adjustment if failing, bump to `#FDE047` or add background pill)
  - `#EF4444` on `#0B1220` → pass (~5.2:1)
  - Badge text on colored badge backgrounds (e.g. red text on red-tinted bg): verify or darken badge bg slightly
- Any failing pairs are corrected (color adjusted or background overlay added)

#### FR4.4 prefers-reduced-motion: Full Support
- **Current state**: Basic rule exists in globals.css
- **Required additions**:
  - Disable sonar ripple marker animations (set animation: none)
  - Disable river flow line dash animation (static dash or hidden)
  - Disable station card pulse animations on data update
  - Disable time scrubber play animation (still step changes)
  - Disable toast slide-in (instant appearance)
  - Disable animate-pulse on skeletons
  - Disable KPI row pulsing indicators
- Keep base transitions under 150ms (opacity only) so focus/hover still work but without motion flare

### FR5: Performance Optimizations

#### FR5.1 Memoise Chart Data
- `ComparisonChart` chartData `useMemo` already exists — verify dependency array is correct and no unnecessary recomputes on unrelated state changes
- `StationSidePanel` 24h mini-chart `chartData` must be wrapped in `useMemo` with `[history24h]` deps
- Sparkline data in dashboard: already memoised via state, but ensure StationCard doesn't recompute sparkline path on every render (memo SVG path)

#### FR5.2 Throttle Map Animation to 30fps on Low-End Devices
- Detect low-end devices using:
  - `navigator.hardwareConcurrency` ≤ 4, OR
  - `navigator.deviceMemory` ≤ 4 (if available), OR
  - user explicitly has `prefers-reduced-motion: reduce`
- On low-end devices:
  - River flow line animation uses `setTimeout` 33ms interval (30fps) instead of `requestAnimationFrame` 60fps, OR
  - Animation frame loop calls `setPaintProperty` on every 2nd frame (effectively 30fps)
- On high-end devices: existing 60fps behaviour preserved
- Device class detection runs once on mount, cached in module-level variable

#### FR5.3 Lazy-Load News Images
- `NewsCard` images already use `loading="lazy"` — verify `decoding="async"` is also set
- Add a 1x1 transparent SVG data-URL placeholder as initial `src` (prevents broken-image icon), swapped in via `IntersectionObserver` if within 200px of viewport (existing `loading="lazy"` is sufficient but reinforce with placeholder gradient bg matching image dimensions)
- Image container must have `aspect-ratio: 16/9` (h-44 already implies this) with gradient placeholder bg so skeleton CLS is zero even before image loads

### FR6: /about Page

The About page must include all sections below, all styled to match the existing design language (cards, borders, cyan accents, monospace IDs, etc.):

#### FR6.1 Problem Statement Section
- Heading: "The Problem"
- 2–3 paragraph narrative: Indrayani River significance (sacred, Dehu/Alandi pilgrimage, agriculture, municipal water source), degradation drivers (Bhaskari MIDC industrial discharge Chikhali/Bhosari, untreated sewage at Moshi/Charholi, idol immersion turbidity spikes), consequences (hypoxia events, aquatic kill, public health risk during religious bathing), and the monitoring gap (no real-time basin-scale data)
- BIS IS 10500:2012 permissible limits callout box
- Highlight statistic: "42.8 km corridor, 6 stations, 5 parameters, 3-second telemetry"

#### FR6.2 Six-Station Study Area
- Heading: "Study Area: 6 Monitoring Stations"
- Station list table or cards grid (S1 → S6 upstream→downstream):
  - S1 Dehu Ghat (Upstream Reference / Prati-Pandharpur Pilgrimage Ghat)
  - S4 Ravet Bridge (Pre-MIDC Baseline)
  - S3 Moshi (Sewage Outfall Junction, PR Zone Drain Confluence)
  - S2 Alandi (Pilgrimage Ghat, Sant Dnyaneshwar Samadhi Mandir)
  - S5 Charholi / Nirgudi (Post-MIDC Industrial Confluence, Downstream MIDC)
  - S6 Confluence at Tulapur (Indrayani + Bhima River Merge Point)
- Each entry: station ID pill, name, description (1 line), coordinate (lat/lng), status color dot, purpose (reference / industrial / sewage / confluence etc.)

#### FR6.3 Hardware List
- Heading: "Hardware: Low-Cost Open IoT Node"
- Component cards or icon + list layout:
  - **Microcontroller**: ESP32-WROOM-32 (dual-core, Wi-Fi 802.11 b/g/n, BLE 4.2, 520KB SRAM, 4MB Flash)
  - **pH Sensor**: Analog pH meter v1.1 with E-201-C electrode (range 0–14, ±0.01 pH resolution, 2-point NIST buffer calibration)
  - **Turbidity Sensor**: DS18B20-compatible nephelometric turbidity module (0–1000 NTU, IR LED 940nm, ±5% FS accuracy)
  - **EC-TDS Sensor**: Analog TDS / conductivity probe (K=1, range 0–5000 ppm / 0–10 mS/cm, temperature compensation via DS18B20)
  - **Temperature Sensor**: DS18B20 waterproof digital probe (-55°C to +125°C, ±0.5°C accuracy, One-Wire)
  - **Data Logging**: MicroSD card module (SPI, 16GB minimum, FAT32, per-reading CSV append with CRC)
  - **Real-Time Clock**: DS3231 RTC module (I²C, ±2 ppm @ 0–40°C, backup coin cell CR2032, 32-bit Unix timestamp per reading)
  - **Communication**: Primary Wi-Fi (HTTPS POST to backend), Fallback LoRa SX1278 (433 MHz, ~2–5 km suburban, 20 dBm max) for disconnected stretches
- Note: "Sensor calibration schedule: 2-point pH buffer 4.01 / 7.00 weekly; TDS/EC conductivity meter reference solution 1413 µS/cm bi-weekly; turbidity formazin standards 0.1 / 10 / 100 NTU monthly."

#### FR6.4 System Architecture — Horizontal Flow Diagram
- Heading: "System Architecture"
- Horizontal 6-step flow with arrow connectors:
  1. **Sense** (Sensor Probes) → Icon: Waves/Sensors icon
  2. **Calibrate** (On-node calibration + DS3231 RTC sync) → Icon: Sliders / Gauge icon
  3. **Log** (CSV append to SD + CRC check) → Icon: Hard-drive / Database icon
  4. **Transmit** (Wi-Fi HTTPS POST + LoRa FEC fallback) → Icon: Radio / Wi-Fi icon
  5. **Analyse** (Z-Score + Rate-of-Change + BIS Threshold → WQI) → Icon: Bar-chart / Cpu icon
  6. **Map** (Realtime MapLibre UI + Alert Broadcast) → Icon: Map icon
- Each node: rounded card with step number, icon, label, 1-line description
- Cyan arrows between nodes (→) or chevron connectors
- Legend bar below: "3s end-to-end telemetry cycle • 72h rolling history • 4 detection algorithms"

#### FR6.5 Standards Used
- Heading: "Regulatory & Methodological Standards"
- Four cards or badge list:
  - **BIS IS 10500:2012**: Drinking Water Specification (Second Revision). Bureau of Indian Standards. pH 6.5–8.5, DO ≥5 mg/L, Turbidity ≤5 NTU, TDS ≤500 ppm.
  - **CPCB Water Quality Classification**: Central Pollution Control Board (India). Class A–E designated best-use criteria; Class B (outdoor bathing) requires DO ≥5 mg/L, BOD ≤3 mg/L, FC ≤500 MPN/100mL.
  - **WHO Guidelines for Drinking-Water Quality (5th Ed.)**: World Health Organization. pH 6.5–8.0, Turbidity ideally <1 NTU, TDS guidance level 600 mg/L.
  - **CCME / NSF WQI**: Canadian Council of Ministers of the Environment / National Sanitation Foundation Water Quality Index. Weighted composite index aggregating pH, DO, turbidity, TDS, temperature into 0–100 score (≥80 Excellent / Good, 50–80 Moderate, 25–50 Poor, <25 Very Poor / Marginal).
- Each card: standard name in bold, issuing body, key relevant parameters, why adopted

#### FR6.6 Key Findings
- Heading: "Preliminary Key Findings" (2024–25 field data insights)
- 4–6 insight cards with headline, description, station reference, severity tag:
  1. "S4 Chikhali MIDC: Turbidity +140% spikes (85 NTU) coincide with evening shift-change effluent release. DO collapse to 2.3 mg/L observed 18 min post-surge (hypoxia)."
  2. "S5 Charholi: TDS baseline 720 ppm (BIS breach, >500 ppm) — persistent inorganic electrolyte load from MIDC drains. Correlated with 40% aquatic macroinvertebrate biodiversity loss (benchmark vs S1)."
  3. "S2 Alandi Pilgrimage Ghats: Turbidity events during Pandharpur Wari / Kartik Purnima (NTU peaks 120–180) — organic matter + clay from ritual bathing and idol immersion. Dissolved Oxygen dips to 4.2 mg/L."
  4. "S1 Dehu Ghat (Reference): Consistent WQI 78–88 (Good). Serves as upstream control. Seasonal DO variance only (~0.8 mg/L diel cycle)."
  5. "S6 Tulapur Confluence: WQI recovery to 62 (Moderate) via dilution + self-purification, suggesting Bhama askhed / Mula-Mutha confluence further masks Indrayani load. No river-mixing credit assumed."
  6. "Seasonal Pattern: Pre-monsoon (April–May) shows worst metrics (higher concentration). Monsoon dilution (June–Sept) but post-monsoon runoff carries nutrient load → algal bloom risk."
- Each card: stat value callout, station tag, optional mini sparkline color

#### FR6.7 Team Credits
- Heading: "Project Team"
- Subheading: "B.E. Final Year Project, Electronics & Telecommunication (ENTC) Department, MIT Academy of Engineering, Alandi (Savitribai Phule Pune University)."
- Guide: "Prof. Vinayak Kulkarni, ENTC Department, MIT AOE" (prominent, styled differently — larger card or callout badge)
- Student team: 4 cards in 2x2 grid (or horizontal on desktop, stacked on mobile), each with:
  - Snehal Landge (Hardware Design & Sensor Integration — ESP32 firmware, PCB layout, calibration bench)
  - Yashraj Panhale (Backend Engineering & Data Pipeline — Node/Express, Supabase, SSE telemetry stream, detection algorithms)
  - Aryan Late (Frontend Engineering, Cartography & UI/UX — Next.js, MapLibre GL, Recharts, Accessibility)
  - Shubham Uttarwar (Field Deployment & Validation — site surveys, node enclosure, field calibration, baseline data collection)
- Each card: name bold, role below, optional cyan top border accent

### FR7: Footer Disclaimer

#### FR7.1 Global Footer
- Add a `<footer>` component (`Footer.tsx`) rendered in `layout.tsx` below `<main>`, above bottom tab bar (or below on mobile via order)
- Content:
  - Left: Brand mini-logo or plain-text "© 2025 Indrayani Watch • MIT AOE ENTC Dept."
  - Center/Right: Disclaimer text:
    > "Readings shown are from low-cost calibrated IoT sensors deployed by student researchers. Values are **indicative** only and do not constitute regulatory-grade data suitable for enforcement. Official water quality determinations shall be based on certified laboratory analysis per NABL / CPCB protocols. For public health concerns, contact your local MPCB Regional Office or Municipal Water Supply Department."
  - (Bold the word "indicative" and callout the regulatory disclaimer)
- Sticky to bottom if content is short, else follows content
- Border-top `1px solid #1E2C42`, bg `#0B1220` (matches navbar header), padding 16-20px
- Text is `#8A9BB4` with the word "indicative" highlighted in `#EAB308` (amber) for emphasis

---

## Non-Functional Requirements (NFR)

### NFR1: Mobile Usability at 380px
- **rule**: At 380×844 viewport (iPhone SE / Android small), no horizontal scroll occurs on any page (dashboard, map, alerts, news, about, station detail). All interactive elements (buttons, tabs, markers) have ≥44×44px touch targets.

### NFR2: Zero Cumulative Layout Shift from Loading
- **rule**: In a simulated Slow 3G network (Chrome DevTools), the Core Web Vitals CLS metric from page navigation to fully-loaded state is ≤ 0.05 on every route. Measured via Chrome Lighthouse or manual layout inspection.

### NFR3: Performance — Interactive on Mid-Tier Mobile
- **rubric**: Lighthouse Performance score ≥ 85 on Moto G4 / Slow 4G simulation (CPU 4× slowdown). Weight: Time to Interactive (0.2), Total Blocking Time (0.25), CLS (0.2), LCP (0.2), SI (0.15). Pass threshold: 85/100.

### NFR4: Accessibility Audit
- **rule**: axe-core (or equivalent) automated accessibility scan reports zero "serious" or "critical" violations across all pages.
- **rubric**: Manual keyboard walkthrough: full navigation across dashboard → map → markers → alerts → news → about without mouse. Pass threshold: every interactive element reachable, every action triggerable via Enter/Space, focus order is logical and visible. Score 0–2 (2 = flawless, 1 = minor focus-order issues that don't block use, 0 = blocked flows).

### NFR5: prefers-reduced-motion Correctness
- **rule**: With OS-level Reduce Motion enabled (Windows: Settings → Ease of Access → Display; macOS: Settings → Accessibility → Display): no CSS keyframe animations persist (sonar, flow, pulse, toasts), no transitions exceed 150ms duration, no infinite loops of any kind run.

---

## Constraints

1. No changes to backend routes or Supabase schema
2. Existing dark-slate color palette tokens remain primary; only secondary adjustments allowed for contrast
3. MapLibre GL is the mapping library — no swapping to Leaflet or Google Maps
4. NewsCard image placeholder gradient must not introduce any new remote asset URLs (inline CSS gradients or data-URI only)
5. All new text content follows existing capitalisation / monospace-ID conventions (e.g., `S1` pill, 3-letter IDs)

## Dependencies

- Existing: `next`, `react`, `tailwindcss`, `zustand`, `recharts`, `maplibre-gl`, `lucide-react`
- No new npm dependencies permitted for this polish pass

## Assumptions

1. "Low-end device" for 30fps throttling = `hardwareConcurrency ≤ 4` cores OR `deviceMemory ≤ 4` GB (Firefox/Safari may not expose deviceMemory, so hardwareConcurrency is primary signal)
2. Station data for the About page can come from importing `STATIONS` from `@/lib/mockData` — the six stations defined there already match S1–S6 naming
3. Contrast ratios can be verified using `get-contrast` manual calculation or equivalent developer tooling — no automated CI integration required
4. The "retry action" on every empty/error state uses existing client-side capabilities (no new API endpoints); dashboard retry = re-run seed+poll; map retry = remount key change

## Open Questions

None at specification time — all requirements sourced directly from the Part 9 task brief.

---

## Acceptance Criteria (AC)

### AC1 — Mobile Responsiveness (rule)
- [ ] StationGrid is a horizontal snap-scroll carousel on viewports < 640px
- [ ] Each mobile station card shows a peek of the next card (not full-bleed)
- [ ] StationSidePanel renders as bottom sheet (rounded top corners, handle, backdrop, <1024px) instead of right slide-in
- [ ] Navbar links hide below 768px; bottom tab bar shows with 5 items including alert badge
- [ ] At 380px viewport width, zero horizontal overflow on every route (verified via `window.innerWidth` check + no scrollbar)
- [ ] All tap targets ≥ 44×44 px

### AC2 — Skeleton Loaders (rule)
- [ ] StationGrid skeleton matches StationCard exact pixel dimensions (height, padding, internal layout)
- [ ] Map skeleton matches h-[calc(100vh-64px)] with overlay + scrubber placeholders in exact positions
- [ ] ComparisonChart skeleton height = 340px; param/range filter bars match real widths
- [ ] StationSidePanel skeleton has 5-gauge grid with correct spans
- [ ] Alert list skeleton has 3 items with exact heights
- [ ] Under prefers-reduced-motion, all skeleton animate-pulse disabled (static state)
- [ ] No visible layout jump between skeleton → content (record Slow-3G DevTools)

### AC3 — Empty & Error States with Retry (rule)
- [ ] Dashboard has empty and error state cards both with actionable "Retry / Reconnect" buttons
- [ ] News error banner has inline "Retry fetch" button; News empty state includes "Refresh"
- [ ] Alerts page: zero-alerts state shows "Simulate Anomaly" button as fallback
- [ ] Station side-panel shows "Retry loading history" if history fetch fails
- [ ] Map shows "Retry map initialization" if MapLibre errors on load
- [ ] All retry buttons are keyboard focusable and aria-labelled

### AC4 — Accessibility (rule + rubric)
- [ ] Map markers are tabindex=0, focusable via Tab, Enter/Space opens panel, focus ring visible
- [ ] Map container has descriptive aria-label
- [ ] Persistent visually-hidden aria-live="polite" region in layout
- [ ] New critical alerts cause live-region text update "CRITICAL ALERT at Station X: ..."
- [ ] axe-core scan: zero serious/critical violations (verified manually with extension or similar)
- [ ] Status color contrast ratios all ≥ 4.5:1 on `#0B1220` (amber status: if `#EAB308` fails, bump to `#FDE047` and apply same change across all usages)
- [ ] prefers-reduced-motion: sonar, flow-line, pulse, KPI, toast-slide animations all disabled or set to < 150ms

### AC5 — Performance (rule)
- [ ] StationSidePanel chartData wrapped in useMemo(deps=[history24h])
- [ ] Low-end detection (hardwareConcurrency ≤4 or deviceMemory ≤4 or prefers-reduced-motion) → river-flow animation throttled to 30fps (every-2nd-frame or setTimeout 33ms)
- [ ] NewsCard img has decoding="async" + loading="lazy" + gradient placeholder background in the image container (no empty space before image load — CLS = 0 for the card)
- [ ] Lighthouse Performance ≥ 85 on mid-tier mobile (documented score)

### AC6 — About Page Content Completeness (rule)
- [ ] Problem Statement section: 2+ paragraphs, BIS limits callout, 4-stat stats strip
- [ ] Six-Station Study Area: 6 entries (S1, S4, S3, S2, S5, S6) each with ID pill, name, desc, coords, purpose
- [ ] Hardware section: 8 components (ESP32, pH, turbidity, EC-TDS, temperature, SD, RTC, Wi-Fi/LoRa) each with specs as specified
- [ ] System Architecture horizontal flow: 6 steps Sense→Calibrate→Log→Transmit→Analyse→Map with icon connectors
- [ ] Standards section: 4 cards BIS/CPCB/WHO/CCME-NSF with issuing body & key parameters
- [ ] Key Findings: 6 insight cards with values + station refs
- [ ] Team Credits: Prof. Vinayak Kulkarni guide card + 4 student cards (Snehal, Yashraj, Aryan, Shubham) with role descriptions
- [ ] All styled consistently with existing design (slate cards `#121C2E`, borders `#1E2C42`, cyan `#22D3EE` accents, monospace station IDs)

### AC7 — Footer Disclaimer (rule)
- [ ] Footer component created (Footer.tsx) and rendered on every page via layout.tsx
- [ ] Left side: Copyright + MIT AOE ENTC attribution
- [ ] Right / main area: Disclaimer with "indicative" highlighted amber, regulatory/MPCB mention in full
- [ ] Sits correctly on mobile above bottom tab bar; on desktop, follows main content
- [ ] No visual clipping on any viewport size
