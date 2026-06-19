# Grispen Rigging — UI Primitives (Blueprint & Steel)

This directory contains the design-system primitives introduced by the
**UX/UI Overhaul** (see `UX_UI_OVERHAUL_PLAN.md` at the repo root). They build
on the new Tailwind theme tokens and Inter / JetBrains Mono fonts wired up in
`tailwind.config.js`, `src/index.css`, and `index.html`.

## What's here

| Component                | When to use                                             |
| ------------------------ | ------------------------------------------------------- |
| `<Skeleton />`           | Replace spinning loaders for any data-loading state.    |
| `<SkeletonText />`       | Multi-line paragraph placeholder.                       |
| `<SkeletonCard />`       | Full card placeholder for list pages.                   |
| `<StatusPill />`         | Pass/fail/warn/info chips with a glowing dot.           |
| `<MonoNumber />`         | Any numeric engineering value (forces tabular figures). |
| `<DataCard />`           | Replacement for raw `bg-white border …` containers.     |
| `<KeyValueRow />`        | Label/value pairs inside a `DataCard`.                  |
| `<PageHeader sticky />`  | Long detail pages (sticks below the app top bar).       |
| `<GeometryVisualizer/>`  | Live 3D (orbit/pan/zoom) lifting visualizer (lazy-loaded). |
| `<GeometryVisualizer3D/>`| Three.js scene (used internally by `<GeometryVisualizer/>`).|

Toaster (`sonner`) is mounted globally in `App.tsx`. Use it from any feature:

```ts
import { toast } from 'sonner'

toast.success('Design saved')
toast.error('Calculation failed', { description: err.message })
```

## Adoption Checklist (per page)

Use this as the per-feature migration checklist for the remaining surfaces:

- [ ] Replace stark `bg-white` boxes with `<DataCard />` or `card-glass` class.
- [ ] Replace status badges (`bg-green-100 text-green-800`) with `<StatusPill />`.
- [ ] Wrap loading sections in `<Skeleton />` instead of spinners.
- [ ] Wrap all engineering numbers with `<MonoNumber value={...} unit="kN" />`.
- [ ] Add `<PageHeader sticky />` to long detail pages.
- [ ] Replace inline error/success boxes with `toast.error()` / `toast.success()`.

## Color Tokens (Tailwind)

The theme is driven by HSL CSS variables. Always reach for the tokens, not the
old hard-coded colours:

| Old (avoid)     | New (use)                                |
| --------------- | ---------------------------------------- |
| `bg-white`      | `bg-card`                                |
| `bg-gray-50`    | `bg-background` or `bg-drafting`         |
| `bg-blue-600`   | `bg-primary`                             |
| `text-gray-900` | `text-foreground`                        |
| `text-gray-500` | `text-muted-foreground`                  |
| `border-gray-…` | `border-border`                          |
| `bg-yellow-400` | `bg-accent` (industrial amber, sparingly)|

## Typography

* `font-sans` → Inter (UI elements).
* `font-mono` → JetBrains Mono (all numbers/tables/data).
* Use `tabular-nums` whenever numbers must align across rows.

## Backend payload compatibility

No new TypeScript types were introduced. All primitives consume the existing
shapes in `src/types/index.ts`, which already mirror the Django REST
serializers under `backend/apps/api/v1/**/serializers.py`:

* `RiggingDesignSummarySerializer` → `RiggingDesignSummary`
* `RiggingDesignSerializer` → `RiggingDesign`
* `AnalysisResultsSerializer` → `LiftingAnalysis` / `AnalysisResults`
* `DesignReportPayload` (`src/types/report.ts`) → backend report preview

If a field name ever drifts on the backend side, fix it in `src/types/` first
— never inline alternate names inside components.
