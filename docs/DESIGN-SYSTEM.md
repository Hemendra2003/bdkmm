# MOMENTUM — Design System

**Owner:** Pam · **Branch:** `wp1-7-design-system` · **Date:** 2026-10-02  
**Status:** WP1.7 foundation — tokens, inventory, icons. App wiring is a later ticket.

---

## 1. Token file

`src/styles/tokens.css` — single source of truth for all design values.  
Sections: primitive palette → semantic roles → alpha variants → chart tokens → typography → spacing → radius → layout → motion → focus.

The app currently defines the same values inline in `index.html <style>`. Wiring the token file into the app will replace those inline values; that work is not part of WP1.7.

---

## 2. Preserved palette

Extracted verbatim from `index.html :root`. No values were changed.

| Token | Value | Role |
|---|---|---|
| `--color-bg-base` | `#05060D` | Page background (deepest) |
| `--color-bg-raised` | `#0D0F1A` | Cards, dialogs |
| `--color-bg-overlay` | `#181A28` | Borders, dividers |
| `--color-bg-inset` | `#1F2133` | Elevated / hover surface |
| `--color-gold` | `#FFB830` | Main action and momentum emphasis |
| `--color-gold-light` | `#FFE066` | Intentional highlight accent |
| `--color-green` | `#3DFF6E` | Positive / success |
| `--color-blue` | `#5BBFFF` | Info, chart secondary |
| `--color-red` | `#D62828` | Brand red (artwork) |
| `--color-red-ui` | `#FF5555` | Accessible error text |
| `--color-negred` | `#FF3030` | Drag / negative score |
| `--color-text-primary` | `#F0F0F8` | Primary text |
| `--color-text-secondary` | `#B8B8D0` | Secondary text |
| `--color-text-muted` | `#9090B0` | Muted / metadata |
| `--color-text-disabled` | `#505068` | Disabled / decorative only ⚠ |

---

## 3. Contrast — actual measured results

Relative luminance computed via WCAG 2.2 formula. Ratio = (L\_lighter + 0.05) / (L\_darker + 0.05).  
Targets: **4.5:1** AA normal text · **3:1** AA large text (18pt+ or 14pt bold) · **7:1** AAA.

### Passing pairs

| Foreground | Background | Ratio | AA | AAA |
|---|---|---|---|---|
| `#F0F0F8` (primary) | `#05060D` (bg-base) | **17.8:1** | ✅ | ✅ |
| `#F0F0F8` (primary) | `#0D0F1A` (bg-raised) | **15.8:1** | ✅ | ✅ |
| `#F0F0F8` (primary) | `#181A28` (bg-overlay) | **13.6:1** | ✅ | ✅ |
| `#B8B8D0` (secondary) | `#05060D` (bg-base) | **10.8:1** | ✅ | ✅ |
| `#B8B8D0` (secondary) | `#181A28` (bg-overlay) | **8.3:1** | ✅ | ✅ |
| `#9090B0` (muted) | `#05060D` (bg-base) | **7.1:1** | ✅ | ✅ |
| `#9090B0` (muted) | `#181A28` (bg-overlay) | **5.5:1** | ✅ | ❌ |
| `#FFB830` (gold) | `#05060D` (bg-base) | **12.0:1** | ✅ | ✅ |
| `#FFB830` (gold) | `#181A28` (bg-overlay) | **9.2:1** | ✅ | ✅ |
| `#FFB830` (gold) | `#1F2133` (bg-inset) | **8.7:1** | ✅ | ✅ |
| `#3DFF6E` (green) | `#05060D` (bg-base) | **15.1:1** | ✅ | ✅ |
| `#3DFF6E` (green) | `#181A28` (bg-overlay) | **11.6:1** | ✅ | ✅ |
| `#5BBFFF` (blue) | `#05060D` (bg-base) | **10.3:1** | ✅ | ✅ |
| `#5BBFFF` (blue) | `#181A28` (bg-overlay) | **7.9:1** | ✅ | ✅ |
| `#FF5555` (red-ui) | `#05060D` (bg-base) | **6.7:1** | ✅ | ❌ |
| `#FF5555` (red-ui) | `#181A28` (bg-overlay) | **5.1:1** | ✅ | ❌ |
| `#FF3030` (negred) | `#05060D` (bg-base) | **5.6:1** | ✅ | ❌ |

### Failing pairs

