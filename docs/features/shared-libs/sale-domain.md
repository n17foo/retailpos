# Sale Domain Rules

**Files:** `utils/sellability.ts`, `utils/categorySelection.ts`,
`utils/categoryFilter.ts`, `utils/hidBurst.ts`
**Tests:** all four have `*.test.ts` | **Docs:**
sales fast-path spec §4.3/§4.5.3 — retired into `docs/features/sale`
**Parent:** [`rules.md`](rules.md)

These are the pure rules the sale feature's hooks/components share. They are
documented here (not under the sale feature) because they are the lib layer;
the sale feature doc should reference them.

---

## S-R1 — Out-of-stock items are never sold

**Rule**
`isVariantSellable`: tracked inventory ⇒ `inventoryQuantity > 0`; untracked ⇒
`isAvailable` flag. `allowBackorder` is **deliberately ignored**.
`getAvailableQuantity` returns `undefined` when untracked (unbounded),
else `max(0, stock)`; `clampToAvailable` enforces it on quantity changes.

**Evidence** — `utils/sellability.ts` (decision D1 in spec); consumed by
`hooks/useAddToBasket`, basket quantity paths, `VariantPicker`.

🟢 **E1.1** — tracked variant with `inventoryQuantity 0` → not sellable,
not addable by any path (tile/scan/search/variant).

🟢 **E1.2** — untracked variant with `isAvailable` → sellable, no quantity cap
(`getAvailableQuantity` → `undefined`).

🔴 **E1.3** — platform reports `allowBackorder` → still not sellable
(overselling is impossible by design).

🟠 **E1.4** — negative `inventoryQuantity` → clamped to 0 via `Math.max`.

## S-R2 — Category selection is a 3-field state machine

**Rule**
`{rootId, subId, drillParentId}`: `null` root = "All Products" (D2).
`selectRoot(null)` resets; re-tapping the selected root un-selects (or drops
back to "All {root}" when a sub is selected). `selectSub` on a leaf narrows
the filter; on a parent it selects **and** drills row 2 into its children.
`goUp` first steps back to the drilled parent, then un-drills.
`effectiveCategoryId` = `subId ?? rootId`.

**Evidence** — `utils/categorySelection.ts`, `categorySelection.test.ts`;
consumed by `contexts/CategoryProvider.tsx` → `CategoryBar`.

🟢 **E2.1** — tap root "Drinks" → `rootId=drinks`, row 2 = children of drinks;
`effectiveCategoryId` = `drinks`.

🟢 **E2.2** — tap sub "Hot" (leaf) → `subId=hot`; re-tap → back to "All {drinks}".

🟠 **E2.3** — tap "‹ {parent}" with a leaf selected → selection steps to the
drilled parent first (row keeps children); tap again → un-drills. (Earlier bug:
it un-drilled immediately — fixed and covered by test.)

🟠 **E2.4** — `selectSub` on an unknown id returns the state unchanged.

## S-R3 — Category filtering prefers the service, falls back to subtree match

**Rule**
`buildCategoryFilter`: leaf category on a service-filtering platform
(Shopify/WooCommerce/BigCommerce/Magento/Commercefull/OFFLINE) ⇒
`serviceCategory` = `platformId` (name for OFFLINE). Non-leaf, or
Sylius/Wix/PrestaShop ⇒ client-side `matches(product)` over the whole subtree
by `categoryIds`, `productType`, or `tags` (name, lowercase-trimmed).

**Evidence** — `utils/categoryFilter.ts` (`SERVICE_FILTER_PLATFORMS`),
`categoryFilter.test.ts`; used by `hooks/useProductsForDisplay`.

🟢 **E3.1** — leaf on Shopify → service gets the category id, grid shows
service-filtered rows.

🟠 **E3.2** — category with children on Shopify → `serviceCategory` undefined,
client matches products whose `categoryIds` intersect the subtree OR whose
productType/tag text matches a subtree name — text matching can over- or
under-approximate platform data.

🟠 **E3.3** — Sylius/Wix/PrestaShop always client-filter.

## S-R4 — HID scanner bursts are swallowed before they pollute inputs

**Rule**
`HidBurstDetector.handleKey(key)`: keys within `scanIntervalMs` of the previous
are a burst (swallowed + buffered); `suffixChar` (Enter/Tab) closes a valid
`minBarcodeLength..maxBarcodeLength` buffer → `{swallow:true, barcode}` +
`onScan`. The **first** keystroke of a burst always passes through
(indistinguishable from typing); Enter is swallowed only for ≥2-char buffers.
A `scanIntervalMs*2` grace window after a completed scan swallows the next
burst's first chars.

**Evidence** — `utils/hidBurst.ts`, `hidBurst.test.ts`; consumers:
`USBScannerService`, `ElectronScannerService`, `HidCaptureField`.
Timing thresholds come from `posConfig.values` (e.g. `saleScanDedupMs`).

🟢 **E4.1** — `4`,`0`,`1`,`Enter` at 10ms gaps → chars 2..n swallowed,
`barcode='401'`; field receives nothing.

🔴 **E4.2 — Human typing** — "hello" at 300ms gaps → every key passes; Enter
not swallowed (buffer <2).

🟠 **E4.3 — First-char leak** — each scan's first char reaches the focused
input; `HidCaptureField`/inputs must drop buffered chars via `isBursting()`.
If a caller forgets, one char leaks — PG5.

🟠 **E4.4 — Human types right after a scan** — within the ~2×interval grace
window the first key is swallowed (documented trade-off for back-to-back scans).

## ❓ Questions

- **S-Q1** — `selectSub` re-tap logic depends on `drillParentId !== rootId` to
  decide the "All" target; is the intended re-tap of a leaf inside a drilled
  row to select the drill parent or null? Test covers the current behaviour —
  flagging for spec confirmation.
- **S-Q2** — `suffixChar` is a single key ('Enter' or 'Tab'); scanners emitting
  CR+LF (`'\r'` vs `'\n'`) — are both normalised by callers?

## Coverage

All four rules are covered by dedicated `*.test.ts` files (the strongest
coverage in `utils/`).
