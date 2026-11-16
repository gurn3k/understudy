---
name: Understudy
description: A findings report set as a theatre prompt book, where each finding is a cue held on standby until outcomes call it to go.
colors:
  frame: "#0e1726"
  frame-ink: "#e7ecf5"
  frame-dim: "#a9b8d2"
  frame-rule: "#24314d"
  frame-accent: "#5d7fd6"
  frame-cue: "#7f95c4"
  lamp-standby: "#d64a3f"
  lamp-go: "#3fae6d"
  lamp-unlit: "#2c3954"
  paper: "#f7f8f5"
  ink: "#16202e"
  ink-2: "#3a4656"
  rule: "#c9ced6"
  wash: "#eceee8"
  pencil: "#3150a0"
  standby: "#b8322a"
  go: "#1f7a45"
  cut: "#b8322a"
  unlit: "#c3c8cf"
  sel: "#cfd9f2"
typography:
  display:
    fontFamily: "Archivo Narrow, Arial Narrow, sans-serif"
    fontSize: "clamp(34px, 5.2vw, 56px)"
    fontWeight: 700
    lineHeight: 1.04
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Archivo Narrow, Arial Narrow, sans-serif"
    fontSize: "clamp(28px, 3.4vw, 38px)"
    fontWeight: 700
    lineHeight: 1.1
  answer:
    fontFamily: "Archivo Narrow, Arial Narrow, sans-serif"
    fontSize: "clamp(26px, 3.4vw, 40px)"
    fontWeight: 700
    lineHeight: 1.15
  title:
    fontFamily: "Archivo Narrow, Arial Narrow, sans-serif"
    fontSize: "21px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.01em"
  figure:
    fontFamily: "Archivo Narrow, Arial Narrow, sans-serif"
    fontSize: "clamp(30px, 4vw, 44px)"
    fontWeight: 700
    lineHeight: 1
    fontFeature: "tnum"
  body:
    fontFamily: "Atkinson Hyperlegible, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.6
  lede:
    fontFamily: "Atkinson Hyperlegible, system-ui, sans-serif"
    fontSize: "19px"
    fontWeight: 400
    lineHeight: 1.6
  small:
    fontFamily: "Atkinson Hyperlegible, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Archivo Narrow, Arial Narrow, sans-serif"
    fontSize: "13px"
    fontWeight: 700
    letterSpacing: "0.12em"
  cue-mark:
    fontFamily: "Archivo Narrow, Arial Narrow, sans-serif"
    fontSize: "15px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.04em"
rounded:
  hairline: "2px"
  lamp: "50%"
spacing:
  xs: "8px"
  sm: "12px"
  gutter: "16px"
  md: "24px"
  lg: "32px"
  xl: "48px"
  cue: "56px"
components:
  button-open:
    backgroundColor: "transparent"
    textColor: "{colors.pencil}"
    typography: "{typography.label}"
    rounded: "{rounded.hairline}"
    padding: "7px 12px"
  button-open-hover:
    backgroundColor: "{colors.pencil}"
    textColor: "{colors.paper}"
  button-close:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.hairline}"
    padding: "7px 12px"
  button-close-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
  theme-toggle:
    backgroundColor: "transparent"
    textColor: "{colors.frame-dim}"
    rounded: "{rounded.lamp}"
    size: "36px"
  top-bar:
    backgroundColor: "{colors.frame}"
    textColor: "{colors.frame-ink}"
    height: "56px"
    padding: "0 16px"
  cue-rail-link:
    textColor: "{colors.frame-dim}"
    typography: "{typography.label}"
  cue-rail-link-active:
    textColor: "{colors.frame-ink}"
  script-column:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    padding: "32px 16px 80px"
  drawer:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    width: "min(560px, 100vw)"
  table-row-chosen:
    backgroundColor: "{colors.wash}"
---

# Design System: Understudy

## Overview

**Creative North Star: "The Prompt Book"**

