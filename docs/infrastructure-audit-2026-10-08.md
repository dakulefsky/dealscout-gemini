# Infrastructure audit — October 8, 2026

## Scope and evidence

Audited the repository's deployment pipeline, Docker packaging, PostgreSQL connectivity, maintenance cadence, quota accounting, public/private boundaries, affiliate flow, and runtime dependencies. Public HTTP checks succeeded for liveness/readiness. The private Cloud Run URL redirects unauthenticated callers to Google sign-in; public admin, AI and operational endpoints return 404. This verifies observed access behavior, not the full account IAM policy.

AWS account APIs are not connected. A read-only production GitHub workflow obtained selected Google Cloud service configuration; other Google account checks were denied or unavailable. Backup retention, restore coverage, machine size, full firewall/IAM configuration, actual bills, and obsolete resource charges require the read-only account scripts below. Earlier migration output confirmed both services moved to the RDS database and Google SQL was stopped; this audit does not pretend to independently verify that account state.

## Follow-up account evidence (08:34 UTC)

- Public traffic remains 100% on ready revision `dealscout-web-00044-6s6`; attempted revision `00045-hfj` failed startup. The latest public deployment is not successful. The deployment identity cannot read Cloud Logging, so the exact fatal startup cause remains unverified.
- Private service is healthy on `dealscout-00215-q98`, with IAP enabled and no public IAM bindings. It uses a separate Cloud Build source-deploy image for commit `b0d8b3f`, while the public workflow uses a gcr.io image. There are two independently advancing deployment paths. Consolidating them needs inspection of the existing Cloud Build trigger before disabling it.
- Both actual serving revisions allow up to 20 instances, with concurrency 80 and 512 MiB RAM. The public service also has a service-level ceiling of 20. Lower 3/1 revision caps are release configuration, not verified live limits. Private min instances is zero.
- Both services use the default Direct VPC network, all-traffic egress, the same RDS database secret and regional CA mount; neither has a Cloud SQL attachment. The private service retains old DB_USER/DB_PASSWORD/DB_NAME environment entries. Values were deliberately not retrieved.
- Only the network-check Cloud Run job exists. Scheduled maintenance run 37738912243 failed with NOT_FOUND for dealscout-maintenance; the prior failed rollout never created it. Unattended maintenance is not operational yet.
- Overnight crawl run 37735055480 aborted its first homepage request after 15 seconds. Later liveness/readiness checks were successful. This is a monitoring failure, not enough evidence to attribute a sustained outage.
- NAT, fixed-IP metadata, IAM roles, secret-version metadata, federation configuration and Google SQL fallback state could not be verified with this identity. Billing API is disabled. No account permissions were widened, secret contents retrieved, or APIs enabled.

### Additional fixes validated in this follow-up

- Startup retries only transient PostgreSQL network/readiness failures, with eight attempts and a 90-second retry budget. Authentication, certificate and configuration failures still fail immediately. Google documents Direct VPC/NAT cold-start connection delays of 30 seconds or longer; a single 10-second attempt was insufficient for that topology. This addresses a verified risk but does not establish the fatal cause of revision 00045.
- Calendar fetches now have a five-second deadline through response-body reading. Concurrent checks share one request per location/time window. Missing or malformed closure status fails closed instead of becoming an open-site status; cache entries cannot be reused for earlier dates. Existing Jerusalem/New York rules are retained.
- Every release smoke static-page fetch is bounded. Scheduled closure still checks liveness, readiness, robots, sitemap, ads.txt and public admin isolation, while deferring closed shopper APIs. Unmarked 503 responses still fail. Public crawl monitoring permits one bounded homepage retry for transient cold-start failures and reports the affected URL on timeouts.
- Read-only inventory disables interactive prompts and describes the specific egress IP instead of treating a permission-denied list warning as an empty successful result.

## Confirmed problems addressed

