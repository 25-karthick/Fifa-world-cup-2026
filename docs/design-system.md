# StadiumPulse AI - Design System

This document describes the design system and accessibility tokens established for StadiumPulse AI (metLife Stadium, FIFA World Cup 2026).

---

## 🎨 Color Tokens (Tailwind System)

We use a premium, high-trust dark operations theme. Deep backgrounds minimize operator eye fatigue during matches, and status colors have strict visual contrast pairings.

| Token                  | Use Case                         | Tailwind Equivalent                   | Hex Value             | Contrast Ratio |
| :--------------------- | :------------------------------- | :------------------------------------ | :-------------------- | :------------- |
| **Canvas Background**  | Outer page backgrounds           | `bg-slate-950`                        | `#0b0f19`             | N/A            |
| **Surface Background** | Card components, containers      | `bg-slate-900`                        | `#0f172a`             | N/A            |
| **Borders**            | Subtle dividing lines            | `border-slate-800`                    | `#1e293b`             | N/A            |
| **Cyan (Primary)**     | Interactive actions, AI messages | `text-cyan-400` / `bg-cyan-600`       | `#22d3ee` / `#0891b2` | >= 4.5:1       |
| **Emerald (Success)**  | Normal status, resolved logs     | `text-emerald-400` / `bg-emerald-500` | `#34d399`             | >= 4.5:1       |
| **Amber (Warning)**    | Caution states, ADA path accents | `text-amber-400` / `bg-amber-500`     | `#fbbf24`             | >= 4.5:1       |
| **Rose (Danger)**      | Critical anomalies, incidents    | `text-rose-400` / `bg-rose-500`       | `#f87171`             | >= 4.5:1       |

---

## ✍️ Typography

Consistent geometric sans-serif styling is enforced across components.

- **Display & Headings:** `Outfit` (sans-serif)
  - Styled with bold weights (`font-bold`, `font-extrabold`) for clear visual hierarchy and high-impact scan speeds.
- **Body & Captions:** `Inter` (sans-serif)
  - Highly legible type designed for small interfaces. Used for chat messages, logs, and telemetry alerts.
- **Numerical Lists:** Tabular Numerals (`font-variant-numeric: tabular-nums`)
  - Enforced on all crowd counts and transit times to align numbers vertically and prevent visual "jumps" as counts fluctuate.

---

## 📐 Spacing Scale

Strict spacing prevents cluttered layouts:

- **`4px` (`gap-1` / `p-1`):** Micro borders and elements padding.
- **`8px` (`gap-2` / `p-2`):** Quick select suggestions and buttons.
- **`12px` (`gap-3` / `p-3`):** Internal padding for small cards.
- **`16px` (`gap-4` / `p-4`):** Page grid spacing, chat messages, input areas.
- **`24px` (`p-6`):** Command center grid panels and map displays.

---

## ♿ Accessibility Standard (WCAG 2.1 AA Compliance)

1. **Color Contrast:**
   - Text color overrides ensure all labels have a minimum `4.5:1` contrast against Slate backgrounds.
2. **Keyboard Focus Outlines:**
   - Removed browser default outlines and replaced them with custom visible outlines using focus-visible classes: `focus-ring` (`focus-visible:ring-2 focus-visible:ring-cyan-400`).
3. **No Color Alone:**
   - Telemetry zone statuses pair colors with text labels (`🚨 CRITICAL`, `⚠️ CAUTION`, `🟢 NORMAL`) and icons to support colorblind operators.
4. **ARIA & Screen-readers:**
   - Every input has explicit `aria-label` or `aria-labelledby`.
   - SVG maps contain `role="img"` and descriptive `aria-label`.
5. **Touch Targets:**
   - All interactive controls are scaled to a minimum of `44px` height and width (`h-11`) to prevent trigger issues on mobile.
6. **Assist Mode:**
   - Added a first-class "Accessibility Assist Mode" toggle inside the sticky header. Enabling it immediately scales font sizes up and displays helpful assistive overlays.
