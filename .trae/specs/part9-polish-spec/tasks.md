# Part 9 — Implementation Task Queue

Derived from `spec.md` acceptance criteria AC1–AC7.

## Task 1: Mobile Bottom Tab Bar + Footer Layout Integration (FR1.3, FR7)

**Priority: high**

Scope:
- Create new `components/Footer.tsx` with copyright + disclaimer text
- Refactor `Navbar.tsx`: hide desktop nav links < 768px, remove existing in-header mobile nav sub-row
- Add bottom tab bar (`BottomTabBar.tsx`) that:
  - Renders on < 768px only
  - Contains 5 items (Dashboard, Map, Alerts, News, About) + Alerts badge
  - Fixed to bottom, 64px height, cyan active indicator
- Update `layout.tsx` to import and render: `<Navbar />`, `<main />`, `<Footer />`, bottom tab bar at correct DOM order (z-index)
- Add `pb-16 md:pb-0` padding to main content on mobile (accommodates bottom tab bar)

Files touched:
- `frontend/app/layout.tsx`
- `frontend/components/Navbar.tsx` (modify — remove existing mobile sub-row)
- `frontend/components/Footer.tsx` (new)
- `frontend/components/BottomTabBar.tsx` (new)
- `frontend/app/globals.css` (any needed tweaks)

Dependencies: none (root-level changes)

Test Requirements (TR):
- **rule (AC1)**: At 380px viewport, Desktop nav links are `display:none`, BottomTabBar visible with 5 items, active route has cyan accent.
- **rule (AC7)**: Footer visible on all routes with copyright text, "indicative" highlighted amber, MPCB mention included. Footer sits ABOVE bottom tab bar on mobile, BELOW main content on desktop.
- **rule (AC7)**: On 768px+ viewports, bottom tab bar has `display:none` and desktop nav links visible.

---

## Task 2: Mobile Station Grid → Horizontal Snap-Scroll Carousel (FR1.1)

**Priority: high**

Scope:
- Modify `components/dashboard/StationGrid.tsx`:
  - Add responsive breakpoint logic: < 640px → horizontal scroll container; ≥ 640px → existing grid
  - Mobile: `flex overflow-x-auto snap-x snap-mandatory gap-4 pb-4 -mx-4 px-4` (full-bleed horizontal scroll container)
  - Each `StationCard` on mobile: `snap-start shrink-0 w-[85vw] max-w-[320px]`
  - Left/right gradient fade overlays (optional visual hint)
  - Hide scrollbars: `scrollbar-hide` utility or `-webkit-scrollbar { display: none }`

Files touched:
- `frontend/components/dashboard/StationGrid.tsx`
- `frontend/app/globals.css` (scrollbar-hide utility if not already present)

Dependencies: none

TR:
- **rule (AC1)**: At < 640px: StationGrid is horizontal flex with snap. Each card snap-aligns. Cards are ~85% vw (peek preview of next card on right).
- **rule (AC1)**: At ≥ 640px: existing 2-col/3-col grid unchanged.

---

## Task 3: Map StationSidePanel → Mobile Bottom Sheet (FR1.2)

**Priority: high**

Scope:
- Modify `components/map/StationSidePanel.tsx`:
  - Add breakpoint detection (use `useEffect` + `window.matchMedia` or tailwind `lg:` classes via CSS)
  - < 1024px: render as bottom sheet:
    - `fixed bottom-0 inset-x-0 max-h-[85vh] rounded-t-2xl border-l-0 border-t`
    - Handle bar pill (`h-1 w-9 rounded-full bg-[#1E2C42] mx-auto my-3`)
    - Slide up animation (`translate-y-full → translate-y-0`)
  - ≥ 1024px: existing right-side slide-in unchanged
  - Backdrop overlay shows on both mobile + mobile-size panels, lg hides it

Files touched:
- `frontend/components/map/StationSidePanel.tsx`

Dependencies: none

TR:
- **rule (AC1)**: At < 1024px, panel slides up from bottom, rounded top corners, handle bar visible, backdrop blurs.
- **rule (AC1)**: At ≥ 1024px, right-side panel behaviour unchanged.
- **rubric (AC1)**: Bottom sheet UX at 380px — 0/1/2: (2 = no clipped content, scrollable, dismiss via backdrop or X; 1 = minor clipping; 0 = unusable). Threshold ≥ 1.

