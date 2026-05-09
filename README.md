# West Africa License Recon

West Africa License Recon turns a Côte d'Ivoire license package, coordinate, or polygon into a map-backed public evidence stack and shared research library for geologists, remote-sensing specialists, and commercial teams. The current demo focuses on Yaouré–Kokumbo package blocks and coordinate intake, using nearby public-company, government, geological-survey, institutional, remote-sensing, ASM, and research-paper evidence. The tool packages public information for expert review; it does not make investment decisions or determine mineralization.

## Local Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Demo Path

1. Select the Côte d'Ivoire Yaouré-Kokumbo license package.
2. Review the map views for satellite context, SEMS/WAGP geology, admin/license context, public projects, ASM/pits, same-trend context, cities, and data gaps.
3. Use the **Research Library / Data Room** rows to brief Geologist, Remote Sensing, and Commercial teams from the same evidence pack.
4. Click **Build Evidence Package**.
5. Read the **Expert Work Queue** and source-backed evidence package.

## Environment Variables

Create `.env.local` when running live AI flows:

```bash
OPENAI_API_KEY=...
BRAVE_API_KEY=...
```

`OPENAI_API_KEY` powers evidence extraction and expert-route generation. `EXA_API_KEY` powers public research/source discovery; `BRAVE_API_KEY` is an optional search fallback. The demo is designed to remain usable without live search.

## Cached Public Sources

The hackathon demo uses cached public-source excerpts in `src/data/source_packs.json` so the evidence stack and data room stay reliable during live demos even when external search, websites, research papers, technical reports, or PDFs are slow or unavailable.
