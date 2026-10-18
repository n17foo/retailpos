# Theme & Layout

**Files:** `shared/utils/theme.ts`, `shared/utils/themes.ts`, `shared/utils/responsive.utils.ts`
**Tests:** `shared/utils/responsive.utils.test.ts` (theme files have none)
**Parent:** [`rules.md`](rules.md)

---

## T-R1 — All visual constants are tokens in `theme.ts`

**Rule**
Colours, spacing, typography, border-radius, elevation, and hit-target sizes
are exported tokens; component code must not hardcode them (AGENT.md rule 4).

**Evidence** — `shared/utils/theme.ts` (~97 importers); `hitTarget = {touchMin:48,
touchTender:56, pointerMin:40, pointerTender:44}` (spec §4.8.3).

🟢 **E1.1** — Tender buttons size from `hitTarget.touchTender`/`pointerTender`
per input mode.

🔴 **E1.2** — `features/checkout/utils/orderStateMapper.ts` itself hardcodes hex colours —
see C3 / O-R2 ([order-domain.md](order-domain.md)).

## T-R2 — `interactionStyle` renders pressed/focus/hover without layout shift

**Rule**
`Pressable` style callbacks get `interactionStyle(state)`: pressed → `opacity
0.85`; focused → 2px outline ring; hovered → 1px outline ring. `outline*` is
used so rings never reflow layout. `hovered`/`focused` exist at runtime only on
web/Electron (the cast is contained in theme.ts).

**Evidence** — `shared/utils/theme.ts:249`.

🟢 **E2.1 — Electron hover** — a `Pressable` under the mouse gets a 1px
`focusRing` outline.

🟠 **E2.2 — Native no-op** — on iOS/Android `hovered`/`focused` never occur;
only `pressed` applies. Documented limitation, not a gap.

## T-R3 — Theme presets replace the palette only for `useTheme().colors` consumers

**Rule**
`shared/utils/themes.ts` defines 8 presets (`default|dark|ocean|forest|sunset|slate|
rose|amber`); `defaultColors` _is_ `lightColors` (no duplication); presets
spread-override it. `ThemeColors = typeof lightColors` so missing keys fail
typecheck.

**Evidence** — `shared/utils/themes.ts` header + preset construction;
`shared/contexts/ThemeProvider.tsx`, `features/settings/screens/ThemeSettingsTab.tsx` are the
only consumers.

🟠 **E3.1 — Partial recolour**
Given the `dark` preset is selected
When a screen imports `lightColors` directly (~92 files do)
Then it keeps the light palette — only `useTheme().colors` consumers switch.
Observed behaviour; the header comment's claim is aspirational. PG3/C4.

## T-R4 — `getSaleLayout` derives the sale shell from window size only

**Rule**
Layout class is decided by width _and_ height — never by device model:

| class           | condition                | shell   | basket         |
| --------------- | ------------------------ | ------- | -------------- |
| phone           | w<600, or w<768 portrait | stacked | bottom sheet   |
| phone-landscape | h<500 and w≥568          | split   | max(280, 38%w) |
| tablet          | 768≤w<1024 (h≥500)       | split   | 300            |
| desktop         | 1024≤w<1440              | split   | 340            |
| wide            | w≥1440                   | split   | 420            |

**Evidence** — `shared/utils/responsive.utils.ts` (`SHORT_HEIGHT=500`,
`SHORT_MIN_WIDTH=568`, `PHONE_MAX_WIDTH=600`), spec §4.8, tests.

🟢 **E4.1** — `getSaleLayout(390,844)` → `phone`/stacked, 2 tile columns.

📱 **E4.2 — Rotation** — 844×390 (h<500, w≥568) → `phone-landscape`/split —
re-evaluated on every dimension change.

🟠 **E4.3 — 600–767px landscape** — too wide for `phone`, below `tablet` →
falls to `tablet` (split shell on a narrow window). Deliberate; tested.

🟠 **E4.4 — `getProductColumns`** — legacy helper for non-sale grids
(2/3/4/5 columns at 0/768/1024/1440) — _not_ what the sale grid uses
(`productColumns(density)`).

## ❓ Questions

- **T-Q1** — `themes.ts` exports `darkHoverTokens` separately from preset
  colors; is any consumer expected to use it? Grep found none among `shared/utils/`
  consumers (worth verifying before use).

## Coverage

| Example                        | Coverage                   |
| ------------------------------ | -------------------------- |
| T-R4 layout classes/boundaries | `responsive.utils.test.ts` |
| T-R1–R3                        | Not found                  |