---

## Task 4: Skeleton Loading Screens (FR2)

**Priority: high**

Scope:
- Create skeleton sub-component file or inline skeletons:
  1. **StationGrid/StationCard skeleton**: Match exact dimensions (border-radius, 3px left-border strip, 4 KPIs in 2x2, sparkline area)
  2. **Map skeleton** — replace current spinner with layout-matched skeleton (map container bg + overlay pills + time scrubber bar skeleton height)
  3. **ComparisonChart skeleton**: 340px, header + param/range bars + 6 line traces
  4. **StationSidePanel skeleton**: Header + WQI banner + 5 gauge grid (2 col + span-2) + 120px mini-chart
  5. **Alert list skeleton** (alerts page): 3 alert row placeholders

Files touched:
- `frontend/components/dashboard/StationGrid.tsx` (add skeleton prop or inline conditional)
- `frontend/components/dashboard/StationCard.tsx` (create internal skeleton variant)
- `frontend/app/map/page.tsx` (update dynamic import loading component)
- `frontend/components/dashboard/ComparisonChart.tsx` (add skeleton render)
- `frontend/components/map/StationSidePanel.tsx` (add skeleton when station/loading)
- `frontend/app/alerts/page.tsx` (add loading skeleton for initial alerts fetch)

Dependencies: none (skeletons render during loading states that exist)

TR:
- **rule (AC2)**: Each skeleton height exactly matches real content height (no jump when content loads). Verified via Chrome DevTools Slow 3G simulation on all 5 components.
- **rule (AC2)**: Under `prefers-reduced-motion: reduce`, skeleton `animate-pulse` is disabled.
- **rule (NFR2)**: On Slow 3G, no visible content shift visible between skeleton → real render on dashboard route (manually verified, or CLS ≤ 0.05 recorded via Lighthouse).

---

## Task 5: Empty & Error States with Retry Actions (FR3)

**Priority: high**

Scope:
- **Dashboard page (`page.tsx`)**:
  - Empty state when `readings` is empty (after X seconds) → panel with retry button that re-seeds + re-polls
  - Error state banner if stream status = disconnected for >10s → "Reconnect" button calls `apiClient.connectStream()` + re-poll
- **News page (`news/page.tsx`)**:
  - Error banner add inline "Retry fetch" button (right side)
  - Empty state (no articles) add "Refresh" button
- **Alerts page (`alerts/page.tsx`)**:
  - Add error banner at top if `apiClient.getAlerts()` fails; "Retry load" button
  - If total alerts = 0 (not just filtered), show "Simulate Anomaly" button in the empty state
- **Station side panel (`StationSidePanel.tsx`)**:
  - "Station offline" block when reading is null/undefined + show if history failed to load a retry button
- **Map page (`map/page.tsx` / `RiverMap.tsx`)**:
  - Add error boundary or MapLibre error state → "Retry map" button that remounts RiverMap via key change

Files touched:
- `frontend/app/page.tsx`
- `frontend/app/news/page.tsx`
- `frontend/app/alerts/page.tsx`
- `frontend/components/map/StationSidePanel.tsx`
- `frontend/app/map/page.tsx` (error state + remount key logic)
- `frontend/components/map/RiverMap.tsx` (error detection callback)

Dependencies: none

TR:
- **rule (AC3)**: All 5 data components have both empty AND error state UI with a labeled, focusable retry button.
- **rule (AC3)**: Simulate network failure (DevTools offline mode) on News, Alerts, Dashboard → error state appears, retry button → reconnects.
- **rule (AC3)**: Each retry button has `aria-label` describing what it retries (e.g., aria-label="Retry fetching news articles").

---

## Task 6: Accessibility (FR4) — Markers, ARIA Live, Contrast, Reduced Motion

**Priority: high**

Scope:
- **Keyboard-navigable markers (`RiverMap.tsx`)**:
  - Marker element set `tabindex="0"`, add keydown listener for Enter/Space → opens side panel
  - Add `:focus` style with 2px cyan outline + 2px offset
  - Map container aria-label set
