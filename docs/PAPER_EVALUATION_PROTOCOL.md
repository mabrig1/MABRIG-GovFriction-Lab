# BFS-DAI paper: performance evaluation protocol (draft, 2026-11-25)
## Working title
Making Administrative Friction Measurable: Development, Computational Implementation, and Performance Evaluation of the Bureaucratic Friction and Service-Delivery Asymmetry Index (BFS-DAI).
## Design
A methodological and computational evaluation paired with a retrospective secondary-data study. Prior development and exploratory synthetic tests have occurred; this is not a claim of retrospective preregistration. Freeze empirical analysis decisions before interpreting results. The index measures documented processing, not citizen-experienced burden or actual physical service resolution. Distinguish theory, numerical correctness, robustness, criterion validity and usability.
## Evaluation matrix
E1 numerical correctness: compare independently implemented Python against the Chromium JavaScript engine on identical bytes; exact audit counts, group keys, sizes, ranks; absolute tolerance 1e-9 for component values and 1e-7 for score; compare all 30 specifications. Null suppression must agree. Fail on missing groups or mismatched hash.
E2 computational performance: generated synthetic fixtures (1k/10k/50k base records plus seven deliberately problematic rows); one warm-up and five measured repetitions; report median and individual times for CSV parse, primary with protocol, and sensitivity; record browser, OS, CPU, memory, runtime, commit. This is controlled module timing, not comparative throughput or whole-UI responsiveness.
E3 auditability: verify raw byte hash including BOM/CRLF, parsed/malformed count, primary exclusion counts, frozen protocol match, synthetic labels and export table row coverage. Add full export round-trip and user-interface task tests later.
E4 local processing: instrument browser request events after module load and through the computation; zero requests expected. This is not a full privacy or security audit; separately test UI upload, optional server actions, third-party assets and network policies.
E5 empirical robustness: official NYC 311 DSNY Q1 2025, 30 days and .70 primary weight; 15/30/45/60/90 days, six friction-vs-asymmetry weights; report raw components, signed gap, rank changes, group coverage and common-cohort sensitivity separately. Index weights are provisional. Compare with unweighted component indicators and friction alone; do not equate disagreement with improved validity.
E6 incremental value and uncertainty: test whether index changes interpretation of conventional indicators; examine redundancy and bootstrap with justified dependence units, peer-pool uncertainty, external city/time-period validity. No claims until done.
E7 practical utility: preregister a paired task study comparing app workflow and a conventional scripted workflow (same data and tasks, counterbalanced order, independent audit rubric, errors and completion time); ethics review if recruiting participants. Do not infer usability superiority from parity or core timing.
## Data acquisition and run
Use Python 3.12, Node 22, Chromium Playwright. From repo root:
```sh
npm install --no-save playwright@1.56.1
npx playwright install chromium
python reference/fetch_nyc311.py --output data/nyc311_dsny_2025_q1.csv
python -m http.server 8788 --bind 127.0.0.1
```
In another shell run the following (POSIX example):
```sh
GOVFRICTION_EVIDENCE=synthetic-evaluation.json node scripts/evaluate_bfs_dai.mjs
GOVFRICTION_CSV=data/nyc311_dsny_2025_q1.csv GOVFRICTION_MANIFEST=data/nyc311_dsny_2025_q1.source.json GOVFRICTION_EVIDENCE=empirical-evaluation.json node scripts/evaluate_bfs_dai.mjs
```
Default observation cutoff is 2026-11-19 (v0.1). Verify it against the manifest; later extraction does not reconstruct historical source status. The downloader is not a transactionally frozen API snapshot: verify counts, IDs, coverage, category labels and pagination drift independently. Archive extracted bytes privately and share only allowed aggregates or governed data as appropriate. No row records are in the evaluation JSON. Use exact fixed official headers; the independent reader is not a general alternate-city parser.
## Publication gates
Evidence from synthetic CI is engineering evidence only. Real-source parity is a separate gate. No empirical result, performance advantage, external validity, DOI, or journal acceptance is asserted. Independent human replication and peer review remain outstanding. Disclose software authorship, funding, conflicts, AI assistance and data limitations. Do not publish identifying request IDs. 
## Initial manuscript plan
Introduction: separate service-request processing friction from administrative burden; motivate transparent indicators with administrative records.
Conceptual framework: time-to-documented-closure, nonclosure, within-service geographic comparison; distinction between absolute disparity and direction.
Methods: exact BFS-DAI v0.1 formula, audit, cutoff, group threshold, data provenance, benchmark design and independent reference.
Results: table of eligibility; component estimates; sensitivity; computational agreement; runtime; audit/network evidence; limitations. All values pending actual execution and evidence.
Discussion: added analytical utility only if shown; implications for public administration and reproducible governance research.