The page is a stage manager's prompt book. A blue-black backstage frame holds a white script column, and every finding is a numbered cue written in blue pencil in the margin. Cues sit on STANDBY until outcomes call them to GO, and a demoted cue is marked CUT. The reader works through the script top to bottom: answer first, then the evidence, each figure able to open the cases behind it.

Density is that of a working document, not a dashboard. Long-measure body text (68ch), ruled sections, tables with tabular numerals, and charts drawn to scale carry the content. Ornament is limited to the materials a real prompt book uses: pencil marks, hairline rules, struck-through text that stays legible, and small ringed lamps. Nothing glows, nothing floats on cards, and states are always words first, with colour repeating them.

The system rejects the KPI-card analytics write-up: no tiles of big numbers on tinted panels, no gradient hero, no decorative iconography.

**Key Characteristics:**
- Two-material layout: dark frame (bar, cue rail) around a light paper script column; the paper flips to deep slate in dark mode while the frame stays put.
- Condensed grotesk for every heading, label and cue mark; a highly legible humanist sans for reading.
- Blue pencil is the single annotation voice: cue numbers, links, struck-through marks, action buttons, the chosen data point.
- State colour (red STANDBY or CUT, green GO) appears only next to a state word or as a lamp on the cue sheet.
- Hairline and 2px ink rules divide content; there are no cards and almost no shadow.

## Colors

A cool backstage navy and warm-white paper, with one blue pencil and two signal lamps.

### Primary
- **Blue Pencil** (pencil): the annotation hand. Cue numbers in the margin, links, the strike-through line on replaced rules, outlined action buttons and their filled hover, the chosen point in plots, the range-input accent, and the focus ring. Lightens to a pale periwinkle in dark mode.

### Secondary
- **Standby Red** (standby): STANDBY state words, the 99% bar line and its label in plots, and standby lamps on the cue sheet. Shares its value with **Cut Red** (cut), which marks demotion as a pencil X.
- **Go Green** (go): GO state words and earned lamps on the cue sheet.

### Neutral
- **Backstage Navy** (frame): page background, top bar and cue rail. Never changes with theme.
- **Frame Chalk** (frame-ink) and **Frame Haze** (frame-dim): active and resting text on the frame.
- **Frame Seam** (frame-rule): the 1px dividers and theme-toggle ring on the frame.
- **Frame Lamps** (lamp-standby, lamp-go, lamp-unlit): the brighter lamp values used on the dark cue rail, where the paper-side state colours would sink. **Rail Blue** (frame-accent) underlines the active tab and cue; **Cue Blue** (frame-cue) sets the Q-numbers in the rail.
- **Script Paper** (paper): the reading column, the drawer, and the knock-out ring around lamps.
- **Script Ink** (ink) and **Margin Ink** (ink-2): primary text and 2px heavy rules; secondary text, captions, ledes, notes, axes.
- **Hairline** (rule): 1px section, table and list dividers, plot ticks.
- **Wash** (wash): the chosen table row and the empty track behind bars.
- **Unlit** (unlit): the unlit dot on the cue sheet.
- **Selection** (sel): text selection.

