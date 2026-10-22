# DealScout suspension record — October 22, 2026

Status: PARTIAL SUSPENSION. Cloud shutdown and subscription cancellation are NOT verified.
Do not restart services, deploy features, or resume crawls until the owner explicitly requests it.

## Repository suspension
All nine workflow definitions are retained byte-for-byte as *.yml.disabled under .github/workflows/.
GitHub does not load these extensions as workflows. This prevents future default-branch scheduled, push, PR, and manual workflow execution from these files. Existing runs, other branches, external triggers, and cloud-side jobs require separate checks.
The repository-owned cloudbuild.yaml is replaced by a no-op configuration. Original is retained at docs/suspension/cloudbuild.yaml.original.
All application code, branches, history and credentials remain intact.
Baseline main commit: ec1d6427ef289be52f1afd8ab0c11c014c94d053
Baseline tree: 312dfd002c7ae9e63665c3d58019029637e06159
The suspension commit uses [skip ci] [skip deploy] and does not execute a deployment.

## Actions NOT completed
- Neither Cloud Run service (dealscout-web or dealscout) was stopped or changed.
- No cloud scheduler, Cloud Build console trigger, active build, Cloud Run job or in-process crawler was stopped.
- No AWS database snapshot was created; no restorable backup was verified; RDS was not stopped or deleted.
- Rainforest and Gemini billing, subscription terms, and cancellation status are unknown.
- No current invoice, billing export, resource inventory, DNS registrar or renewal was accessed.
- No domain or credential was changed.
Google Cloud console displayed Site Unavailable. Subsequent browser console navigation and tab inspection timed out. GitHub's connection permits repository reads/writes but exposes no workflow-disable or run-cancellation action.

## Cost accounting
Verified dollar charges before: unavailable.
Verified monthly dollar reduction: unavailable; do not assume $0.
Estimated before/after monthly totals: indeterminate without instance class, storage sizes, billing SKUs, provider plan, and invoices.
The removed GitHub workflow activity should reduce future execution/associated requests, but savings cannot be quantified.
Potential remaining charges: RDS compute, provisioned storage/IOPS and backups; old stopped Cloud SQL storage; Cloud Run requests or minimum instances; NAT gateway and static IPv4; Artifact Registry/container images; build-source buckets; logging/monitoring; Secret Manager; Rainforest plan; Gemini usage; domain renewal. These are investigation targets, not verified active resources.
Preserve dealscouted.com and its renewal.

## Complete remaining shutdown sequence
1. Authenticate to the correct Google and AWS accounts. Match resources to this repository, deployed image/source metadata, domain and database connection secret. Do not act on unrelated resources.
2. Export sanitized Cloud Run service/job YAML, service IAM, traffic/revision/image digests, environment names and secret references, build trigger definitions/enabled state, scheduler definitions/state, DNS, networking/NAT/static IP settings, and relevant billing resource IDs. Keep secrets in their existing secret stores; never commit secret values.
3. Disable every DealScout external Cloud Build trigger and scheduler; cancel active DealScout builds/executions and any already-running GitHub Actions. The repository change alone cannot stop these.
4. Stop provider/discovery/verification/publication work using existing runtime pause controls where accessible. Do not issue test requests to paid providers.
5. For Cloud Run use a supported service-disable control if available after reviewing its behavior; otherwise export a complete restoration configuration and obtain owner approval before deleting service resources. Minimum instances zero alone is NOT a suspension: inbound traffic can start instances. Block invocation/ingress only using a reviewed configuration that retains the original policies. Stop jobs and verify no active instances/executions. Do not deploy a new application revision just to pause the project.
6. In AWS us-east-1 identify the actual PostgreSQL RDS instance and record engine/version, class, storage/IOPS, encryption KMS key, parameter/option/subnet groups, VPC/security groups, credentials secret reference, backup retention and endpoint. Create a manual snapshot and wait for available. Confirm ownership, engine/version/encryption and retained KMS-key access. Snapshot availability is not a restore test; where feasible verify a temporary restore, then remove the test resource with permission.
7. After the snapshot is available, stop RDS if supported. AWS normally restarts stopped RDS instances after seven days: this is temporary relief, not an indefinite compute shutdown. Verify current AWS behavior and limitations in official documentation before implementation.
8. For indefinite RDS compute elimination, present the exact database identifier, snapshot identifier/status, restoration prerequisites and estimated retained snapshot cost for explicit owner approval BEFORE deletion. Retain snapshot and KMS key; preserve all configuration. Do not delete any production data under this record's authority.
9. Review old Cloud SQL, NAT/IPs, images, buckets, logs and monitoring bills. Preserve backups/configuration; obtain explicit approval before deleting irreversible resources. Removing retained storage is separate from pausing compute.
10. In Rainforest billing identify the plan, renewal, outstanding usage and data retention. Cancel recurring renewal where possible without deleting project data. Record effective date and confirmation. Identify Gemini API/Vertex/AI Studio project and any other callers; disable DealScout-only scheduling and avoid project-wide changes if shared.
11. Audit domain registrar, external monitoring, mail, proxies and other vendors against bills. Keep domain ownership and renewal. Record all remaining charges using invoices and current regional pricing.

## Restoration guide — only after explicit owner request
1. Review this record and complete the actual cloud inventory/snapshot record before starting. Nothing cloud-side was changed by this suspension commit.
2. Verify domain/DNS ownership, credentials/secret versions, KMS-key access, networking and billing accounts. Do not expose private admin service.
3. If RDS was later stopped, start it only with authorization. If deleted after approval, restore the retained snapshot to the recorded engine/settings, parameter/subnet/security groups and encryption; obtain the new endpoint. Validate database schema/data and TLS through a read-only connection. Update the existing database secret if the endpoint changed.
4. Restore required private networking/NAT/egress allowlists and secret mounts. Restore Cloud Run exported service configuration, pinned images, IAM/IAP, scaling and traffic. Keep provider automation paused while testing liveness/readiness and database connectivity.
5. Restore original cloudbuild.yaml from docs/suspension/cloudbuild.yaml.original ONLY after reviewing all cloud-side build triggers and explicitly approving resumption.
6. Rename only the desired .github/workflows/*.yml.disabled files back to *.yml after reviewing schedules and deployment permissions. Prefer re-enabling quality checks first. Restoring deploy-web.yml can deploy immediately on push; use a controlled commit and explicit deployment authorization. Keep scheduled maintenance and live provider workflows disabled until approved.
7. Re-enable selected external build triggers, scheduler jobs and provider subscriptions only when needed and explicitly authorized. Review Rainforest/Gemini quotas before any live test.
8. Verify public/private boundaries, readiness, domain routing, and one authorized bounded maintenance cycle. Check bills and logs for unintended activity. Do not restore every historical schedule blindly.
