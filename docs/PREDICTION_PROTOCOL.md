# Predictive statistical models — preregistration-style protocol v0.1

## Question and intended prediction time

**Outcome:** Whether a NYC 311 service request is **not recorded as closed within 30 days** of its creation. This is a statistical description of closure records, not verified service delivery, complaint severity, or citizens' experiences.

**Prediction time:** At request creation. No operational information observed after that moment may enter the predictor set.

**Approved predictors:** 311 service category, borough, weekday and hour of creation. Borough and service are categorical; weekday/hour are cyclically encoded in logistic regression. Agency is constant (DSNY) in the original pilot.

**Prohibited predictors:** Closed Date, Status, resolution notes, updated dates, recorded turnaround time, complaint outcomes, subsequent workload or any features derived from the target or from future records.

## Training and out-of-time holdout

Work only from the full, frozen dataset and preserve its SHA-256. Restrict scope and exclusions to the descriptive BFS-DAI audit. Require a complete 30-day follow-up after creation before determining a label.

For a study window with total calendar days D:
- Holdout starts at start + floor(2D/3) days and ends at the original study end.
- Training ends **exclusively** at holdout start minus the full follow-up horizon.
- The intervening records form an explicit **embargo gap**. Their labels are not used for training or evaluation.
- The 30-day outcome of every training record must be knowable by the start of the holdout period.
- Require >=40 training records and >=20 holdout records, with at least 3 outcomes of each class in training and at least 2 of each class in testing. If not, report **cannot estimate**, not a fabricated accuracy.
- Deduplicate request IDs, exclude invalid dates, impossible closure before creation, out-of-scope services and locations, and immature follow-up. Verify counts against the descriptive engine.

For the default January–March 2025 window and 30-day horizon, the holdout starts March 2, 2025, with training ending January 31, 2025 (exclusive). The February/early-March interval is embargoed.

## Models and hyperparameters

1. **Historical-rate baseline:** Predict the proportion of late/nonclosed requests observed in training for every holdout request.
2. **L2-regularized binomial logistic regression:** Intercept; Graffiti indicator (Missed Collection baseline), four borough indicators (Bronx baseline), weekday sine/cosine and hour sine/cosine. Train with 240 deterministic full-batch gradient updates, learning rate 0.65/sqrt(1+step/120), and mean logistic loss plus 0.03/2 × squared non-intercept coefficients. No holdout parameter tuning.
3. **Categorical Naive Bayes:** Service, borough, weekday and six-hour period. Unit add-one smoothing within each categorical feature and binary class. This model deliberately imposes a conditional-independence assumption which may be unrealistic.

The Python reference implementation should use independently coded data processing and established scikit-learn estimators. Different optimization and prior conventions can create small legitimate numerical differences, so matching settings and checking held-out cases and trends matters more than asserting identical software output.

## Evaluation

Holdout metrics must include accuracy and **balanced accuracy** at a predeclared 0.50 threshold; precision and recall for **nonclosure**; ROC-AUC; Brier score; log loss; confusion matrix; and 5-bin predicted-vs-observed calibration summaries. Report training/holdout prevalence, sample sizes, date split, excluded records and dataset SHA-256.

- High accuracy may simply reflect a frequent majority class. Always compare against the prevalence-only baseline.
- ROC-AUC reflects ranking discrimination, not probability reliability.
- Brier and log loss evaluate the quality of predictive probabilities; calibration bins reveal differences between predicted and observed rates.
- No claim of accuracy improvement without out-of-time results beating the baseline; no deployment or individual-level automation from this pilot.

## Required next validation for publication

- Independent reproduction on Kaggle with exact same frozen CSV, cohort, cutoff and audit.
- Bootstrap confidence intervals around performance differences using a sufficiently large and defensible holdout (resampling held-out requests; note possible dependence).
- Additional rolling-origin splits from a longer time range instead of relying on one quarter.
- Calibration intercept/slope, Brier decomposition and subgroup checks by borough and service.
- External temporal and geographic validation before applying to other jurisdictions or agencies.
- Interpret logistic odds ratios as associations, not causes. Investigate drift, group size, audit discrepancies and policy-induced selection bias.
- If predicting time-to-closure rather than nonclosure status, use a censoring-aware survival framework (e.g. Cox PH or flexible survival models) with proportional-hazards and model-assumption diagnostics.
- If predicting monthly backlog counts, consider Poisson/negative-binomial count models and out-of-time error estimates. These represent different outcomes and should not be mixed with binary 30-day classification.

## Ethics and scope

Do not use borough-based scores as individual entitlement decisions or proof of inequitable treatment. Geographic features may proxy for social disadvantage. Review deployment fairness and legal/organizational purpose separately. The pilot does not store raw data remotely or feed personal records to an AI service.
