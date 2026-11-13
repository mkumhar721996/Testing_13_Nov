# UI Guidelines

## Navigation and information architecture
- Use a single top bar with the main navigation inside it; there is no sidebar, so every screen keeps its full width for content.
- Main sections, in order: **Dashboard** (`dashboard`), **Projects** (`projects`), **Reports** (`reports`), **Settings** (`settings`). Four peers keep the bar readable on a phone menu.
- **Account** (`account`) sits at the right end of the top bar, because it is personal rather than a work section.
- On small screens the navigation collapses behind a menu button, so the page title stays visible.
- Detail screens live under their section and show a back link, never a new top-level item, so the section list stays stable.

## Layout and density
- Moderately dense working app: content sits in a `.container` and uses `.stack` / `.grid` with the default spacing tokens, since users scan lists and status all day.
- Design mobile-first at 375px and expand to a single content column up to `container-max`; wider screens add columns via `.grid`, not wider text.
- One primary action per screen, placed at the top right of the page header, so the next step is always in the same place.

## Component usage
- `.card` for a self-contained object with its own actions (a project, a summary figure); a `.table` for comparing many records across the same fields; a `.menu` list for short navigational or settings lists.
- `.btn-primary` for the single main action, `.btn-secondary` for alternatives, `.btn-ghost` for low-emphasis actions, `.btn-danger` only for destructive confirmation, so emphasis matches consequence.
- `.modal` for confirmations and short forms; `.drawer` for editing or inspecting a record without leaving the list; `.toast` for success after an action, `.alert` for problems that stay on the page.
- `.field` wraps every form control, with `.field-hint` for guidance and `.field-error` plus `.is-invalid` for errors, so labels and messages are consistent.
- `.empty-state` with one `.btn-primary` for first-use lists and `.skeleton` for loading lists; `.spinner` only for in-button or short waits, because skeletons keep the layout stable.
- `.badge` for status (success, warning, danger, neutral) and `.chip` for filters, to separate state from user-chosen filtering.

## Theme
- Light theme only, as the default and sole theme; the token set has no dark values, and a second theme would need its own review.
- Colourful but purposeful: `color-primary` for the top bar, page titles and main actions; `color-accent` for featured items, selected chips and avatars; `color-teal` for positive highlights and growth figures; `color-pink` for tags and categories, so colour groups content by meaning rather than decorating it.
- Use `.card-accent` / `.card-teal` and `.badge-accent` / `.badge-teal` / `.badge-pink` for emphasis, at most one tinted card per row, so the page stays calm enough to scan.
- Status colours (`color-success`, `color-warning`, `color-danger`) stay reserved for status, so they are never confused with decoration.

## Voice and tone
- Plain, calm and direct: short sentences, sentence case, verbs on buttons ("Create project", not "Submit"), because users are mid-task.
- Errors say what happened and how to fix it, without blame or exclamation marks, so users recover quickly.
- Empty states explain the benefit and offer the first step, so a blank screen never feels like a dead end.