- **ARIA Live region (`AlertToast.tsx` or layout.tsx)**:
  - Create visually-hidden `role="status" aria-live="polite"` region in layout
  - On critical alert added → update live region text: "CRITICAL ALERT at Station X: message"
- **Contrast verification**:
  - Check `#EAB308` on `#0B1220`: ~3.15:1 (FAILS 4.5:1 for body text)
  - If failing, bump status-moderate to `#FDE047` across all usages (types, tailwind config, components, hard-coded strings)
  - Verify all other status colors, badges pass 4.5:1
  - Fix any badge-background / text pairs that fail (e.g. amber badge on light amber bg)
- **Full prefers-reduced-motion support**:
  - In globals.css `@media (prefers-reduced-motion: reduce)` block, extend:
    - Disable `sonarRipple` keyframes → `animation: none !important`
    - Disable river flow animation (markers / flow-line JS can also check via `window.matchMedia`)
    - In `RiverMap.tsx` animation loop, short-circuit & set static dash if reduced-motion = true
    - Disable toast slide-in → no transform translation
    - Disable station card pulse (`animate-pulse-cyan`)
    - Set all CSS transitions to 0.01ms

Files touched:
- `frontend/components/map/RiverMap.tsx` (markers keyboard + reduced motion short-circuit)
- `frontend/app/layout.tsx` (add live region)
- `frontend/components/alerts/AlertToast.tsx` (write to live region via zustand or event)
- `frontend/tailwind.config.ts` (color adjustment if amber contrast fails)
- `frontend/app/globals.css` (extended prefers-reduced-motion block)
- All components using `#EAB308` status-moderate color → grep and replace

Dependencies: none

TR:
- **rule (AC4)**: Tab through map → focus moves to each marker sequentially, Enter/Space opens panel, focus ring visible.
- **rule (AC4)**: Live region element exists in DOM (visually hidden). On Simulate Anomaly (critical), live region textContent updated within 500ms. Assisted by console/inspector verification.
- **rule (AC4)**: `#FDE047` or replacement for status-moderate yields ≥ 4.5:1 contrast against `#0B1220` (use WebAIM contrast checker or manual). No body-text pairs fail 4.5:1 anywhere.
- **rule (NFR5)**: OS reduce-motion ON + page reload → zero CSS keyframes run. Verified in DevTools: no `sonarRipple`, no `animate-pulse`, no flow dash animation visible.
- **rubric (NFR4)**: Full keyboard walkthrough (Dashboard → Map → markers → Alerts → News → About): 0/1/2 (threshold ≥ 1).

---

## Task 7: Performance Optimizations (FR5) — Memoisation, 30fps Throttle, Lazy Images

**Priority: medium**

Scope:
- **Memoisation**:
  - `StationSidePanel.tsx`: wrap `chartData` calculation in `React.useMemo(() => ..., [history24h])`
  - StationCard sparkline SVG path: if recomputed on render, wrap in `useMemo`
- **30fps low-end throttling (`RiverMap.tsx`)**:
  - Create module-level or hook-level `isLowEndDevice` flag once:
    ```ts
    const isLowEnd = (typeof navigator !== 'undefined' && (
      (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) ||
      (navigator.deviceMemory && navigator.deviceMemory <= 4) ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ));
    ```
  - In `animateDash` function: if `isLowEnd`, either use `setTimeout(..., 33)` instead of `requestAnimationFrame`, OR only update on every 2nd rAF call (run counter, only call setPaintProperty when counter % 2 === 0)
- **News image lazy load improvements (`NewsCard.tsx`)**:
  - Ensure `decoding="async"` is set on the `<img>`
  - Add gradient placeholder bg to image container (`bg-gradient-to-br from-[#121C2E] to-[#1E2C42]`) so the area has color before image paint
  - Container has `aspect-ratio: 16/9` (already h-44, but formalize)

Files touched:
- `frontend/components/map/StationSidePanel.tsx` (useMemo chartData)
- `frontend/components/dashboard/StationCard.tsx` (useMemo sparkline if needed)
- `frontend/components/map/RiverMap.tsx` (30fps throttle)
- `frontend/components/news/NewsCard.tsx` (decoding + placeholder)

Dependencies: none

