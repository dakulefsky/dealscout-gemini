import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const fields = ['raw', 'invalidIdentityOrPrices', 'unavailable', 'belowIntakeDiscount', 'duplicateAsins',
  'existingMatches', 'quantityVariants', 'qualityRejected', 'approvedCandidates', 'reviewCandidates',
  'retainedNew', 'capacitySkipped', 'creditsUsed', 'created', 'updated', 'autoApproved', 'pendingReview',
  'editorialHoldback', 'rejected'];
const reasons = ['invalidAsin', 'missingTitle', 'missingSalePrice', 'missingReferencePrice', 'notDiscounted', 'belowQualityDiscount', 'otherQualityRule'];

export function summarize(entries) {
  const groups = {};
  let malformed = 0;
  const seen = new Set();
  for (const entry of entries) {
    if (entry.insertId && seen.has(entry.insertId)) continue;
    if (entry.insertId) seen.add(entry.insertId);
    const text = entry.textPayload;
    if (typeof text !== 'string') continue;
    const match = text.match(/^\[(Rainforest discovery|Rainforest bulk intake|Deal discovery intake)\]\s+(\{.*\})\s*$/);
    if (!match) continue;
    let row;
    try { row = JSON.parse(match[2]); } catch { malformed++; continue; }
    if (!row || typeof row !== 'object') { malformed++; continue; }
    const kind = match[1] === 'Deal discovery intake' ? `${match[1]} (${row.scheduled === true ? 'scheduled' : 'manual'})` : match[1];
    const group = groups[kind] ||= { observations: 0, totals: {}, rejectionReasons: {} };
    group.observations++;
    for (const key of fields) {
      if (Number.isSafeInteger(row[key]) && row[key] >= 0) group.totals[key] = (group.totals[key] || 0) + row[key];
    }
    for (const key of reasons) {
      const count = row.rejectionReasons?.[key];
      if (Number.isSafeInteger(count) && count >= 0) group.rejectionReasons[key] = (group.rejectionReasons[key] || 0) + count;
    }
  }
  return { groups, malformed };
}

export function collect(env = process.env, spawn = spawnSync) {
  const project = env.GCP_PROJECT_ID || 'project-1c568b10-6e24-4dc2-b2b';
  const filter = '(resource.type="cloud_run_revision" OR resource.type="cloud_run_job") ' +
    '(resource.labels.service_name="dealscout" OR resource.labels.service_name="dealscout-web" OR resource.labels.job_name="dealscout-maintenance") ' +
    '(textPayload:"[Rainforest discovery]" OR textPayload:"[Rainforest bulk intake]" OR textPayload:"[Deal discovery intake]")';
  const result = spawn('gcloud', ['logging', 'read', filter, '--project', project, '--freshness=48h',
    '--limit=1000', '--order=asc', '--format=json'], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  if (result.error || result.status !== 0) throw new Error('Discovery logs unavailable; the existing deployment identity may lack logging read access. No permissions were changed.');
  const entries = JSON.parse(result.stdout);
  if (!Array.isArray(entries)) throw new Error('Unexpected discovery log response');
  return { window: 'last 48 hours', logEntries: entries.length, possiblyTruncated: entries.length === 1000, ...summarize(entries) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const report = collect();
    console.log(JSON.stringify(report, null, 2));
    if (!Object.keys(report.groups).length) console.log('No matching discovery evidence in this window; this does not prove that scheduled pulls ran.');
    console.log('Selection counts include bulk verification pages; intake counts are separate observations, not a joined per-call conversion rate. Older logs may lack detailed reasons. No provider requests were made.');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