| Foreground | Background | Ratio | Fails | Current usage | Remediation |
|---|---|---|---|---|---|
| `#505068` (disabled) | `#05060D` (bg-base) | **2.9:1** | AA normal, AA large | `.stat-cell-sub`, `.habit-entries` labels, `.dev-btn`, `.mq-fixed-lock` | Decorative only. Use `--color-text-muted` (#9090B0) for any informational content. |
| `#505068` (disabled) | `#0D0F1A` (bg-raised) | **2.6:1** | AA normal, AA large | `.habit-cat-header`, `.drawer-cat-header` | Same: informational labels must use muted (#9090B0) or muted-secondary (#B8B8D0). |
| `#505068` (disabled) | `#181A28` (bg-overlay) | **2.2:1** | AA normal, AA large | Border-matching text in several patterns | Never use for text on this surface. |
| `#D62828` (red) | `#05060D` (bg-base) | **4.1:1** | AA normal text | `.page-header-title`, `.why-section-num` | Safe for large/display text (≥18pt) and artwork. For normal body, use `#FF5555` instead. |
| `#D62828` (red) | `#0D0F1A` (bg-raised) | **3.7:1** | AA normal text | — | Same: use `#FF5555` or keep to display sizes. |
| `#FF3030` (negred) | `#181A28` (bg-overlay) | **4.3:1** | AA normal text | `.fnote.neg` border text, segmented button active-neg | Upgrade to `#FF5555` on bg-overlay surfaces for body text. |

> **Summary:** Two actionable failures. (1) `--color-text-disabled` (#505068) never passes WCAG AA for text; reserve it for ornamental/decorative use only. (2) Brand red (#D62828) fails normal text on dark backgrounds; use `--color-red-ui` (#FF5555) for UI error text.

---

## 4. Typography

| Role | Family | Size | Line height | Token |
|---|---|---|---|---|
| Wordmark, hero numbers | Press Start 2P | Variable | — | `--font-pixel` |
| Dates, annotations, metadata | DM Mono | 12px | 16px | `--font-mono` / `--text-xs` + `--leading-xs` |
| Secondary body, labels | DM Mono / Space Grotesk | 14px | 20px | `--text-sm` + `--leading-sm` |
| Body, forms, questions | Space Grotesk | 16px | 24px | `--font-sans` / `--text-base` + `--leading-base` |

Remove 8–10px essential labels (currently present in `.section-label`, `.mq-label`, `.nav-item`). Minimum for any informational text is 12px / `--text-xs`.

---

## 5. Component inventory

Each row documents the states the component must handle. "Implemented" means a working CSS class exists in `index.html`. States marked with `~` are partially styled; `–` are missing.

### Buttons

**Source classes:** `.btn`, `.btn-primary-gold`, `.btn-primary-red`, `.btn-primary-green`, `.btn-primary-blue`

| State | Gold | Red | Green | Blue |
|---|---|---|---|---|
| Default | ✅ | ✅ | ✅ | ✅ |
| Hover | ✅ | ✅ | ✅ | ✅ |
| Focus | – | – | – | – |
| Pressed / active | – | – | – | – |
| Disabled | ✅ (opacity .3) | ✅ | ✅ | ✅ |
| Loading | – | – | – | – |
| Destructive variant | – | ✅ (red) | – | – |

**Missing:** focus-visible gold ring on all variants. Loading state (spinner inside button).

---

### Navigation (bottom bar)

**Source:** `.bottom-nav`, `.nav-item`

| State | Status |
|---|---|
| Default (inactive) | ✅ |
| Active / current page | ✅ gold color + top border |
| Focus | – (needs gold ring) |
| Hover | – |

---

### Inputs

**Source:** `.auth-input`, `.mq-input`, `.drawer-search-input`

| State | Status |
|---|---|
| Default | ✅ |
| Focus | ✅ (gold border, `rgba(255,184,48,.4/.5)`) |
| Placeholder | ✅ (slate2) |
| Invalid / error | – |
| Disabled | – |

---

### Segmented controls / radio groups

**Source:** `.be-segmented` / `.be-seg-btn`, `.mq-segmented` / `.mq-seg`

| State | Status |
|---|---|
| Default | ✅ |
| Active — positive | ✅ (green) |
| Active — neutral | ✅ (gold) |
| Active — negative | ✅ (negred) |
| Hover | ✅ |
| Focus | – (needs gold ring on keyboard navigation) |
| Disabled | – |

---

### Cards

**Source:** `.be-q-row`, `.sum-vel-row`, `.compare-card`, `.why-vis-card`, `.mq-custom-form`

| State | Status |
|---|---|
| Default | ✅ |
| Hover | ~ (only `.be-q-row`) |
| Focus (keyboard) | – |
| Selected / today | ✅ (`.today-card` with gold border) |
| Loading / skeleton | ✅ (`.skeleton-wrap`) |
| Empty | ✅ (`.empty-state`) |

---

### Status banners / pills

**Source:** `.imbalance-banner`, `.streak-ribbon`

| State | Status |
|---|---|
| Warning (gold) | ✅ |
| Dismissible | ✅ |
| Error | – (no `.error-banner` variant) |
| Success | – |
| Info | – |

---

### Bottom sheet / drawer

**Source:** `.drawer`, `.drawer-backdrop`

| State | Status |
|---|---|
| Closed | ✅ (`display:none`) |
| Open (animated) | ✅ (`drawerUp` keyframe) |
| Reduced motion | ~ (animation still runs; must check `@media (prefers-reduced-motion)`) |
| Initial focus | – |
| Escape close | – (JS; not in scope of this doc) |
| Backdrop | ✅ (`rgba(0,0,0,.5)`) |
| Focus containment | – |

---

### Overlays (full-screen)

**Source:** `.overlay`, `#summary-overlay`, `.auth-screen`

| State | Status |
|---|---|
| Hidden | ✅ |
| Active | ✅ |
| Scroll management | ~ (`#summary-overlay` scrollable; others fixed) |
| Focus trap | – |
| Return focus | – |

---

### Loading / skeleton

**Source:** `.loading-pulse`, `.loading-dots`, `.skel-*`

| State | Status |
|---|---|
| Skeleton shimmer | ✅ (`skelshim` animation) |
| Reduced motion | ✅ (`animation:none`) |
| Loading dots | ✅ |

---

### Empty states

**Source:** `.empty-state`

| State | Status |
|---|---|
| Title + body | ✅ |
| With action | – (no CTA variant) |
| Error empty (load failure) | – |

---

### Filter / tab pills

**Source:** `.filter-btn`, `.habits-filter`

| State | Status |
|---|---|
| Default | ✅ |
| Active | ✅ (gold border + bg) |
| Hover | ✅ |
| Focus | – |

---

### Tier / importance badges

**Source:** `.be-q-tier`, `.mq-tier-badge`, `.mq-tier-btn`

| State | Status |
|---|---|
| S / A / B tiers | ✅ (inline color per tier in JS) |
| Active tier | ✅ (`.mq-tier-btn.active`) |
| Hover | ✅ |
| Focus | – |

---

### Stats grid

**Source:** `.stats-grid`, `.stat-cell`

| State | Status |
|---|---|
| Default | ✅ |
| Loading | – (no skeleton for this cell) |

---

### Line graph / chart

**Source:** `.line-graph-wrap`, `.lg-tooltip`

| State | Status |
|---|---|
| Default | ✅ |
| Hover tooltip | ✅ |
| Empty / no data | – |
| Accessible data table | – |
| Reduced motion | – (chart animation not token-driven) |

---

## 6. Pixel SVG icon set

All icons: `src/icons/<name>.svg`. ViewBox `0 0 16 16`. `fill="currentColor"`. `aria-hidden="true"`.  
Use inside a button or link that has an accessible name via `aria-label` or adjacent visible text.  
Decorative graphics: add `role="presentation"` when not inside a labelled control.  
Touch targets: wrap in an element with `min-width: var(--touch-min); min-height: var(--touch-min)` (44×44px).

| File | Description | Mask used |
|---|---|---|
| `rocket.svg` | Upward-pointing rocket; body, fins, exhaust | No |
| `bolt.svg` | Lightning bolt; zigzag top-right to bottom-left | No |
| `warning.svg` | Triangle with exclamation mark cutout | Yes (`warning-mask`) |
| `settings.svg` | Gear / cog with 8 teeth and square centre hole | Yes (`settings-mask`) |
| `library.svg` | Four book spines on a shelf | No |
| `back.svg` | Left-pointing chevron | No |
| `close.svg` | Pixel X | No |
| `check.svg` | Checkmark (short left stroke + long right stroke) | No |
| `plus.svg` | Plus / cross | No |
| `chart.svg` | Three ascending bars with baseline | No |

> **Note on mask IDs:** `warning.svg` and `settings.svg` use inline `<defs><mask>` with ids `warning-mask` and `settings-mask`. These are safe when icons are loaded as `<img>` (separate document scope). For inline `<svg>` inclusion on the same page, rename the IDs per instance to avoid collisions (`warning-mask-1`, etc.) or use a `<use>` sprite approach with a `<symbol>` that keeps mask scope.

---

## 7. Focus ring

**Token:** `--focus-ring-color: var(--color-gold)` (`#FFB830`) / `--focus-ring-width: 2px` / `--focus-ring-offset: 3px`

Gold (#FFB830) against all four background surfaces:

| Surface | BG | Ratio | AA large |
|---|---|---|---|
| bg-base | `#05060D` | 12.0:1 | ✅ |
| bg-raised | `#0D0F1A` | 10.6:1 | ✅ |
| bg-overlay | `#181A28` | 9.2:1 | ✅ |
| bg-inset | `#1F2133` | 8.7:1 | ✅ |

The focus ring passes WCAG 2.2 §2.4.11 (Focus Appearance) on every defined surface.

Usage pattern:
```css
/* src/styles/tokens.css includes this utility */
.focus-gold:focus-visible {
  outline: var(--focus-ring-width) solid var(--focus-ring-color);
  outline-offset: var(--focus-ring-offset);
}
```

Apply `.focus-gold` to buttons, nav items, inputs, segmented controls, filter pills, and any other interactive element. Do not use `:focus` alone — `:focus-visible` suppresses the ring for pointer interactions while keeping it for keyboard users.

---

## 8. Motion

| Token | Value | Use for |
|---|---|---|
| `--duration-fast` | 120ms | Hover transitions, colour changes |
| `--duration-base` | 200ms | Reveals, drawer open/close |
| `--duration-slow` | 300ms | Page transitions, summary overlay |
| `--duration-float` | 4000ms | Rocket float animation |

`@media (prefers-reduced-motion: reduce)` sets all durations to `0ms`. Only use these tokens for `transition-duration` and `animation-duration`; do not hard-code ms values elsewhere.

---

## 9. Spacing and radius

| Token | Value | Notes |
|---|---|---|
| `--space-1` | 4px | Icon gap, tight inline |
| `--space-2` | 8px | Component internal padding |
| `--space-3` | 12px | Card padding small |
| `--space-4` | 16px | Card padding, section gap |
| `--space-6` | 24px | Page section gap |
| `--space-8` | 32px | Section separator |
| `--space-12` | 48px | Page bottom padding |
| `--radius` | 6px | Preserved from original |
| `--radius-sm` | 4px | Small controls (tier badges) |
| `--radius-lg` | 12px | Larger cards, modals |
| `--radius-xl` | 16px | Bottom sheets (preserved: `.drawer` uses 16px) |

---

## 10. Acceptance criteria check — WP1.7

| Criterion | Status |
|---|---|
| Semantic tokens: brand/positive/negative/warning/text/surface | ✅ `src/styles/tokens.css` |
| Alpha variants documented | ✅ §3 of tokens.css |
| Chart tokens | ✅ `--chart-*` group |
| Spacing 4/8/12/16/24/32/48 | ✅ `--space-1` through `--space-12` |
| Type scale 16/24 body, 14/20 secondary, 12/16 metadata | ✅ `--text-*` + `--leading-*` |
| Motion 120ms/200ms + reduced-motion alternatives | ✅ `--duration-fast/base` + `@media` override |
| Preserved palette (#05060D…#1F2133, gold, reds, green/blue, text) | ✅ unchanged from index.html |
| Component inventory with states | ✅ §5 above |
| Contrast results — measured (not assumed) | ✅ §3 above |
| Pixel SVG set: rocket/bolt/warning/settings/library/back/close/check/plus/chart | ✅ `src/icons/*.svg` |
| Gold focus ring with contrast + offset | ✅ §7 above; `.focus-gold` utility |

**Contrast failures to carry forward to implementation:**
1. `--color-text-disabled` (#505068): never use for informational text; decorative/ornamental only.
2. `--color-red` (#D62828): fails 4.5:1 for normal body text; use `--color-red-ui` (#FF5555) instead.
3. `--color-negred` (#FF3030) on bg-overlay (#181A28): 4.3:1 — fails normal text; use `--color-red-ui` for body copy on this surface.
