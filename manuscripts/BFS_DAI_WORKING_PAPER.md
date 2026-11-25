# Making Administrative Friction Measurable: Development, Computational Implementation, and Performance Evaluation of the Bureaucratic Friction and Service-Delivery Asymmetry Index (BFS-DAI)

**Working manuscript — empirical results pending. Not ready for submission.**
Proposed author: Mabrig Korie (confirm author details and contributions before submission).

## Structured abstract (protocol-stage draft)
Municipal service-request systems provide time-stamped administrative records that can support comparative assessment of the processing of reported problems. Such records, however, do not capture all citizen needs or demonstrate physical service resolution. This study proposes the Bureaucratic Friction and Service-Delivery Asymmetry Index (BFS-DAI), combining horizon-specific documented nonclosure, normalized restricted delay and absolute differences against a within-service geographical peer baseline. GovFriction Lab implements the measure through a browser-based research workflow with source checksums, explicit eligibility rules and exportable methods records. The proposed evaluation uses New York City Department of Sanitation service requests for graffiti and missed collection in the first quarter of 2025 and separates substantive measurement assessment from computational implementation verification. The computational experiment compares an independently coded Python reference with the browser engine, evaluates alternative horizons and weights, records execution times across controlled dataset sizes, and audits data provenance and the analytical workflow. Findings will be reported only following execution against frozen source data and verification of the resulting outputs. The framework is intended to support transparent, bounded interpretation of administrative processing patterns, rather than infer causal government performance or citizen-experienced administrative burden.

## 1. Introduction
The digital transformation of public administration creates opportunities to examine service processes through records generated during routine administrative interactions. Municipal 311 systems record reported problems and administrative responses, providing observations that can be analysed across service categories, periods and geographical units. The increasing availability of such data does not eliminate the challenges of measurement. A recorded closure is an administrative event, not direct evidence that a public problem was remedied. Equally, observed requests represent reported demand rather than the universe of unmet service needs.

Administrative burden scholarship distinguishes learning, compliance and psychological costs experienced during citizen–state interactions (Moynihan, Herd, & Harvey, 2015). The present study addresses a narrower construct: recorded processing friction following the entry of a request into an administrative system. Waiting and nonclosure may be relevant to citizens' experiences, but these records do not directly measure their learning costs, psychological costs, or the time and effort citizens spend pursuing a request. This distinction protects the proposed operational measure from overinterpretation.

Existing work has examined distributional differences in the use of digital service-request systems and variations in government responsiveness. Research on 311 coproduction and equity includes comparative analyses across cities (doi:10.1177/0275074019894564) and investigations distinguishing resident demand from underlying need (doi:10.1111/psj.12540). Therefore, the novelty claim is not that administrative delays or geographical differences have never been studied. The proposed contribution is a specifically defined composite, its transparent computational implementation and an evaluation of whether its outputs add useful information beyond its constituent indicators. A systematic literature and software comparison is still required to substantiate originality.

The study also treats computational implementation as an object of evaluation. Research outputs may be difficult to reproduce when input provenance, transformations, software versions and parameter choices are undocumented. Computational reproducibility requires consistent results under the same inputs and analytical conditions (National Academies, 2019). A browser interface can potentially expose such choices and reduce workflow friction, but its advantages must be measured rather than presumed. Cross-language numerical agreement, runtime and audit completeness address distinct questions from user experience, construct validity and external replication.

## 2. Research questions
RQ1: How can recorded processing friction and within-service geographical asymmetry be operationalized using administrative service-request records?
RQ2: How sensitive are BFS-DAI estimates, rankings and coverage to alternative observation horizons and weighting choices, and what information does the composite add relative to its components?
RQ3: To what extent do independently implemented browser and Python analyses agree, and what are the measured execution times and audit completeness under a specified computational environment?
RQ4: What are the limitations of the measurement framework and the local-first implementation, and what evidence would be needed to establish comparative workflow advantages and external validity?

## 3. Conceptual framework and index development
Define documented processing friction as observable elapsed time and absence of documented closure after a request has entered an administrative record system. The estimand is conditional on recorded requests within a specified service and geographical cohort. Geographical asymmetry is a descriptive difference, not a measure of discrimination or causal administrative quality.

