#!/usr/bin/env bash
# Read-only inventory. Never uses secrets versions access or prints environment values.
set -euo pipefail
project=project-1c568b10-6e24-4dc2-b2b
region=us-central1
for service in dealscout-web dealscout; do
  gcloud run services describe "$service" --project "$project" --region "$region" --format=json | python3 -c '
import json,sys
s=json.load(sys.stdin); t=s.get("spec",{}).get("template",{}); c=t.get("spec",{}).get("containers",[{}])[0]; a=t.get("metadata",{}).get("annotations",{})
print(json.dumps({"Service":s["metadata"]["name"],"ReadyRevision":s.get("status",{}).get("latestReadyRevisionName"),"Traffic":s.get("status",{}).get("traffic"),"Identity":t.get("spec",{}).get("serviceAccountName"),"MinInstances":a.get("autoscaling.knative.dev/minScale"),"MaxInstances":a.get("autoscaling.knative.dev/maxScale"),"CpuThrottled":a.get("run.googleapis.com/cpu-throttling"),"CloudSQLAttachment":a.get("run.googleapis.com/cloudsql-instances"),"Network":a.get("run.googleapis.com/network-interfaces"),"Egress":a.get("run.googleapis.com/vpc-access-egress"),"Ports":c.get("ports"),"Resources":c.get("resources"),"EnvironmentNames":[e["name"] for e in c.get("env",[])],"SecretMounts":[v["name"] for v in t.get("spec",{}).get("volumes",[]) if "secret" in v]},indent=2))'
  gcloud run services get-iam-policy "$service" --project "$project" --region "$region" --format=json | python3 -c '
import json,sys
p=json.load(sys.stdin); print(json.dumps({"PublicBindings":[{"role":b["role"],"members":[m for m in b.get("members",[]) if m in ("allUsers","allAuthenticatedUsers")]} for b in p.get("bindings",[]) if any(m in ("allUsers","allAuthenticatedUsers") for m in b.get("members",[]))]}))'
done
gcloud sql instances describe dealscout-db --project "$project" --format='json(state,settings.activationPolicy,region)'
gcloud compute routers nats describe dealscout-nat --router=dealscout-router --region "$region" --project "$project" --format='json(natIpAllocateOption,natIps,subnetworks,endpointTypes)'
gcloud secrets versions list dealscout-rds-database-url --project "$project" --format='table(name,state,createTime)'
gcloud secrets versions list dealscout-rds-ca --project "$project" --format='table(name,state,createTime)'
gcloud run jobs describe dealscout-maintenance --project "$project" --region "$region" --format='json(metadata.name,status.latestCreatedExecution)'
gcloud projects get-iam-policy "$project" --flatten='bindings[].members' \
  --filter='bindings.members:serviceAccount:567450234233-compute@developer.gserviceaccount.com' \
  --format='table(bindings.role)'
gcloud iam workload-identity-pools providers list --project "$project" --location=global \
  --workload-identity-pool=dealscout-github-2 --format='json(name,attributeMapping,attributeCondition,oidc.issuerUri)'