- **Unreliable unattended scheduling:** an in-process timer cannot reliably wake scale-to-zero Cloud Run. Added a scheduled GitHub workflow executing one bounded Cloud Run maintenance job every six hours. It shares the durable cadence and locks; it does not force additional provider pulls. Discovery remains normally 12-hourly, verification daily, and the Rainforest ceiling remains 500/month. GitHub can delay scheduled workflows. First execution success must still be observed.
- **Indefinite database waits:** added 10-second connection/acquisition and 30-second statement bounds. A real local TCP black-hole test verifies readiness returns a timeout rather than hanging. Pool settings reject unsafe values, including a one-client pool that cannot support tasks querying while holding a dedicated advisory-lock connection.
- **Probe dependency/rate-limit coupling:** health and readiness routes now run before shopper rate limiting and Prime Day settings refresh. Liveness remains process-only, while readiness checks PostgreSQL directly; ordinary shopper requests retain their limits.
- **Retained advisory locks:** a failed unlock now destroys the database session rather than returning a potentially locked session to the pool.
- **False successful price checks:** an all-failed verification batch no longer advances the durable successful-run timestamp or reports manual success. Scheduled cycles expose the failure and schedule a bounded retry. Intentional provider pause still allows cleanup while skipping paid lanes without advancing their cadence.
- **TLS configuration ambiguity:** DATABASE_URL SSL query parameters can override node-postgres SSL settings. They now fail clearly; RDS TLS is controlled by verified certificates and the regional CA mount.
- **Public/admin setting drift:** deployment now advances common affiliate/provider/database/budget settings on both services while preserving private IAM/IAP and other admin settings. RDS admin deployment removes obsolete Cloud SQL database secret variables.
- **Scaling/connection exposure:** release defaults cap public/admin replicas at 3/1 with no minimum instances. At the default five-client pool, those replica caps plus a single maintenance task allow approximately 25 connections, excluding rolling revisions and other clients. This is not a dollar spending cap; compare it with the actual RDS connection limit.
- **Provider tests outside the shared quota ledger:** standalone live tests now refuse to spend provider calls without configured durable PostgreSQL. The diagnostic fallback also reserves its request through the normal budget/pause guard. The existing standalone Rainforest workflow intentionally fails this safety gate until connected to the shared ledger; manual admin lookup remains available.
- **Known runtime dependency advisories:** updated Nodemailer 7 to patched 10.0.16 and proxy-addr 2.0.7 to 2.0.8. Verified the app's email composition with real Nodemailer locally, without sending mail. Added SMTP timeouts and disabled file/URL content access. Runtime audit now has zero high/critical findings; two moderate React Router advisory entries remain. A routing-major upgrade was deferred for separate compatibility review. The app does not use React Router SSR deserializeErrors, and inspected navigation uses internal paths; absence of a reviewed exploit path is not proof of universal immunity.
- **Credential/data packaging:** Docker and git exclusions now cover generated GitHub credential JSON, migration dumps and the development JSON database. Deployment smoke checks reject missing/duplicate/wrong affiliate tags instead of accepting any Amazon URL.

## Amazon Associates

The public feed sample and live product redirect use `dankul-20`. A redirect test containing two old tags returned exactly one owner tag, preserved product options and removed the scroll fragment. Prime, Prime Video, Audible and Kindle Unlimited live URLs also contain the owner tag. A lookalike non-Amazon destination was rejected. These checks do not place purchases or prove commission eligibility, bounty qualification, account approval, or downstream attribution inside Amazon's reporting system.

## Account-level checks still required

Run `bash scripts/check-aws-infrastructure.sh` in AWS CloudShell and `bash scripts/check-gcp-infrastructure.sh` in Google Cloud Shell. Both are read-only and avoid retrieving secret contents. Run `scripts/check-database-infrastructure.sql` through the already established TLS psql connection to RDS. Share only their sanitized outputs, not passwords or database URLs.

Check the following before considering the infrastructure fully verified:

