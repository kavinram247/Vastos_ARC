---
name: Vastos Arch
description: A precise operating system for architecture practices.
colors:
  canvas: "#F5F7F5"
  surface: "#FFFFFF"
  surface-subtle: "#EDF1EE"
  ink: "#17201D"
  ink-muted: "#64716B"
  line: "#DDE4DF"
  primary: "#1B6A59"
  primary-deep: "#124B40"
  primary-soft: "#E4F1EC"
  sidebar: "#15201C"
  sidebar-muted: "#9AA8A1"
  success: "#23845F"
  warning: "#B7791F"
  danger: "#C44C4C"
  info: "#3C6E9D"
typography:
  headline:
    fontFamily: "Avenir Next, Segoe UI, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Avenir Next, Segoe UI, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Avenir Next, Segoe UI, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 450
    lineHeight: 1.55
  label:
    fontFamily: "Avenir Next, Segoe UI, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "0.01em"
rounded:
  sm: "6px"
  md: "9px"
  lg: "12px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
  button-primary-hover:
    backgroundColor: "{colors.primary-deep}"
    textColor: "{colors.surface}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "10px 12px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "20px"
---

# Design System: Vastos Arch

## Overview

**Creative North Star: "The Studio Ledger"**

Vastos Arch should feel like the beautifully maintained operating ledger of a respected architecture studio: exact, calm, practical, and considered down to the smallest annotation. The interface uses familiar product patterns, but its refinement comes from disciplined spacing, excellent typography, and confident information density rather than ornamental UI.

The system rejects cookie-cutter SaaS dashboards, generic bordered card grids, nested containers, purple-blue startup gradients, decorative glassmorphism, excessive pills, weak gray-on-gray hierarchy, inconsistent spacing, and visual novelty that competes with the work.

**Key Characteristics:**

- Restrained spruce accent on neutral working surfaces
- Strong typographic hierarchy and tabular numerals
- Flat-by-default containers with structural, not decorative, elevation
- Comfortable 8px-grid spacing with compact data regions
- Fast, quiet interaction feedback

## Colors

The palette combines cool mineral neutrals with a single deep spruce action color.

### Primary

- **Studio Spruce** (#1B6A59): Primary actions, active navigation, links, focus, and selected states.
- **Deep Spruce** (#124B40): Hover and pressed states.
- **Drafting Wash** (#E4F1EC): Selected rows, low-emphasis information, and accent-tinted backgrounds.

### Neutral

- **Working Canvas** (#F5F7F5): Main application background.
- **Clean Sheet** (#FFFFFF): Primary working surfaces and controls.
- **Trace Layer** (#EDF1EE): Secondary panels, table headers, and grouped controls.
- **Graphite Ink** (#17201D): Primary text and high-confidence data.
- **Annotation Gray** (#64716B): Supporting text and metadata.
- **Construction Line** (#DDE4DF): Dividers and input boundaries.
- **Night Studio** (#15201C): Navigation rail.

### Named Rules

**The One-Marker Rule.** Studio Spruce is reserved for action, selection, and focus. It should occupy less than 10% of a typical screen.

**The State-Is-Meaning Rule.** Success, warning, danger, and info colors communicate real status only; they are never decorative accents.

## Typography

**Display Font:** Avenir Next (with Segoe UI and system sans-serif fallbacks)  
**Body Font:** Avenir Next (with Segoe UI and system sans-serif fallbacks)  
**Label/Mono Font:** UI monospace for identifiers; tabular figures for data

**Character:** A single, humanist sans-serif family keeps dense product surfaces cohesive. Hierarchy comes from optical size, weight, spacing, and contrast—not from decorative font pairing.

### Hierarchy

- **Headline** (650, 28px, 1.2): Page titles only.
- **Title** (600, 16px, 1.35): Section and container titles.
- **Body** (450, 14px, 1.55): Interface copy and table content; prose maxes at 70ch.
- **Label** (600, 12px, 0.01em): Metadata, field labels, and compact navigation.
- **Data** (600, tabular figures): Financials, KPIs, dates, and aligned quantities.

### Named Rules

**The Quiet Headline Rule.** Page titles establish authority without becoming hero typography. Product work starts immediately below them.

## Elevation

The system is flat by default. Depth comes from tonal layering and crisp separators; a compact ambient shadow appears only on floating menus, modals, and interactive surfaces that lift on hover.

### Shadow Vocabulary

- **Surface:** `0 1px 2px rgba(16, 32, 26, 0.06)`: Primary cards without a visible border.
- **Floating:** `0 12px 28px rgba(10, 24, 18, 0.14)`: Menus and modals.
- **Focus:** `0 0 0 3px rgba(27, 106, 89, 0.16)`: Keyboard and form focus.

### Named Rules

**The Flat-by-Default Rule.** A surface must earn elevation by floating, moving, or requiring temporary focus.

## Components

### Buttons

- **Shape:** Compact rounded rectangle (9px), never an oversized pill.
- **Primary:** Studio Spruce fill, white text, 10px × 16px padding.
- **Hover / Focus:** Deepens to Deep Spruce; visible 3px focus halo; pressed state translates by 1px.
- **Secondary / Ghost:** White or transparent surfaces with clear text and restrained line treatment.

### Chips

- **Style:** Compact 6px radius, tonal background, medium text; borders only when status contrast requires them.
- **State:** Selected chips use Drafting Wash and Studio Spruce text.

### Cards / Containers

- **Corner Style:** 12px outer radius; inner controls use 6–9px.
- **Background:** Clean Sheet over Working Canvas.
- **Shadow Strategy:** Surface shadow only; no border-shadow combination.
- **Border:** Dividers are preferred over enclosing borders. Semantic callouts may use a full 1px border.
- **Internal Padding:** 16–24px depending on density.

### Inputs / Fields

- **Style:** White background, 1px Construction Line boundary, 9px radius, 40–44px target height.
- **Focus:** Studio Spruce boundary and Focus halo.
- **Error / Disabled:** Explicit semantic state plus readable supporting text; never color alone.

### Navigation

The Night Studio rail is visually stable and quieter than the working canvas. Items use 36–40px rows, consistent 18px icons, low-contrast inactive labels, and a restrained full-row active state. Mobile navigation uses the same hierarchy in an overlay rail.

## Do's and Don'ts

### Do:

- **Do** use the 8px grid and optical adjustments of 1–2px where icons or baselines need them.
- **Do** use whitespace, dividers, and type to organize information before adding a container.
- **Do** make table headers quiet, rows comfortably scannable, and numeric columns tabular and aligned.
- **Do** provide hover, focus-visible, active, disabled, loading, empty, error, and success treatments.
- **Do** keep action and selection color below 10% of the screen.

### Don't:

- **Don't** use cookie-cutter SaaS dashboards or generic bordered card grids.
- **Don't** nest bordered containers or create box-inside-box layouts.
- **Don't** use purple-blue startup gradients, decorative glassmorphism, or random gradients.
- **Don't** use excessive pills, oversized radii, or border-plus-wide-shadow ghost cards.
- **Don't** use weak gray-on-gray hierarchy or low-contrast placeholder text.
- **Don't** introduce inconsistent spacing, icon sizes, control heights, or button vocabularies.
- **Don't** use side-stripe borders, gradient text, or decorative motion.
- **Don't** trade familiar product affordances for novelty.
