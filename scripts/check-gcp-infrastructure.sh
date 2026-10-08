#!/usr/bin/env bash
# Read-only inventory. Never accesses secret contents or prints environment values.
set -uo pipefail
export CLOUDSDK_CORE_DISABLE_PROMPTS=1
project=project-1c568b10-6e24-4dc2-b2b
region=us-central1
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
unavailable=0
check() {
  local label="$1"
  shift
  echo "CHECK: $label"
  if ! "$@"; then
    echo "UNAVAILABLE: $label (the resource may be absent or this identity lacks access)" >&2
    unavailable=$((unavailable + 1))
  fi
}
describe_runtime() {
  gcloud run "$1" describe "$2" --project "$project" --region "$region" --format=json |
    python3 "$script_dir/cloud-run-inventory.py"
}
public_bindings() {
  gcloud run services get-iam-policy "$1" --project "$project" --region "$region" --format=json |
    python3 -c 'import json,sys; p=json.load(sys.stdin); print(json.dumps({"PublicBindings":[{"role":b["role"],"members":[m for m in b.get("members",[]) if m in ("allUsers","allAuthenticatedUsers")]} for b in p.get("bindings",[]) if any(m in ("allUsers","allAuthenticatedUsers") for m in b.get("members",[]))]}))'
}
for service in dealscout-web dealscout; do
  check "$service desired configuration" describe_runtime services "$service"
  check "$service public IAM bindings" public_bindings "$service"
  ready="$(gcloud run services describe "$service" --project "$project" --region "$region" --format='value(status.latestReadyRevisionName)')"
  if [ -n "$ready" ]; then
    check "$service actual ready revision" describe_runtime revisions "$ready"
  else
    echo "UNAVAILABLE: $service has no readable ready revision" >&2
    unavailable=$((unavailable + 1))
  fi
done
check 'Google SQL fallback state and storage' gcloud sql instances describe dealscout-db --project "$project" --format='json(state,settings.activationPolicy,region,settings.tier,settings.dataDiskSizeGb,settings.dataDiskType,settings.availabilityType,settings.backupConfiguration.enabled)'
check 'NAT and fixed IP route' gcloud compute routers nats describe dealscout-nat --router=dealscout-router --region "$region" --project "$project" --format='json(natIpAllocateOption,natIps,subnetworks,endpointTypes)'
check 'Reserved application egress IP' gcloud compute addresses describe dealscout-egress --project "$project" --region "$region" --format='table(name,address,status,addressType,users)'
check 'Database secret version metadata' gcloud secrets versions list dealscout-rds-database-url --project "$project" --format='table(name,state,createTime)'
check 'CA secret version metadata' gcloud secrets versions list dealscout-rds-ca --project "$project" --format='table(name,state,createTime)'
check 'Maintenance job existence' gcloud run jobs list --project "$project" --region "$region" --format='table(metadata.name,status.latestCreatedExecution.name,status.latestCreatedExecution.completionTimestamp)'
check 'Runtime identity project roles' gcloud projects get-iam-policy "$project" --flatten='bindings[].members' --filter='bindings.members:serviceAccount:567450234233-compute@developer.gserviceaccount.com' --format='table(bindings.role)'
check 'GitHub federation boundary' gcloud iam workload-identity-pools providers list --project "$project" --location=global --workload-identity-pool=dealscout-github-2 --format='json(name,attributeMapping,attributeCondition,oidc.issuerUri)'
check 'Project billing linkage' gcloud billing projects describe "$project" --format='json(projectId,billingEnabled,billingAccountName)'
echo "Inventory completed; unavailable checks: $unavailable"
# Partial output remains useful, but missing checks must not produce a false green audit.
[ "$unavailable" -eq 0 ]