For an eligible case, t denotes elapsed time from recorded creation to recorded closure, with infinity when no documented closure exists by the stated cutoff. H is the horizon. N is the proportion with t > H; D is the mean of min(t,H)/H. F=(N+D)/2. Let P denote the pooled other-borough friction for the same service. A=abs(F-P), and B=100(wF+(1-w)A), with primary w=.70. A signed difference F-P must accompany A.

The index is formative and uses provisional, normative weights. The OECD/JRC handbook (2008) motivates explicit assessment of weighting, aggregation and robustness. N and D share information: with complete horizon follow-up D>=N. Combining them does not establish a new latent dimension. Compare N, D, F and B separately and assess redundancy.

A second important property follows algebraically: holding peer friction fixed, below the peer baseline the slope of B in F is 100(2w-1); above it the slope is 100. Thus weights below .50 can make the score decline as friction increases toward the peer baseline. At w=.50 the score is flat below that baseline. Pure asymmetry (w=0) is not a friction severity measure. These configurations are stress tests, not candidate severity scores to select opportunistically. The primary .70 choice preserves monotonicity conditional on fixed peers. Peer-dependent rankings and favorable versus unfavorable differences must be interpreted explicitly.

## 4. Data and methods (planned)
NYC Open Data dataset erm2-nwe9; Q1 2025 creation cohort; DSNY Graffiti and Missed Collection (All Materials); five boroughs. Use complete eligible records, not a truncated sample. Verify official category labels, download exact bytes and preserve SHA-256, source query, timestamps, coverage and manifest. A later download does not reconstruct an earlier historical snapshot. Confirm the observation cutoff, recorded date semantics and first-duplicate policy. Use complete horizon follow-up and report audit exclusions, suppressed small groups, Wilson nonclosure intervals and observational limits.

The primary horizon is 30 days with 70% friction and 30% absolute asymmetry. Sensitivity uses five horizons and six weights, with varying eligible cohorts explicitly identified. Additional fixed-cohort analysis, justified composite uncertainty, benchmarking against conventional metrics, and external validity remain work items. The empirical study is descriptive; no causal estimates are planned in this pilot.

The computational protocol compares independently coded Python and browser output using the same exact bytes, with exact count and group agreement, numeric tolerances, controlled synthetic scaling runs, and observed core-network activity. See docs/PAPER_EVALUATION_PROTOCOL.md. Synthetic data are engineering fixtures only. Comparative user utility remains a separate study.

## 5. Results — evidence required, not yet filled
- Table 1: Dataset provenance and complete audit flow.
- Table 2: Real-data group counts, nonclosure, delay burden, signed/absolute asymmetry and BFS-DAI.
- Table 3: Sensitivity, rank stability and changed cohort coverage; separate common cohort analysis.
- Table 4: Python/browser concordance, tolerances and discrepancies.
- Table 5: Repeated performance measurements with environment and version.
- Table 6: Audit completeness, export validation, network observation and limitations.
- Figures: component profiles by service/borough; rank stability; measured runtime scaling.
No sample sizes, scores, p-values, runtime results or empirical interpretations are invented.

## 6. Discussion and conclusion — deferred
Interpret findings in light of administrative processing, reporting selection, case complexity, mutable data and operational definitions. Distinguish numerical correctness from scientific validity, and local core calculation from comprehensive privacy certification. Do not claim usability improvement without comparative task evidence. Include disclosure of developer-authorship and conflicts, funding, AI assistance, reproducibility materials and data governance.

## References (verified starting points; expand systematic review)
Moynihan, D., Herd, P., & Harvey, H. (2015). Administrative burden: Learning, psychological, and compliance costs in citizen-state interactions. Journal of Public Administration Research and Theory, 25(1), 43–69. https://doi.org/10.1093/jopart/muu009
OECD/European Union/EC-JRC. (2008). Handbook on constructing composite indicators: Methodology and user guide. OECD Publishing. https://doi.org/10.1787/9789264043466-en
National Academies of Sciences, Engineering, and Medicine. (2019). Reproducibility and replicability in science. https://doi.org/10.17226/25303
New York City Open Data. 311 Service Requests from 2020 to Present. https://data.cityofnewyork.us/d/erm2-nwe9 (add verified extraction date and manifest to final citation).
Additional verified literature identifiers for full bibliographic extraction: https://doi.org/10.1177/0275074019894564 ; https://doi.org/10.1111/psj.12540 ; https://doi.org/10.1111/puar.12092 .
