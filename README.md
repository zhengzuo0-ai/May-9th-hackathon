# West Africa License Recon

West Africa License Recon is a public-data intelligence workbench for early mineral license review in Côte d'Ivoire. When someone sends a license package, coordinate, polygon, or GeoJSON, the app turns it into a map-backed evidence package for geologists, remote-sensing specialists, and commercial teams.

The demo focuses on the Yaouré-Kokumbo / Yamoussoukro area and assembles public-company disclosures, government and cadastre context, geological-survey references, research papers, ASM / artisanal mining studies, remote-sensing references, infrastructure context, and nearby same-trend comparables.

The product does **not** make investment decisions and does **not** claim to determine mineralization. Its job is to organize public evidence so experts can decide what to review next.

## What It Shows

- **Static Result 1:** a prepared Yaouré-Kokumbo multi-license package.
- **Static Result 2:** a prepared coordinate-intake result near Yamoussoukro.
- **Live Intake:** paste or upload a coordinate, GeoJSON Point, Polygon, or MultiPolygon and create a small license-style package.
- **Zoomable Map:** satellite base map with zoom, pan, focus, and reset controls; geology and admin overlays stay aligned while zoomed.
- **Evidence Pins:** public-company projects, ASM / disturbance references, research sources, government sources, and cities are clickable.
- **Compare Panel:** side-by-side package comparison by source density, map anchors, public-company activity, evidence mix, and data gaps.
- **GPT-5 Evidence Package:** OpenAI is used to structure evidence, surface gaps, and produce an expert work queue rather than a GO / NO-GO recommendation.

## Local Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Useful demo URLs:

- [Static Result 1](http://localhost:3000/?demo=ci-yaoure-kokumbo-aoi)
- [Static Result 2](http://localhost:3000/?demo=static-yamoussoukro-point)

## Demo Path

1. Open **Static Result 2** to show the "someone sent us a coordinate" workflow.
2. Use **Focus**, `+`, `-`, and drag to inspect the satellite map around the package.
3. Toggle **Sat / Geo / Admin** and adjust opacity to compare satellite, geology, and admin context.
4. Click a nearby project or evidence pin, such as Kobo Kossou, to open the source card and source link.
5. Open the **Compare Panel** to explain public evidence deltas between the two prepared packages.
6. Click **Build Evidence Package** to generate a structured recon brief for geologist, remote-sensing, commercial, and field-review teams.

## Environment Variables

Create `.env.local` when running live AI flows:

```bash
OPENAI_API_KEY=...
EXA_API_KEY=...
BRAVE_API_KEY=...
```

`OPENAI_API_KEY` powers evidence extraction and expert-route generation. `EXA_API_KEY` powers public research/source discovery; `BRAVE_API_KEY` is an optional search fallback. The demo is designed to remain usable without live search.

## Public Sources

The hackathon demo uses cached public-source excerpts in `src/data/source_packs.json` so the evidence stack and data room stay reliable during live demos even when external search, websites, research papers, technical reports, or PDFs are slow or unavailable.

Key source categories include:

- Kobo Resources Kossou project disclosures and drilling updates.
- Perseus Yaouré public project and technical context.
- Côte d'Ivoire Mining Cadastre / Landfolio context.
- SODEMI geoscientific data references.
- EITI and government mining-sector context.
- Kokumbo and Bandama ASM / remote-sensing research papers.

## Demo Positioning

The right way to describe the product:

> Concession Recon helps a team quickly understand what the public world already says about a land package and its surrounding trend, so geologists and commercial teams can make a more informed next move.

Avoid describing it as an AI investment committee, automated concession scoring system, or mineralization predictor.