1. RDS automated backups have nonzero retention and a recent `LatestRestorableTime`; verify a recovery snapshot/restore before deleting the Google fallback. Confirm deletion protection is enabled if appropriate.
2. Keep PostgreSQL ingress from the fixed app egress `34.10.158.147/32`. Remove obsolete CloudShell `/32` rules after migration. No PostgreSQL ingress should permit `0.0.0.0/0` or `::/0`.
3. Confirm the old Google SQL instance is stopped. Stopped storage and reserved IP resources can still incur charges; delete only after recovery is verified. Do not remove NAT or its IP while Cloud Run still needs that fixed route to AWS.
4. Confirm RDS instance class/storage/IOPS/Multi-AZ and billing credits. AWS credits do not eliminate Google Cloud Run, NAT, static-IP, build, storage, or cross-cloud networking charges. Consult billing line items; deployment count alone does not explain a Cloud SQL bill.
5. Check runtime service-account roles and restrict GitHub federation to the intended repository. The application currently uses the RDS master `postgres` role; plan a dedicated application role with ownership limited to its schema, coordinated with startup schema changes. Do not rotate database credentials independently of Secret Manager and both services.
6. Confirm the maintenance job's first execution succeeds and its logs show bounded due work. Provider pause controls and manual intervention remain active. Scheduled job price checks do not send price-alert email without SMTP configuration; the web/manual paths retain their existing delivery capability.
7. Check Amazon Associates Reports/Link Checker and registered website settings. Outgoing tags are verified; sales and qualifying bounty credit cannot be inferred from local redirects.

## Validation

Local lint has zero errors (ten existing refresh/unused warnings). Production frontend build passes. Tests include a real bounded network-failure check, lock-session disposal, job exit/error/resource handling, role/secret/network boundaries, quota deferral, email composition compatibility and affiliate regression checks. GitHub Quality and deployment status should be recorded after this patch is merged; these local checks alone do not certify a live rollout.

## Follow-up validation

717 local tests passed, lint has zero errors (10 existing warnings), and the production build passed. No paid provider pull was used in the audit. Rainforest remains capped at 500 calls/month. Changes require a successful production rollout before their live behavior is claimed.

## Final rollout outcome (08:52 UTC)

PR 342 passed GitHub Quality and merged as 5e693fa97332b08d7f1712bed297ece2547c5244. Deploy Web run 37752204626 built successfully, but public revision dealscout-web-00046-7ll failed startup. Private/parity/smoke/maintenance steps were skipped. The working previous public revision passed a nine-page live crawl; /admin and /api/ai/status returned 404, private unauthenticated access returned 302, and /api/ready returned ready. No further deployment retry is justified without the exact fatal startup log, which this connected identity cannot read.

A fresh duplicate-tag affiliate probe confirmed exactly dankul-20, but found that a supplied review fragment was still retained. This corrects the earlier broad statement about fragment removal: it was not true for all paths. A focused follow-up clears fragments while retaining product options and the owner tag; it is held for the next verified release rather than triggering another speculative deployment.

Runtime dependency audit again found zero high/critical advisories and two moderate React Router entries. AWS backup, firewall, instance cost and Google billing/storage checks remain unavailable.

## Startup failure identified from application logs (10:20 UTC)

The uploaded stderr shows four transient network retries, followed by a successful readiness check and entry into ensureOperationalSchemas. The fatal error is pg-pool's queued acquisition timeout at editorialRepository.ensureSchema inside Promise.all; the failure is after readiness, not a password or TCP port error. Ten concurrent schema tasks were competing in a five-client pool during cold network startup. Startup now initializes schemas sequentially, reusing the warmed connection, then initializes bookmarks/category repair as before. Pool limits, connection/statement timeouts and verified TLS are unchanged. A regression test checks bounded concurrency and verifies schema failure prevents later repairs and serving startup. This diagnosis justifies a targeted release attempt; it does not guarantee other blockers are absent.