Dark mode (system preference or the toggle) redefines only the paper-side tokens: paper becomes deep slate (#1a253b), ink becomes near-white, pencil becomes #9db3ee, standby and cut become coral #ff8478, go becomes #63d394, rule #34435f, wash #222f49, unlit #46557a, sel #2c3f6b. The frame tokens are shared by both themes.

### Named Rules
**The Words First Rule.** A state is always written (STANDBY, GO, CUT, PAID CLEAN, CORRECTED) in the label face; red and green only repeat the word or mark a lamp. No colour-only status.

**The One Pencil Rule.** Blue pencil is the only accent hue for annotation and action. Do not introduce a second accent.

## Typography

**Display Font:** Archivo Narrow (with Arial Narrow, sans-serif), self-hosted at 700 (500 is also shipped)
**Body Font:** Atkinson Hyperlegible (with system-ui, sans-serif), self-hosted at 400, 400 italic and 700

**Character:** a tall, condensed theatre-bill grotesk for every heading and label, set against a reading face built for legibility, so the page reads like a typed script with stencilled cue labels.

### Hierarchy
- **Display** (700, clamp(34px, 5.2vw, 56px), 1.04): the page question, the one h1. Balanced wrap, max 22ch.
- **Headline** (700, clamp(28px, 3.4vw, 38px), 1.1): each cue's h2.
- **Answer** (700, clamp(26px, 3.4vw, 40px), 1.15): the one-sentence answer under the h1, over a 2px ink rule, max 30ch. Later cues use a smaller headline sentence (clamp(22px, 2.6vw, 28px), 1.3, max 34ch).
- **Title** (700, 21px, 1.2): h3 within a cue.
- **Figure** (700, clamp(30px, 4vw, 44px), 1, tabular): a cost or count drawn as a number in the cost block.
- **Body** (400, 17px, 1.6): running text, max 68ch. **Lede** is 19px in Margin Ink. **Small** is 15px in Margin Ink for captions, notes and tables.
- **Label** (700, 13px, 0.12em, uppercase): table captions and heads (0.06em), margin-note heads, rail entries, verdict labels, form labels, the method Open/Close toggle.
- **Cue Mark** (700, 15px, 0.04em, rotated -7deg, pencil): the Q-number beside each heading; hangs in the left margin from 900px, inline before the heading below that.

### Named Rules
**The Tabular Rule.** Every number that sits in a column, a bar value, a cost or a scrubber readout uses tabular numerals.

**The Condensed-Only-For-Structure Rule.** Archivo Narrow carries headings, labels, cue marks and state words; it never sets paragraphs.

## Layout

The page is a sticky 56px top bar over a two- or three-column stage.

- **Phone (below 900px):** the cue rail becomes a horizontal, scrollable strip stuck under the bar. The script column has a 16px gutter (32px top, 80px bottom). Margin notes drop below their cue's text, opened by a 2px ink rule.
- **Tablet and desktop (900px and up):** the cue rail is a 230px sticky left column the height of the viewport; section tabs appear in the bar; the script pads to 56px 48px 120px; cue marks hang into the margin.
- **Wide (1240px and up):** rail 250px, script, and a 48px right breathing column. Each section becomes a two-column grid: text at max 68ch and the "On this cue" margin note at min 200px, 48px apart. A wide section spans one column and lays its notes out in a row.

Sections are separated by 56px above and below a 1px hairline. Inside sections the rhythm runs on 8, 12, 16, 24 and 32px. Breakpoints in use: 480, 560, 600, 700, 900 and 1240px.

## Elevation & Depth

Flat. Depth comes from the two materials (dark frame and light paper) and from rules, not from shadow. There is one shadow, for the only element that truly sits above the page.

### Shadow Vocabulary
- **Drawer cast** (`box-shadow: -12px 0 32px rgba(8, 14, 26, .28)`): the case drawer sliding in from the right.
- **Lamp ring** (`box-shadow: 0 0 0 2px <ground>, 0 0 0 3px <state colour>`): a knock-out ring around a lit lamp, used on the rail and for the current week on the cue sheet. A ring, not a glow.

### Named Rules
**The Ringed Not Glowing Rule.** Lamps are solid dots with a crisp 1px ring separated by a 2px gap of the ground colour. No blur, no halo.

## Shapes

Square by default. Corners appear in two forms only: a 2px hairline radius on outlined buttons and the focus ring, and full circles for lamps, cue-sheet dots and the theme toggle. Rules come in two weights: 1px hairline to divide and 2px ink to open a block (the verdict, the answer, margin notes on narrow screens, table heads, cost and method blocks, the drawer head). A CUT mark is a pencil X built from two 2px strokes. Replaced text is struck through with a 2px pencil line and kept.

## Components

### Buttons
- **Open the cases** (button-open): outlined in pencil, 1px border, 2px radius, 7px 12px padding, 14px Archivo Narrow 700 at 0.06em, with a 14px inline SVG. Hover fills with pencil and inverts the text to paper.
- **Close** (button-close): the same shape in ink; hover fills with ink.
- **Theme toggle**: a 36px circle ringed in Frame Seam holding an 18px half-filled circle SVG; hover brightens text and ring.
- **Focus**: every focusable element takes a 2px pencil outline at 3px offset; on the frame the outline switches to Frame Chalk.

### Navigation
- **Top bar:** Backstage Navy, 1px seam beneath, wordmark in 16px label face at 0.22em. Section tabs (900px up) are Frame Haze, and turn Frame Chalk with a 2px Rail Blue underline on hover or when current.
- **Cue rail:** an ordered list of cues, each a lamp, a Cue Blue Q-number and a label-face title. The current cue gets Frame Chalk text and a 2px Rail Blue underline at 6px offset. Lamp colour changes over .4s.

### Margin Note ("On this cue")
A sidebar aside in 15px Margin Ink with a label-face head, holding a list divided by hairlines. It sits beside the text from 1240px and below it, opened by a 2px ink rule, on narrower screens.

### Verdict Lines
A row of label-face pencil labels (about 11em wide) set against a sentence. A replaced verdict's label is struck through in pencil with a small italic note underneath, and stays on the page. Stacks below 480px.

### Tables
Full width, 15px, tabular. Captions and heads in the label face; heads carry a 2px ink rule, rows a 1px hairline. Numbers align right, the first column left. The chosen row takes Wash. State cells are label-face words in their state colour.

### Bars Drawn to Scale
Three-column rows: name, a 14px Wash track with an ink fill (pencil at 55% for the batch share), and a tabular value. A highlighted row is bold with a pencil fill. Below 560px the track drops to its own row.

### Interval Plot
An SVG plot: 2px Margin Ink interval lines, a 5px ink dot (pencil when chosen), hairline ticks, and the bar drawn as a 2px Standby Red line with a label-face caption.

### Cue Sheet (signature)
A grid of case-type rows by week columns (16px cells, 2-3px gaps), with the row label stuck to the left edge. Each cell is a lamp: a 6px unlit dot, a 5px faint standby dot, an 11px go dot, or a pencil X for CUT. The current week is outlined in ink and its lit lamps take the ringed treatment; future weeks fade to 25%. A labelled range input (pencil accent) scrubs weeks, with a legend and a tabular readout below.

### Method Disclosure
A details block opened by a 2px ink rule; the summary is 20px Archivo Narrow 700 with a pencil label-face Open/Close on the right. Inside, a numbered list of rules, with replaced rules struck through in pencil and kept.

### Case Drawer
A right-edge panel up to 560px wide on paper, with a 1px hairline left edge and the drawer cast. It slides in over .45s on cubic-bezier(.16,1,.3,1), with no animation under reduced motion. The head carries a 24px title and the Close button over a 2px ink rule; the body scrolls a 14px table whose first column is in the display face.

## Do's and Don'ts

### Do:
- **Do** write every state as a word in the label face, then colour it: STANDBY and CUT in Standby Red, GO in Go Green.
- **Do** keep replaced rules and verdicts on the page, struck through with a 2px pencil line.
- **Do** put the cue number in pencil, rotated -7deg, beside every section heading.
- **Do** divide with rules: 1px hairline between items, 2px ink to open a block.
- **Do** use tabular numerals for every number in a column, bar or readout, and draw quantities to scale.
- **Do** keep the frame dark in both themes; only the paper-side tokens flip.
- **Do** give every figure a button that opens the cases behind it.

### Don't:
- **Don't** make lamps glow; use the solid dot and the 1px ring set off by a 2px gap.
- **Don't** set status by colour alone.
- **Don't** add a second accent hue next to blue pencil.
- **Don't** put findings on cards or tinted KPI tiles; the script column is one sheet of paper.
- **Don't** add shadows beyond the drawer cast.
- **Don't** set paragraphs in Archivo Narrow.
