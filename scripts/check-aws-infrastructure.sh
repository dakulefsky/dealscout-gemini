#!/usr/bin/env bash
# Read-only inventory. Does not retrieve credentials, modify networking, or stop resources.
set -euo pipefail
aws rds describe-db-instances --region us-east-1 --db-instance-identifier dealscout-db \
  --query 'DBInstances[0].{Status:DBInstanceStatus,Engine:Engine,Version:EngineVersion,Class:DBInstanceClass,StorageGiB:AllocatedStorage,StorageType:StorageType,StorageAutoscaleMaxGiB:MaxAllocatedStorage,IOPS:Iops,MultiAZ:MultiAZ,BackupRetentionDays:BackupRetentionPeriod,LatestRestorableTime:LatestRestorableTime,DeletionProtection:DeletionProtection,PublicAccess:PubliclyAccessible,SecurityGroups:VpcSecurityGroups[*].VpcSecurityGroupId}' --output json
aws ec2 describe-security-group-rules --region us-east-1 \
  --filters Name=group-id,Values=sg-02af5a640ffdff2f8 \
  --query 'SecurityGroupRules[?IsEgress==`false`].{RuleId:SecurityGroupRuleId,Protocol:IpProtocol,FromPort:FromPort,ToPort:ToPort,IPv4:CidrIpv4,IPv6:CidrIpv6,SourceGroup:ReferencedGroupInfo.GroupId}' --output json
aws rds describe-db-snapshots --region us-east-1 --db-instance-identifier dealscout-db \
  --query 'reverse(sort_by(DBSnapshots,&SnapshotCreateTime))[:5].{Created:SnapshotCreateTime,Type:SnapshotType,Status:Status,Name:DBSnapshotIdentifier}' --output json
