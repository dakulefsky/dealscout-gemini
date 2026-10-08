#!/usr/bin/env python3
"""Print selected Cloud Run configuration; never environment or secret values."""
import json
import sys


def summarize(resource):
    template = resource.get("spec", {}).get("template", resource)
    spec = template.get("spec", {})
    annotations = template.get("metadata", {}).get("annotations", {})
    service_annotations = resource.get("metadata", {}).get("annotations", {})
    containers = []
    for container in spec.get("containers", []):
        probe = container.get("startupProbe", {})
        containers.append({
            "Image": container.get("image"),
            "Ports": container.get("ports", []),
            "Resources": container.get("resources", {}),
            "EnvironmentNames": sorted(entry["name"] for entry in container.get("env", [])),
            "SecretReferences": {
                entry["name"]: entry["valueFrom"]["secretKeyRef"]
                for entry in container.get("env", [])
                if "secretKeyRef" in entry.get("valueFrom", {})
            },
            "StartupProbe": {key: probe[key] for key in
                ["initialDelaySeconds", "timeoutSeconds", "periodSeconds", "failureThreshold", "tcpSocket"]
                if key in probe},
            "VolumeMountPaths": [mount.get("mountPath") for mount in container.get("volumeMounts", [])],
        })
    status = resource.get("status", {})
    return {
        "Name": resource.get("metadata", {}).get("name"),
        "ReadyRevision": status.get("latestReadyRevisionName"),
        "CreatedRevision": status.get("latestCreatedRevisionName"),
        "Traffic": status.get("traffic", []),
        "Conditions": [{key: condition.get(key) for key in ["type", "status", "reason"]}
                       for condition in status.get("conditions", [])],
        "Identity": spec.get("serviceAccountName"),
        "Concurrency": spec.get("containerConcurrency"),
        "RequestTimeoutSeconds": spec.get("timeoutSeconds"),
        "RevisionSettings": {key: annotations.get(key) for key in [
            "autoscaling.knative.dev/minScale", "autoscaling.knative.dev/maxScale",
            "run.googleapis.com/cpu-throttling", "run.googleapis.com/startup-cpu-boost",
            "run.googleapis.com/cloudsql-instances", "run.googleapis.com/network-interfaces",
            "run.googleapis.com/vpc-access-egress",
        ]},
        "ServiceSettings": {key: service_annotations.get(key) for key in [
            "run.googleapis.com/ingress", "run.googleapis.com/minScale",
            "run.googleapis.com/maxScale", "run.googleapis.com/iap-enabled",
        ]},
        "Containers": containers,
        "SecretVolumeNames": [volume["name"] for volume in spec.get("volumes", []) if "secret" in volume],
    }


if __name__ == "__main__":
    print(json.dumps(summarize(json.load(sys.stdin)), indent=2))
