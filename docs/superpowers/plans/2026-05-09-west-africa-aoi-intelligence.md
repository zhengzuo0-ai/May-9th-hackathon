# West Africa AOI Intelligence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pivot the hackathon app from a legacy concession memo into a Côte d’Ivoire AOI intelligence demo.

**Architecture:** Keep the existing Next.js workstation and JSON data flow. Replace the domain data with West African AOIs, add AOI intelligence terminology, expose remote-sensing / ASM / public-company evidence layers in the UI, and retune prompts/fallbacks from investment committee scoring to exploration evidence synthesis.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind CSS, MapLibre GL JS, turf.js, OpenAI SDK, static JSON data packs, cached public-source excerpts.

---

## Product Decision

Build **Côte d’Ivoire only** for the submitted demo.

The Côte d’Ivoire story is stronger for Zee because he has direct familiarity and company presence there. Ghana is useful as a verbal comparison, but it should not enter the product surface before submission. The demo should say:

> Côte d’Ivoire is a fast-moving gold frontier where public-company work, ASM activity, cadastre reform, and remote-sensing signals are fragmented. This app turns one AOI into an exploration evidence map.

## Demo Spine

1. User selects **Côte d’Ivoire: Yaouré–Kokumbo AOI**.
2. Map shows AOI, 150km focused scan buffer, public projects, ASM / disturbance anchors, nearby cities, and simplified Côte d’Ivoire boundary context.
3. Right panel shows **Data Coverage**, not just an investment memo.
4. Cached evidence appears before live GPT runs.
5. User clicks **Run AOI Recon**.
6. App extracts evidence from source packs and produces an **Expert Review Route**:
   - what public companies have proven nearby
   - which evidence is on the same shear zone, structural corridor, greenstone belt, or mineralized trend
   - what remote sensing suggests
   - what ASM/pits imply
   - what evidence is missing
   - what to verify in 30 days
7. App presents a **Research Library / Data Room** grouped for Geologist, Remote Sensing, and Commercial workstreams.
8. User reads the 30-day field + data plan and can ask follow-up questions.

## Research Library Layer

The demo should make clear that this is a collaboration workflow, not just an AI memo. When someone sends Zee an AOI with little or no direct data, the system should collect adjacent public evidence into a lightweight package that three teams can use at the same time:

- **Geologist team:** regional geology, Birimian belt context, drilling/resource analogues, technical reports, geochemistry/geophysics references.
- **Remote sensing team:** public satellite/ASM disturbance references, land disturbance papers, rivers/forest/protected-area risk links, suggested first-pass imagery tasks.
- **Commercial team:** public-company comparables, cadastre/licensing context, operating/development project links, counterparties and IR follow-up targets.

For this hackathon, the library can be static/cached in source packs and shown as structured links. The product story is:

> Exa finds the public research and company material; GPT-5.5 triages it into role-specific workstreams and turns it into a 30-day professional route.

## Parallel Work Split

### Agent A: West Africa Data Pack

**Files:**
- Modify: `src/data/concessions.json`
- Modify: `src/data/public_companies.json`
- Modify: `src/data/source_packs.json`
- Modify: `docs/DATA_SOURCES.md`

- [ ] **Step 1: Replace AOIs**

Create one AOI using the existing `Concession` schema.

Use these IDs exactly:

```json
[
  {
    "id": "ci-yaoure-kokumbo-aoi",
    "name": "Côte d’Ivoire Yaouré–Kokumbo AOI",
    "country": "CI",
    "center": [-6.65, 8.15],
    "polygon": {
      "type": "Polygon",
      "coordinates": [[[-7.15, 7.75], [-6.15, 7.75], [-6.15, 8.55], [-7.15, 8.55], [-7.15, 7.75]]]
    }
  }
]
```

- [ ] **Step 2: Replace public project comparables**

Add 6 public-company project rows total.

Côte d’Ivoire rows:
- Fortuna Mining / Séguéla Mine / Au
- Montage Gold / Koné Project / Au
- Endeavour Mining / Assafou or Tanda-Iguela / Au
- Perseus Mining / Yaouré or Sissingué / Au
- Turaco Gold / Afema / Au
- Resolute Mining / Doropo / Au

Each row must include `concessionId`, `company`, `ticker`, `exchange`, `project`, `country`, `lat`, `lng`, `commodities`, and `sourceUrls`.

- [ ] **Step 3: Replace source packs**

Create 12-16 source packs for Côte d’Ivoire only.

Each source pack should be short, cached, and source-backed. Use these evidence themes:
- operating mine or development project facts
- resource estimate or production-stage fact
- drilling/resource/corporate milestone
- ASM / artisanal mining context
- remote-sensing disturbance benchmark
- cadastre or official-government data availability
- research paper or technical-reference links useful to geologists or remote-sensing analysts

Do not invent numbers. If exact resources or production are not verified, write a qualitative supported summary instead of a number.

- [ ] **Step 4: Update source register**

`docs/DATA_SOURCES.md` should have one section:
- Côte d’Ivoire Yaouré–Kokumbo AOI

For every source pack URL, include a matching bullet in the source register.