TR:
- **rule (AC5)**: StationSidePanel chartData has useMemo wrapper (code inspection).
- **rule (AC5)**: NewsCard img has both `loading="lazy"` and `decoding="async"`. Image container has gradient background (not transparent).
- **rule (AC5)**: In RiverMap, `isLowEnd` detection variable exists; animateDash throttles updates to 30fps when true.
- **rubric (NFR3)**: Lighthouse Performance score ≥ 85 on Moto G4 / Slow 4G / 4× CPU slowdown. Record actual score as evidence.

---

## Task 8: /about Page Complete Build (FR6)

**Priority: medium**

Scope:
- Replace placeholder content in `app/about/page.tsx` with full layout matching spec FR6.1–FR6.7:
  1. **Problem Statement**: 2-3 paras narrative, BIS callout, stats strip (42.8 km / 6 stations / 5 params / 3s)
  2. **Six-Station Study Area**: Import STATIONS from `@/lib/mockData`, render 6 cards with ID pill, name, desc, coord, purpose tag
  3. **Hardware**: 8 components (ESP32, pH, turbidity, EC-TDS, temp, SD, RTC, Wi-Fi/LoRa) — cards with specs
  4. **Architecture Flow Diagram**: 6 horizontal steps (Sense, Calibrate, Log, Transmit, Analyse, Map) with chevron arrows
  5. **Standards**: 4 cards (BIS IS 10500:2012, CPCB, WHO, CCME/NSF) — issuing bodies + key params
  6. **Key Findings**: 6 insight cards (S4 spikes, S5 TDS, S2 pilgrimage, S1 reference, S6 recovery, Seasonal)
  7. **Team Credits**: Prof. Vinayak Kulkarni (Guide, prominent card) + 4 students (Snehal, Yashraj, Aryan, Shubham) with role descriptions, ENTC Dept MIT AOE attribution

- All content follows existing style: `#121C2E` cards, `#1E2C42` borders, `#22D3EE` accents, monospace station IDs, matching section header patterns (`uppercase tracking-wider` section subtitles)
- Mobile-responsive (stacks vertically on < 640px), tested at 380px

Files touched:
- `frontend/app/about/page.tsx` (full rewrite)
- Potentially no new components needed; keep components inline or extract if > 500 lines (prefer inline or internal section components within same file)

Dependencies: none

TR:
- **rule (AC6)**: All 7 sections rendered (Problem, Stations, Hardware, Architecture, Standards, Key Findings, Team).
- **rule (AC6)**: All specific data present — station IDs S1/S4/S3/S2/S5/S6, hardware list 8 components, 6 architecture steps with labels, 4 standards, 6 key findings with station refs, 5 team members (prof + 4 students with correct names + roles).
- **rubric (AC1)**: Mobile 380px UX — 0/1/2 (threshold ≥ 1). No horizontal overflow; all sections readable.

---

## Task 9: Final Integration & Verification Pass

**Priority: medium**

Scope:
- Run the frontend dev server (`cd frontend && npm run dev`)
- Verify all AC1–AC7 checklist items interactively:
  - 380px viewport: bottom tab bar, horizontal station carousel, map bottom sheet, no overflow
  - Slow-3G: skeletons render, no layout shift
  - DevTools offline mode: empty/error + retry buttons work
  - DevTools simulate low-end device (hardwareConcurrency spoof if possible): 30fps throttle active
  - OS reduced-motion simulation: verify all animations disabled
  - Contrast check: all text pairs pass 4.5:1
  - Keyboard full walkthrough: tab to map markers, focus ring, live region text on critical alert
  - Lighthouse performance: run and record scores
  - Full axe-core (or equivalent) accessibility scan: zero serious/critical violations
- Create a `part9-evidence.md` (stored alongside implementation notes if needed, or evidence in task completion summary) with:
  - Screenshot descriptions or notes for each verified AC
  - Recorded Lighthouse score
  - a11y scan pass/fail
  - Contrast ratio calculations for status colors

Files touched:
- None (verification only) unless bugs found, in which case return to relevant task

Dependencies: All prior tasks (1–8) completed.

TR:
- **rule (all ACs)**: All AC items AC1–AC7 pass in verification. Any failing items create remediation tasks.
- **rubric (NFR4 workflow fidelity)**: 0/1/2 full workflow fidelity (spec → tasks → approve → implement → review followed correctly). Threshold ≥ 1.
