# MABRIG GovFriction Lab

An accessible, local-first research web app for the **Bureaucratic Friction & Service-Delivery Asymmetry Index (BFS-DAI)**. Built as a computational public-administration research prototype by MABRIG Technologies.

**Research status:** Pilot and preliminary measurement framework. This is not an official government rating or a validated causal measure. The demonstration is synthetic and must not be reported as a real NYC finding.

## Try the web app

1. Open the deployed website, or run a local web server.
2. Choose **Explore synthetic example** then **Run audited analysis** to learn the workflow.
3. For real research, upload a frozen administrative CSV and confirm the column mapping.
4. Examine eligibility/exclusion counts, service-by-borough results, scores, and visual comparison.
5. Download the group CSV and the JSON research record.
6. Use the same exact frozen CSV with the independently coded Kaggle notebook and import the notebook's output to compare results by SHA-256 and numerical tolerances.

Raw upload data remain in the browser tab. No login, analytics tracker, server upload, D1 database, paid AI model or API token is necessary.

## Run locally

From the repository root:

    npm test
    npm run build
    python -m http.server 8000

Open http://localhost:8000/web/

The website works without a Node build pipeline or npm runtime dependencies. HTTPS or localhost is recommended for SHA-256 browser support. Direct file:// access may block JavaScript modules or secure cryptography.

## Download genuine NYC 311 pilot data

From an internet-connected computer:

    python reference/fetch_nyc311.py --output data/nyc311_dsny_2025_q1.csv

This retrieves the January–March 2025 DSNY graffiti/missed collection cohort from the official NYC 311 API and produces a source manifest with SHA-256. If the API fails or returns no records, the downloader fails rather than fabricating results.

Exploratory truncated sample only:

    python reference/fetch_nyc311.py --max-records 1000

Do NOT use a truncated sample for full-cohort scientific claims. Source: https://data.cityofnewyork.us/Social-Services/311-Service-Requests/erm2-nwe9

## Reproduce independently in Kaggle

1. Go to https://www.kaggle.com/code and create a notebook.
2. Upload the exact frozen CSV as an input dataset.
3. Run reference/GovFriction_Kaggle_Reference.ipynb on CPU. GPU is unnecessary.
4. Download the produced kaggle_results.csv and kaggle_results.manifest.json.
5. Back in the web app, first analyze the same CSV; then upload kaggle_results.csv under **Validate with Kaggle**.

The browser engine does not import the notebook's Python calculations. The validation checks input hashes, group coverage and numerical tolerances. Matching outputs are implementation consistency, NOT proof of construct validity.

## Deploy to Cloudflare Workers

The repository includes wrangler.toml configured for static assets in the web/ directory. No D1 database or Worker secret is required.

In Cloudflare Dashboard: Workers & Pages → Create application → import this GitHub repository (mabrig1/MABRIG-GovFriction-Lab) → select the main branch. Set Worker name to **mabrig-govfriction-lab** to match wrangler.toml. Configure:

- Build command: npm run build
- Deploy command: npx wrangler deploy
- Root directory: repository root
- Output assets: handled by wrangler.toml at ./web

Alternatively, from an authenticated local terminal run:

    npx wrangler deploy

Before deploying, verify the Cloudflare account and existing Worker name; avoid accidentally replacing another project. Pushing to GitHub does not itself guarantee a live Cloudflare site.

## Research boundaries

- Default scope: DSNY, two service categories (Graffiti / Missed Collection (All Materials)), NYC five boroughs, requests created January–March 2025.
- Closure means a documented closed_date, not physical service resolution.
- Friction F = half the proportion not closed by day 30 plus half the normalized restricted delay burden.
- Peer asymmetry A = absolute friction difference against all OTHER boroughs handling the SAME service.
- BFS-DAI = 100 × (w × F + (1−w) × A), initially w=0.70.
- Groups below 10 eligible records or with fewer than 10 comparable peers are not scored.
- Weights, minimums and horizon are exploratory. No causal claims or cross-service performance rankings are warranted.
- Composite-score uncertainty, external validity and usability studies remain future phases.

Read docs/METHODS.md for protocol details and limitations.

## Source layout

- web/ — HTML, responsive CSS, app controls and independent JavaScript analysis engine
- reference/GovFriction_Kaggle_Reference.ipynb — independent validation notebook
- reference/fetch_nyc311.py — official-source downloader and checksum manifest
- docs/METHODS.md — initial frozen pilot protocol
- tests/ — automated analytics tests
- scripts/ — web asset and notebook checks
- .github/workflows/ci.yml — GitHub Actions checks
- wrangler.toml — Cloudflare Workers static assets

© 2026 MABRIG Technologies · Exploratory research software.