### Agent B: Domain Logic and Prompts

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/geo.ts`
- Modify: `src/lib/prompts.ts`
- Modify: `src/app/api/extract-evidence/route.ts`
- Modify: `src/app/api/investment-committee/route.ts`
- Modify: `src/app/api/follow-up/route.ts`

- [ ] **Step 1: Update country codes**

In `src/lib/types.ts`, change:

```ts
export type CountryCode = "BW" | "NA";
```

to:

```ts
export type CountryCode = "CI";
```

- [ ] **Step 2: Add evidence categories**

Extend `EvidenceItem["evidenceType"]` to include:

```ts
| "remote_sensing"
| "asm_activity"
| "geochemistry"
| "geophysics"
| "trenching"
| "cadastre"
```

Keep existing categories so old routes still compile.

- [ ] **Step 3: Fix radius mismatch**

In `src/lib/geo.ts`, set the default nearby-project radius to 150km so the demo prioritizes tight, defensible public-company / ASM / paper evidence.

```ts
const DEFAULT_RECON_RADIUS_KM = 150;
```

Use that constant anywhere the default radius is needed.

- [ ] **Step 4: Retune extraction prompt**

In `src/lib/prompts.ts`, change the extraction prompt from “selected concession” to “selected AOI”. It must ask GPT to classify evidence into:
- remote sensing
- public company work
- drilling
- resource estimate
- geochemistry
- geophysics
- ASM / pits / trenching
- cadastre / licensing context
- research paper / technical reference

The prompt must explicitly say:

```text
Do not treat proximity alone as proof of mineralization. Mark proximity-only signals as low confidence unless supported by drilling, geochemistry, geophysics, resource, or visible workings evidence.
```

- [ ] **Step 5: Retune committee prompt**

Rename the output from investment committee to expert review route. Required sections:

```md
## AOI Triage
Route: PRIORITIZE / WATCH / DEFER
Confidence: High / Medium / Low

## Why This AOI Is Interesting
## Data Package For Experts
## Geology / Geochemistry / Geophysics
## Remote Sensing / ASM / Surface Workings
## Missing Data
## 30-Day Expert Workplan
## What Would Change The Route
```

- [ ] **Step 6: Update API fallbacks**

Any hardcoded legacy-country fallback logic must be removed.

Fallback decision rule:
- `PRIORITIZE` if there are at least 4 evidence items and at least 2 source companies.
- `WATCH` if there are at least 2 evidence items.
- `DEFER` otherwise.

### Agent C: UI and Demo Surface

**Files:**
- Modify: `src/components/Workstation.tsx`
- Modify: `src/components/MapView.tsx`
- Modify: `src/app/globals.css`
- Modify: `README.md`

- [ ] **Step 1: Rename visible product language**

Replace visible labels:
- `Concession Recon` → `West Africa AOI Intelligence`
- `Selected Concession` → `Selected AOI`
- `Run Recon` → `Run AOI Recon`
- `Chair Decision` → `AOI Triage`
- `Investment Committee` → `Expert Review Route`
- `Public Disclosures` → `Public + Remote Evidence`

- [ ] **Step 2: Update map framing**

In `MapView.tsx`, initialize the map around West Africa:

```ts
center: [-4.7, 7.4],
zoom: 5.4
```

Keep AOI polygon, 150km focused scan radius, project pins, ASM / disturbance pins, city pins, and evidence pins.

- [ ] **Step 3: Add layer-stack language**

In the right panel, add compact layer rows or stats for:
- Public projects
- Source packs
- Remote sensing
- ASM / pits
- Geology / structure
- Research library
- Data gaps

This can be static/cached for the hackathon. It must make the app feel like an evidence stack, not a chat app.

- [ ] **Step 3b: Add collaboration workstreams**

Add a compact Data Room / Research Library area showing three workstreams:
- Geologist
- Remote Sensing
- Commercial

Each row should communicate that the AOI evidence pack contains links/documents for that team.

- [ ] **Step 4: Update demo follow-up buttons**

Use these four preset actions:
- `What should we verify first?`
- `Which layer is weakest?`
- `Compare nearby companies`
- `Draft 30-day field plan`

- [ ] **Step 5: Rewrite README**

README must include:
- product one-liner
- local run command
- demo path
- environment variables
- note that source packs are cached public-source excerpts for hackathon reliability

## Main Coordinator Tasks

### Task 1: Lock Scope

- [ ] Confirm this scope in the active thread:

```text
Côte d’Ivoire only. One main demo AOI. No live satellite ingestion before submission.
```

### Task 2: Dispatch Agents

- [ ] Dispatch Agent A with ownership of data and docs only.
- [ ] Dispatch Agent B with ownership of domain/API only.
- [ ] Dispatch Agent C with ownership of UI and README only.
- [ ] Tell all agents they are not alone in the codebase, must not revert others’ work, and must keep their write scopes disjoint.

### Task 3: Integrate

- [ ] Review changed files after agents complete.
- [ ] Resolve type mismatches and JSON schema mismatches.
- [ ] Run:

```bash
npm run lint
npm run build
```

Expected: both commands pass.

### Task 4: Browser QA

- [ ] Start or reuse dev server:

```bash
npm run dev
```

- [ ] Open `http://localhost:3000`.
- [ ] Verify:
  - map starts on West Africa
  - Côte d’Ivoire AOI is selectable
  - public project/source counts update
  - Run AOI Recon works without crashing
  - fallback evidence is visible even if live API fails
  - no text overlaps at laptop viewport

### Task 5: Commit and Push

- [ ] Commit:

```bash
git add -A
git commit -m "Pivot demo to West Africa AOI intelligence"
git push
```

Expected: GitHub `main` contains the final hackathon demo.

## Scope Guardrails

Do not build live Google Earth Engine, STAC, PDF parsing, or cadastre scraping before submission. Use cached source packs and fake-but-labeled overlay data for demo reliability.

Do not add Ghana to the product surface before submission. Ghana can stay in the verbal pitch as a comparison case.

Do not spend time on auth, database, onboarding, or landing pages.

## Verification

Minimum ship bar:
- `npm run lint` passes.
- `npm run build` passes.
- app loads at `http://localhost:3000`.
- Côte d’Ivoire AOI can produce visible cached evidence and an exploration thesis.
