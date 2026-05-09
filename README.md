# Concession Recon

**Public-data intelligence for early mineral license review in Côte d'Ivoire.**

Mining teams are often sent a license package, coordinate, polygon, or GeoJSON and need to answer a practical question fast: **what does the public world already know about this land and its surrounding trend?**

Concession Recon turns that intake into a map-backed evidence package. It gathers and organizes nearby public-company projects, ASM / artisanal mining signals, technical disclosures, government and cadastre context, research papers, geology, remote-sensing references, infrastructure, and source links so geologists, remote-sensing specialists, and commercial teams can review the opportunity with better context.

This is **not** an AI investment committee and it does **not** claim to predict mineralization. The system does the search, extraction, organization, comparison, and evidence routing. Human experts still make the geological and commercial judgment.

## What We Built

- **License intake workflow:** start from a prepared demo package or paste/upload a coordinate, GeoJSON Point, Polygon, or MultiPolygon.
- **Interactive recon map:** satellite base map with zoom, pan, focus, and reset controls, plus geology and admin overlays with opacity controls.
- **Clickable evidence layer:** blue pins open source-backed evidence cards and links; orange points show nearby public projects; red targets flag possible surface disturbance / artisanal mining candidates for field review.
- **Public-data source room:** grouped references across public companies, papers, government / survey data, remote sensing, ASM, and commercial context.
- **Side-by-side comparison:** compare two packages by source density, nearby anchors, company activity, evidence mix, and data gaps.
- **GPT-5.5 recon brief:** AI structures the evidence into an expert-ready package, highlights missing data, and routes next questions to geologist, remote-sensing, commercial, and field-review teams.

## Why It Matters

The current workflow can take days of manual searching across company PDFs, government portals, cadastre tools, academic papers, maps, and satellite references. Concession Recon compresses that first-pass public-data review into minutes.

The "wow" moment is not that AI says "invest" or "pass." The value is that messy public information becomes a readable evidence package that experts can immediately inspect, challenge, and build on.

## Demo Flow

1. Open **Static Result 2** to show the coordinate-intake use case: someone sent a location near Yamoussoukro.
2. Use **Focus**, zoom, pan, and drag to inspect the satellite base map.
3. Toggle **Sat / Geo / Admin** and adjust opacity to show how geology and administrative context sit over the same land package.
4. Click blue evidence pins to open public source cards and links.
5. Switch to **Static Result 1** for the Yaouré-Kokumbo prepared package.
6. Open the **Compare Panel** to show how GPT-5.5 explains differences in public evidence density and data gaps.
7. Click **Build Evidence Package** to generate the structured recon brief.

Demo routes used in the judging video:

- [Static Result 1: Yaouré-Kokumbo package](http://localhost:3000/?demo=ci-yaoure-kokumbo-aoi)
- [Static Result 2: Yamoussoukro coordinate intake](http://localhost:3000/?demo=static-yamoussoukro-point)

## How GPT-5.5 Is Used

GPT-5.5 acts as an evidence analyst, not a decision maker. It helps:

- extract useful facts from public-source snippets and technical references;
- separate direct evidence from regional context;
- summarize nearby company activity and disclosed work;
- identify missing data and verification questions;
- produce team-specific next-step queues for geology, remote sensing, commercial / BD, and field review;
- compare two land packages by evidence differences rather than ranking them as investments.

## Demo Access

This hackathon submission is designed to be judged from the recorded demo video and the GitHub repository. The app is a Next.js prototype with cached public-source packs, so judges can also run the same demo locally if they want to inspect the workflow.

GitHub Pages is not assumed for this build because the app uses Next.js runtime routes and optional live AI/search flows. A static export could be added later, but the reliable submission path is video + repo + local reproduction.

To run locally:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

For live AI/search flows, create `.env.local`:

```bash
OPENAI_API_KEY=...
EXA_API_KEY=...
BRAVE_API_KEY=...
```

The demo includes cached public-source packs so it remains reliable during judging even if external websites, PDFs, search APIs, or live model calls are slow.

## Source Categories

The Côte d'Ivoire demo uses public-source examples from:

- public-company disclosures and project pages;
- technical reports, drilling updates, and presentations;
- Côte d'Ivoire mining cadastre / Landfolio context;
- SODEMI and government / survey references;
- EITI and mining-sector context;
- academic and remote-sensing papers on ASM / artisanal mining;
- nearby mines, cities, infrastructure, belts, trends, and shear-zone context.

## Positioning

**One sentence:** Concession Recon helps mining teams quickly understand what public evidence exists around a license package, so geologists and commercial teams can make a more informed next move.

Please do not describe the project as automated investment scoring, GO / NO-GO recommendation, or mineralization prediction.
