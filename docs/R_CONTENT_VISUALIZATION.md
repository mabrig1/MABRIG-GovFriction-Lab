# GovFriction Lab: R Statistics, Computational Content Analysis and Visualization (v0.5)

## Overview

The new laboratories are additional workflows within the existing Cloudflare Worker application. The backend remains a real Cloudflare Worker with environment variables and optional D1 binding. Individual CSV records remain in the browser. The new analyses do not require storing cases in the Cloudflare backend.

- **R Statistics Lab** — base R executed through optional [webR](https://docs.r-wasm.org/webr/latest/), pinned to webR 0.6.1 and downloaded only on user request. Up to 10,000 rows per browser session.
- **Computational Content Analysis** — deterministic English-oriented Unicode word segmentation, frequency counts, bigrams, sum TF-IDF, and an explicit user-defined dictionary of themes. It runs in a dedicated local CPU Worker. Up to 3,000 text records and 1.8 million source characters.
- **Visualization Engine** — local accessible SVG graphics for bar charts, line charts, scatterplots and histograms. Download the SVG and the plotted data as CSV. No remote image service is used.

These are practical research capabilities, not an unrestricted RStudio, Kaggle notebook, NLP transformer, topic-modeling service, or causal scientific instrument.

## R Statistics Lab

Upload any CSV, then use **R Stats → Variable View** to inspect numeric/categorical classifications, missing counts and distinct categories. Numeric types are inferred strictly from nonmissing values; a column with mixed text and numbers is flagged. Define a new numerical variable using arithmetic between existing columns or with a constant. Division by zero and nonnumeric cells produce missing values, not fabricated zeros. Derived columns are held only in the browser; download the modified CSV explicitly. Modifying data invalidates the original source SHA-256, descriptive audit, and Kaggle comparison. For formal comparison, reimport a frozen, exported modified CSV and re-run.

Choose supported base-R tests:

| Test | Variables | Base R method | Assumptions to examine |
|---|---|---|---|
| Descriptive summaries | numeric X | summary, mean, sd, t.test mean CI | Representative data, confidence interval interpretation |
| Pearson correlation | numeric X,Y | cor.test Pearson | Linearity, outliers, independent observations |
| Spearman correlation | numeric X,Y | cor.test Spearman | Monotonic association, ranks, ties |
| Welch t-test | numeric Y, two-level group | t.test | Independent groups, outliers, distribution assumptions |
| One-way ANOVA | numeric Y, group | aov | Independent observations, residual assumptions, variance differences |
| Linear regression | numeric X,Y | lm | Residual diagnostics, linearity, noncausal coefficients |
| Pearson chi-square | categorical X, group | chisq.test | Independence, expected-count thresholds |

For chi-square, if any expected cell is below 1 or over 20% of expected cells are below 5, the asymptotic p-value is **withheld**. Consider Fisher exact or Monte Carlo in a separate, documented analysis. Group and case size validation fail closed rather than running uninterpretable tests.

**webR execution:** On clicking "Run in R", the browser downloads the pinned webR runtime from webr.r-wasm.org. No data are sent to GovFriction Lab's API; the external runtime source is a code dependency and should be trusted and audited for production deployment. The actual numerical work is performed in the user's local browser. Offline or blocked-network users can download the generated base-R script and run it in desktop R. The script embeds the selected data values; store it securely.

No custom arbitrary R code editor is offered. The user selects a predefined method; the engine produces a reproducible script with safely quoted literal values.

## Computational Content Analysis

Upload a CSV that contains a text field (e.g., a complaint summary, policy paragraph, public report excerpt). The synthetic demo contains an explicitly fabricated `public_summary` column.

The analyzer computes:
1. Corpus size, usable and missing documents, tokens and distinct terms.
2. Case-folded, Unicode-aware token frequencies with a fixed English stopword list and configurable minimum token length.
3. Adjacent token bigrams (after stopword filtering).
4. Document-frequency-adjusted TF-IDF, using: tf = term frequency / eligible tokens in the document, idf = ln((1+N)/(1+df))+1, and scores summed across documents.
5. Transparent thematic coding: enter lines of the form `Service access: waiting, service delay, slow response`. Match counts include whole token sequences, not semantic inference. The report includes hits per theme, documents containing any match and percentage of nonempty documents.

Output is an aggregate JSON report, without source document text. It does not infer sarcasm, negation, policy intent, or cross-lingual meaning. Validate thematic coding with a published codebook, at least two independent human coders and an agreement statistic before reporting findings as reliable thematic classifications. Co-occurrence may reflect repetitive boilerplate; TF-IDF does not establish topic or evidence quality.

Sensitive or identifying text should be removed before uploading into any shared system; although this tool processes locally, users must still ensure informed consent, disclosure rules and secure client devices.

## Visualization Engine

Sources: uploaded dataset, content-analysis word frequencies, CPU monthly trends and BFS-DAI group outcomes (only after those have been calculated). Choose bar, line, scatter or histogram, with variables selected from available columns. Bar charts count group records or show group mean(Y). Line charts order numeric-looking X labels and may average numeric Y within each X category. Scatterplots require two numeric columns and are capped at 2,000 points. Histograms bin a numeric X into up to 16 bins.

The SVG is generated through DOM text nodes and SVG attributes (no HTML injection). Download chart SVG and plotted series CSV. Charts are descriptive, not independent statistical tests. Nonresponse and suppressed cells must be handled explicitly in publications.

## Verification

- npm test — formulas, input validation, derived variables, theme counts, code generation, chart construction, prior predictive/BFS-DAI/CPU Workbench checks.
- npm run build — asserts new modules and UI controls exist.
- CI Wrangler deploy --dry-run — verifies Cloudflare Worker and assets bundle; no deployment action.
- Browser smoke test with the synthetic demo — validates interface wiring, including R code export (does not automatically execute the external webR binary).
- Real webR execution and Kaggle-to-R results must still be manually validated with a frozen public dataset and documented R version before publication.

## Research status and next stage

The laboratories enhance research usability. Scientific validation requires data-specific benchmarking: test with authentic frozen NYC 311 records and a separately executed R and Python reference, not only with synthetic examples or unit tests. For NLP coding, publish an independent codebook and inter-coder agreement analysis. For graphics, inspect quantitative axes and avoid overstating causal or institutional effects.

**Never claim that a generated theme is an independently verified finding or that matching R code implies statistical validity.**
