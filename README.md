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

## Deploy to Cloudflare Workers with editable variables

**This is an actual Cloudflare Worker with JavaScript server runtime**, not static-only hosting. The website remains bundled as static assets. The server script is at src/index.mjs; API requests run the Worker first. Public endpoints: GET /api/health and GET /api/config; bounded server computing endpoint: POST /api/analysis/contingency.

Cloudflare configuration (wrangler.toml):

    name = "mabrig-govfriction-lab"
    main = "./src/index.mjs"
    compatibility_date = "2026-11-19"

    [assets]
    directory = "./web"
    binding = "ASSETS"
    not_found_handling = "single-page-application"
    run_worker_first = ["/api/*"]

    [vars]
    APP_MODE = "research-pilot"
    ENABLE_SERVER_ANALYTICS = "true"
    MAX_AGGREGATE_GROUPS = "12"

**Deployment:** In Cloudflare Dashboard, confirm this GitHub repo is connected to the existing Worker named mabrig-govfriction-lab. Keep build command npm run build and deploy command npx wrangler deploy at the repo root. Alternatively, authenticate Wrangler to the intended Cloudflare account and run npx wrangler deploy. Do not inadvertently create a second Worker. Verify that https://govfriction.mabrigkorie.org/api/health returns JSON identifying cloudflare-worker before calling the update live.

**Add variables:** Cloudflare Dashboard → Workers & Pages → mabrig-govfriction-lab → Settings → Variables and Secrets. Add the nonsecret variables above or manage them in wrangler.toml; if changing dashboard values also reconcile Wrangler configuration to prevent a future Git deployment overwriting them. Encrypted secrets for *future* integrations may include OPENROUTER_API_KEY and ADMIN_TOKEN; neither is used by this MVP. Add secrets in the dashboard or using npx wrangler secret put OPENROUTER_API_KEY. Never check secret values into Git or echo them through an API response.

**Optional database:** D1 binding DB is not required for this version. If a database is created in Cloudflare, use its real UUID and name in the Wrangler database binding and redeploy. The current project never writes user records to D1 simply because the DB binding exists.

**CPU limitations:** Workers Free currently has a 10 ms CPU budget per request. The server therefore accepts up to 16 KiB of *aggregate group counts only*, computing chi-square, Cramér V and risk differences. Larger audits, trends, survival and classification are processed in a browser CPU Worker. This is not a Python/Jupyter Kaggle instance.

**Data privacy:** Individual request records are never uploaded to the Worker API. For the optional Cloudflare statistical test, the user must first explicitly consent to send group counts for a selected service; no request body is stored by the app. Aggregated cells can still disclose sensitive patterns, so assess data sharing permissions before opting in.

See docs/CLOUDFLARE_WORKER.md for verification and security boundaries.

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
## Predictive statistical modelling (v0.3 preview)

The **Predict** section appears after a successful audited descriptive analysis. Select **Evaluate predictive models** to score *recorded nonclosure by the selected follow-up horizon* using three explicit methods: training-prevalence baseline, L2-regularized logistic regression and categorical Naive Bayes. Models run entirely in the user's browser and use only service category, borough and creation-time weekday/hour.

The web app automatically separates earlier training data from later held-out requests, with a full follow-up horizon gap to ensure training outcomes were knowable at test time. If there are too few records or outcomes, it refuses to report model accuracy. Displayed metrics include accuracy, balanced accuracy, recall, precision, ROC-AUC, Brier score, log loss, confusion matrices in the JSON export and five probability-calibration buckets. It also exposes logistic odds ratios and study-window metadata.

**Do not claim results are scientifically validated yet.** The synthetic demo is not an NYC prediction study. High accuracy from an imbalanced test set is insufficient; models must be evaluated against the baseline and later independent real data. Group-level coefficients are not causal findings. The pilot includes neither composite score confidence intervals nor external validation.

For Kaggle, open `reference/GovFriction_Predictive_Kaggle.ipynb` and add the **exact same frozen CSV** as input. Run the notebook on CPU. It produces `prediction_kaggle_metrics.csv`, `prediction_kaggle_calibration.csv`, and `prediction_kaggle_manifest.json`. These reference estimators use scikit-learn, so small software-specific differences from the web app are expected. Verify dataset SHA, split dates, cohort audit, and interpretable metric differences; no identical numeric prediction claim is made.

