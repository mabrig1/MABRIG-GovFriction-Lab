# Cloudflare Worker runtime — GovFriction Lab v0.4

## What changed

The original deployment served static assets only, which is why Cloudflare reported that variables, bindings and Logpush could not be added. The v0.4 configuration explicitly declares main = "./src/index.mjs", retaining the static website through ASSETS while routing /api/* to a true Worker script. Use a new Cloudflare deployment from GitHub main after review to activate it.

## Endpoints

GET /api/health or GET /api/config
: Safe, nonsecret runtime information; identifies the script, configured analysis mode, maximum aggregate groups and whether the optional DB binding exists. It never displays secret values, secret names, or token validation status.

POST /api/analysis/contingency
: Same-origin JSON object {"groups":[{"name":"BRONX","closed":30,"nonclosed":20},{"name":"QUEENS","closed":40,"nonclosed":10}]}. No raw records, personal identifiers, timestamps, geographic coordinates or free-text fields. The server performs Pearson chi-square, Cramér V, Wilson intervals and unadjusted group risk differences. Counts require finite nonnegative integers. An invalid or low-expected-count table will not be assigned a misleading asymptotic p-value.

When ENABLE_SERVER_ANALYTICS=false, the endpoint returns an unavailable status. Raw body limit: 16 KiB. Runtime uses no D1 writes or remote AI requests.

## Add variables and optional bindings

Cloudflare → Workers & Pages → select the exact deployed Worker named mabrig-govfriction-lab → Settings → Variables and Secrets → Add.

Ordinary variables:
- APP_MODE: research-pilot, staging or production
- ENABLE_SERVER_ANALYTICS: true or false
- MAX_AGGREGATE_GROUPS: from 2 to 25 (12 by default)

Secret values (only as needed in future and not consumed in v0.4):
- OPENROUTER_API_KEY
- ADMIN_TOKEN

Configure these as encrypted secrets, not text variables, if future backend features actually use them. Never reveal keys in the browser, test data or GitHub logs. Values placed in wrangler.toml are visible in the public repository and must never be secrets. Avoid setting the same nonsecret variable differently in the dashboard and checked-in Wrangler config: the next build can restore the source-controlled value.

If enabling D1, create the database first in the intended Cloudflare account. In wrangler.toml, add [[d1_databases]] with binding = "DB", actual database_name and database_id. Do not invent a UUID. Deploy once after that change, then inspect GET /api/health for the status flag. The presence of a binding does not mean research data is stored or migrations have run.

## Deployment smoke test

1. Verify GitHub main includes src/index.mjs, src/statistics.mjs and wrangler.toml main.
2. Check npm test and npm run build pass.
3. In the Cloudflare dashboard, confirm repository main and Worker name match the existing custom-domain binding.
4. Deploy with npx wrangler deploy or existing Git integration.
5. Open https://govfriction.mabrigkorie.org/api/health and confirm JSON runtime cloudflare-worker.
6. Reload https://govfriction.mabrigkorie.org/ and verify Worker connected appears under the research introduction.
7. Run synthetic example → Run audited analysis → CPU Lab → Run advanced CPU analysis.
8. Explicitly check the aggregate consent box to run the optional Cloudflare endpoint. Confirm a numeric test result or an explicit small-cell warning.
9. Check browser Network tools: POST /api/analysis/contingency includes group counts only, not individual rows.

## Resource and privacy limits

Cloudflare Free Worker requests have a 10 ms CPU limit and 128 MB memory at the time of this release; this does not provide Kaggle CPU/GPU notebooks. Heavy analysis remains in a dedicated browser thread, with a pilot cap of 200,000 eligible requests, still dependent on the researcher's available device memory.

No user login, raw data upload, automatic D1 storage, externally supplied API secrets, background jobs, queues or Python notebook execution is part of v0.4. The Worker API is public and therefore bounded by strict request/group limits; before broad public launch add WAF/rate limits, aggregate disclosure rules, and service monitoring. Protect project secrets and dataset copyrights. Do not publicize synthetic demonstration results as actual NYC statistics.

## Rollback

The previous working version can be recovered by redeploying a known-good commit (if needed); do not delete existing Worker credentials or bindings as a shortcut. Preserve the Cloudflare custom domain assignment. Verify whether a previous static-only deployment has overridden script/vars configuration before rolling back.
