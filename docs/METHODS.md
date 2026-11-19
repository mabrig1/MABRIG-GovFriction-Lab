# GovFriction Lab — frozen pilot protocol v0.1

**Research status:** preliminary computational instrument; NOT a validated institutional performance index.
**Source:** NYC Open Data, *311 Service Requests from 2020 to Present*, dataset `erm2-nwe9`, https://data.cityofnewyork.us/Social-Services/311-Service-Requests/erm2-nwe9 . Public column label “Problem” is API field `complaint_type`.

## Scope
- Inclusion cohort by request `created_date`: January 1, 2025 00:00 through March 31, 2025 23:59:59, as local wall-clock timestamps recorded in source.
- Agency: `DSNY`. Service/Problem: `Graffiti` or `Missed Collection (All Materials)`; geography: five NYC boroughs.
- Fixed record snapshot `2026-11-19`; closure observed up to that date. Source data may be retrospectively modified, so **downloaded CSV and its SHA-256 checksum**, rather than a live query, are the frozen input for the study.
- Primary scoreable group: `(complaint_type, borough)`; comparison baseline: other boroughs in the SAME complaint type, never unlike services.
- The date difference treats source timestamps as *naive local wall times*; boundary crossings through daylight-saving clock changes can have approximately one-hour error. A later registered protocol should convert raw timestamps to America/New_York if canonical timezone metadata is confirmed.

## Input audit and exclusions
Input required: `unique_key`, `created_date`, `closed_date`, `agency`, `complaint_type`, `borough`; `status` is informative, not used to infer closure. Keep first duplicate `unique_key`, flag and exclude subsequent duplicates. Exclude records with missing/invalid creation date, missing service/borough, creation after snapshot, closure before creation, or invalid nonblank closure value. Exclude records created less than 30 days before snapshot from score calculation (right-censored at 30 days). Rows outside cohort or selected agency/problems/boroughs are out of scope, not data errors.

*Closure* means a recorded `closed_date`, not proof the service problem was remedied. Missing `closed_date` or one later than snapshot is treated as **no documented closure**, not verified agency inaction.

## Estimands
At follow-up horizon `H = 30 days` and snapshot `S = 2026-11-19`:
- For each eligible case `i`, `t_i` is time from created to recorded closed date in days, and is infinity when no documented closure by `S`.
- `u_i = 1` if `t_i > H`, else `0`. A closure EXACTLY at H is counted as closed within 30 days.
- `d_i = min(t_i, H) / H` (equal to 1 if missing / post-snapshot).
- **Nonclosure30** = mean(`u_i`) = proportion not *documented* closed by day 30.
- **Delay burden30** = mean(`d_i`) = normalized restricted mean time-to-documented-closure across the full cohort, without conditioning on closures.
- **Friction F** = `0.5 * Nonclosure30 + 0.5 * DelayBurden30`.
- **Peer baseline** `P` = friction calculated among all other boroughs in the SAME complaint type.
- **Service asymmetry A** = absolute difference `abs(F − P)`.
- **BFS-DAI** = `100 * (0.70 * F + 0.30 * A)`; higher means more recorded friction/asymmetry, **not** lower public-service quality by causal identification.
- Group score only reported when group `n >= 10` and other-borough pool `n >= 10`. Below `n=30`, mark exploratory/unreliable. These weights and thresholds are **provisional** and must be varied in sensitivity testing; index weights are not empirically learned or validated.
- The deliberate asymmetry penalty makes two otherwise similar agencies/boroughs rank differently when a matching service’s peer group is uneven. It does not show why.

## Uncertainty and comparison
- Wilson 95% interval for `Nonclosure30` (binomial proportion) under independence approximation. Group dependence may invalidate this interval.
- No confidence interval for composite BFS-DAI in v0.1: avoid false precision; implement cluster/block resampling and peer baseline uncertainty after feasibility audit.
- Pre-specified cross-implementation thresholds for the same frozen dataset: `n` and case exclusions **exact**, `Nonclosure30`, `DelayBurden30`, `F`, `A` absolute differences <= `1e-9`, final score <= `1e-7` (floating point). Different input hashes must fail comparison, even if numerical outputs coincide.
- Comparisons across service categories without stratification are not interpreted.
- A difference between boroughs can reflect submission/reporting behavior, operational definitions, neighborhood composition, complexity, or data-recording practices. No causal explanation or budget linkage permitted.

## Falsification and quality checks
- Known-answer toy cohort with instant closure, half-horizon closure, day-31 closure and no closure.
- Duplicate ID, invalid date, future date, unscorable small groups, no peer group, negative time, and exact 30-day boundary.
- Sensitivity: evaluate friction/asymmetry weight changes, 7-day and 60-day H, group size threshold and borough coverage, and time-window alternatives *without claiming confirmatory inference*.
- Confirm that conclusion/rankings agree under independently coded implementation before claiming reproducibility.

## Field use and ethics
Source contains service request metadata and potentially identifiable locations; do not publish addresses, free-text complaint descriptions or individual case identifiers in paper tables. Aggregates with fewer than 10 cases suppressed. No direct individual participant recruitment or recording is part of this prototype. User-uploaded CSV is processed in the local browser, not uploaded to a server by this app. This is an analytic tool for exploratory public administration research, not an official NYC performance assessment.