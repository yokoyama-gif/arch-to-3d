# Scaffold Estimate Prototype

`ScaffoldEstimatePage.tsx` is a prototype for a 足場見積もりシミュレーター page —
generated as a hand-off artifact and intentionally placed outside `src/`
so the current SkyFactor app's `tsc` build is not affected.

## Status: not wired up on this branch

The component depends on these files which live on a **different lineage of
this repo's `arch-to-3d/frontend`** (the `DemolitionEstimatePage` / outdoor
estimate variant), not the SkyFactor app currently on `master`:

- `src/components/PdfMeasureCanvas.tsx` — measure canvas (line / area / rect / etc.)
- `src/pages/DemolitionEstimatePage.tsx` — referenced as the structural model
- `src/pages/ExteriorEstimatePage.tsx` — referenced for step-by-step UX
- `src/styles.css` — `est-shell`, `est-panel`, `est-tool-btn`, `est-pdf-toolbar`, etc.

To integrate, move this file into `src/pages/`, register a tab in `App.tsx`
(alongside the existing 外構 / 解体 tabs), and run `tsc --noEmit`.

## What it does

| STEP | UI |
|---|---|
| 1 | Image upload (PNG/JPG/WEBP) |
| 2 | Scale calibration via 2-click + real-distance(m) input |
| 3 | Trace building outline as polygon or rectangle (with ortho ruler mode) |
| 4 | Inputs: floors / floor height / eave correction / scaffold type / mesh / sound sheet / stairs |

Computes:

```
H        = floors * floorHeight + (eaveCorrection ? 1.0 : 0)
perimeter = sum of polygon edge lengths in meters
scaffoldArea = perimeter * H * typeMultiplier  // 吊り=1.5, others=1.0
total    = scaffoldArea * unitPrice + meshCost + soundCost + stairs * unitStair
```

CSV export is BOM-prefixed UTF-8 (`足場見積_yyyymmdd.csv`), Excel-compatible.
Unit-price master is editable inline so a contractor can tune their margin.
