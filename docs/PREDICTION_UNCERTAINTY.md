# Held-out prediction uncertainty: paired UTC-day cluster bootstrap

**Research maturity:** Exploratory browser-based protocol addendum for MABRIG GovFriction Lab. Not official agency evaluation, causal evidence, or certification of predictive accuracy.

## The question addressed

After the existing leakage-safe temporal split, models are evaluated on the same later **held-out** service requests. The app already reports accuracy, ROC-AUC, Brier score and log loss. This addendum asks: *How unstable could a model's held-out Brier score and its apparent improvement over a training-prevalence baseline be if the set of test days varied?*

The Brier score for a probability p and binary label y is (p - y)^2. Lower is better. Improvement is defined as **baseline Brier minus candidate-model Brier**; positive means lower observed Brier error, but does not prove generalizability.

## Frozen, reproducible protocol

1. Keep the original training/embargo/holdout periods and all fitted model coefficients **unchanged**. No additional tuning or refitting is performed during interval estimation.
2. Obtain the **same held-out requests** and fixed predictions for baseline, logistic regression and categorical Naive Bayes. Do not include outcome status or any future-only features in the model inputs.
3. Group test requests by their **UTC calendar creation date**. Each group is one observed day, preserving all same-day requests together.
4. If the holdout has fewer than **8 distinct dates**, report *estimate withheld*. A low count of distinct dates is not a defensible basis for this exploratory day-cluster resampling.
5. For **499** replicates using a deterministic random generator with seed **20261120**, sample the observed days with replacement, with the number of draws equal to the number of unique test days. Within each chosen day, include all records and their saved predictions.
6. For each resample, compute Brier scores for all models and **paired** baseline-minus-model Brier differences from the exact same sampled days.
7. Report observed held-out Brier, observed Brier improvement, and the **2.5th–97.5th percentile** of the fixed-seed bootstrap distributions. The interval is an *exploratory 95% percentile interval*, not a confirmed confidence guarantee.
8. Include distinct days, sample size, replication count, seed and caution in the research JSON export. Per-case probabilities are **not added to the exported report**; only aggregate metrics and intervals are returned.

This approach resamples day clusters rather than treating same-day requests as independent. It is computationally inexpensive: loss totals for each day are pre-aggregated, so bootstrapping does not require rebuilding the models or transmitting requests to a server.

## Limits and interpretation

- **Cross-day serial correlation is not captured.** A moving/block bootstrap on sufficiently long time windows, and multi-origin temporal validation, are more defensible if there is substantial autocorrelation. A three-month pilot can be too short for robust long-block resampling.
- Training-stage variability, hyperparameter selection, drift, unknown confounding and measurement error are **not represented**.
- Clustered percentile intervals may be unreliable with very few days, highly imbalanced clusters, sparse outcome classes or extremely skewed daily volumes. The eight-day threshold is a guardrail, not a power calculation or guarantee.
- The baseline must remain fitted on **training only**. The model must be compared on the exact same test cases.
- These intervals are **not p-values**; a positive lower bound should not be labelled a definitive significant model advantage without a suitable preregistered inferential protocol.
- The test only uses known documented nonclosure within a follow-up horizon, not physical service completion.
- Synthetic examples are **not** evidence of real Nigerian or NYC performance. Independent Kaggle results still must match a frozen dataset SHA-256 and declared temporal split before drawing any empirical conclusion.

## Reproduce

From the project root:

\`\`\`bash
node tests/test_prediction_uncertainty.mjs
npm test
npm run build
\`\`\`

The implementation is \`web/prediction-uncertainty.mjs\` (no external library or network access) and the field \`uncertainty\` is included in prediction JSON exports. The on-screen table in **Predict** explains Brier improvement direction, uncertainty interval and limitations. The existing independent Kaggle metrics comparison is **not modified**; independently validating bootstrap intervals in Python remains a subsequent research step.

## What to do before publication

Freeze and document the actual source CSV and its checksum; independently implement the identical paired day resampling in Kaggle Python; reconcile results and dates; assess time dependence; repeat evaluation over rolling-origin splits when enough longitudinal data exist; investigate subgroup error and fairness; and document ethical approval and data provenance as required.