The full research protocol, split definition, prohibited features and additional validation requirements are documented in [docs/PREDICTION_PROTOCOL.md](docs/PREDICTION_PROTOCOL.md).

## CPU Research Workbench v0.4

After the BFS-DAI audit, open CPU Lab and run advanced CPU analysis. A dedicated browser CPU thread calculates borough nonclosure rates, Wilson confidence intervals, monthly trends and Kaplan–Meier time-to-recorded-closure summaries. Download the derived results as JSON. With explicit consent, send aggregated counts for a lightweight Cloudflare Worker chi-square association test; no individual records are sent.

These methods are not yet a general-purpose SPSS/Python environment or evidence of predictive accuracy equivalent to Kaggle. Longer source windows and independent notebook checks remain research requirements.

## R Statistics + Content Analysis + Visualization Engine (v0.5)

The homepage has three new research workspaces that share the existing CSV dataset:

- **R Stats:** detect numeric and categorical columns, inspect missingness, add derived numeric variables, and perform base-R descriptive statistics, Pearson/Spearman correlations, Welch t-tests, ANOVA, ordinary least squares regression, and chi-square association tests. Actual R runs in the browser using optional [webR](https://docs.r-wasm.org/webr/latest/), downloaded on first use. Export the complete generated R script to reproduce the test on desktop R. In-browser pilot limit: 10,000 rows.
- **Content Analysis:** select any text column from the CSV; calculate corpus size, token counts, unigrams, bigrams, TF-IDF, and dictionary-coded themes with explicit keyword/phrase rules. The example dataset includes a synthetic public_summary text column. This is transparent lexical coding, not LLM topic inference. Save an aggregate JSON report without original text. Pilot limit: 3,000 documents and 1.8 million characters.
- **Charts:** select uploaded data, content term frequencies, CPU monthly trends, or BFS-DAI group scores. Create bar, line, scatter or histogram charts using selectable X and Y variables; export SVG and plotted data CSV. Visuals are local and do not require an image API.

**Data integrity:** Adding a variable changes the in-memory dataset and invalidates the original source SHA-256 and existing study results. Download the revised dataset and re-import it as a new frozen source before benchmarking with Kaggle/R. R scripts embed selected source values and should be stored securely.

**Cloudflare architecture:** The project remains an actual Worker (src/index.mjs) with environment variables and ASSETS binding. Browser-side webR and text visualization do not require server-side R installation or additional Cloudflare secrets. webR's runtime is loaded from a pinned external origin at user request; a production hardening option is self-hosting vetted runtime assets.

**Validation:** JS analytical tests and browser smoke checks cover exports and UI. The R runtime's first-load execution still requires a browser acceptance check on the final Cloudflare deployment. Independent reproduction on authentic frozen data is required for scientific publication.

Read [the R, computational content and visualization protocol](docs/R_CONTENT_VISUALIZATION.md) for statistical assumptions and methodology.

## New: uncertainty around held-out prediction accuracy (development preview)

The Predict panel now reports **exploratory 95% percentile intervals for held-out Brier error** and paired **Brier improvement versus the training-prevalence baseline**. This helps distinguish a lower point estimate from a more reliable result. It does not claim statistical significance or certified predictive accuracy.

- Samples complete held-out UTC creation-day clusters, preserving within-day grouping; never retrains or tunes a model on test outcomes.
- Uses 499 deterministic resamples (seed 20261120), with the same sampled days for all three models.
- Requires at least 8 distinct held-out days; otherwise the interval is withheld with an explanation.
- Reports confidence-like ranges **conditional on the frozen model**; intervals do not account for cross-day temporal dependence, training-stage variance, fairness or distribution shift. Do not infer causality or external validity.
- Runs locally in the browser CPU worker, without sending case records to a server, and adds only aggregate interval fields to exported JSON. It does not export per-case probability predictions.

See [docs/PREDICTION_UNCERTAINTY.md](docs/PREDICTION_UNCERTAINTY.md). Independent Kaggle replication of the intervals remains a separate validation requirement.
