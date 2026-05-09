# West Africa AOI Intelligence

West Africa AOI Intelligence turns a selected Côte d'Ivoire exploration AOI into a map-backed evidence stack, shared research library, and GPT-5.5-assisted expert review route. The current demo focuses on the tighter Yaouré–Kokumbo central Côte d'Ivoire cluster, where public-company, government, geological-survey, institutional, and research-paper evidence is close enough to be useful. Evidence is weighted by geological relationship: a project or paper on the same shear zone, structural corridor, or mineralized trend matters more than raw distance alone.

## Local Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Demo Path

1. Select the Côte d'Ivoire Yaouré-Kokumbo AOI.
2. Review the map layers for public projects, source packs, remote sensing, ASM/pits, geology/structure, same-trend context, cities, and data gaps.
3. Use the **Research Library / Data Room** rows to brief Geologist, Remote Sensing, and Commercial teams from the same evidence pack.
4. Click **Run AOI Recon**.
5. Read the **AOI Triage** and **Expert Review Route**.

## Environment Variables

Create `.env.local` when running live AI flows:

```bash
OPENAI_API_KEY=...
BRAVE_API_KEY=...
```

`OPENAI_API_KEY` powers evidence extraction and expert-route generation. `EXA_API_KEY` powers public research/source discovery; `BRAVE_API_KEY` is an optional search fallback. The demo is designed to remain usable without live search.

## Cached Public Sources

The hackathon demo uses cached public-source excerpts in `src/data/source_packs.json` so the evidence stack and data room stay reliable during live demos even when external search, websites, research papers, technical reports, or PDFs are slow or unavailable.
