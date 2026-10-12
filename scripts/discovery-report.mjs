import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { appendFileSync } from 'node:fs';

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

export function reportSummary(report) {
  const lines = ['## Discovery yield evidence', '', 'Read-only report for the last 48 hours; no provider requests were made.', ''];
  const groups = Object.entries(report.groups || {});
  if (!groups.length) lines.push('No matching discovery evidence was found. This does not prove that scheduled pulls ran or that yield was zero.');
  for (const [kind, group] of groups) {
    lines.push(`### ${kind}`, '', `Observations: ${group.observations}`, '', '| Count | Total |', '| --- | ---: |');
    for (const key of fields) if (group.totals?.[key] !== undefined) lines.push(`| ${key} | ${group.totals[key]} |`);
    if (Object.keys(group.rejectionReasons || {}).length) {
      lines.push('', '| Rejection reason | Total |', '| --- | ---: |');
      for (const key of reasons) if (group.rejectionReasons[key] !== undefined) lines.push(`| ${key} | ${group.rejectionReasons[key]} |`);
    }
    lines.push('');
  }
  if (report.possiblyTruncated) lines.push('**The log limit was reached. These totals may omit later observations.**', '');
  if (report.malformed) lines.push(`Malformed observations excluded: ${report.malformed}`, '');
  lines.push('Selection counts include bulk verification pages. Intake counts are separate observations, not a joined per-call conversion rate. Older logs may lack detailed reasons.');
  return lines.join('\n') + '\n';
}

export function runReport(env = process.env, spawn = spawnSync, output = console, append = appendFileSync) {
  const save = text => {
    if (!env.GITHUB_STEP_SUMMARY) return;
    try { append(env.GITHUB_STEP_SUMMARY, text); }
    catch { output.error('Discovery report summary could not be saved; refer to the report in the job log.'); }
  };
  try {
    const report = collect(env, spawn);
    output.log(JSON.stringify(report, null, 2));
    const summary = reportSummary(report);
    save(summary);
    output.log(summary);
    return true;
  } catch {
    const message = 'Discovery yield unavailable: production counts could not be read. Maintenance success is separate from discovery-yield evidence; no zero-yield conclusion can be drawn. No provider requests were made.';
    output.error(message);
    if (env.GITHUB_ACTIONS === 'true') output.error('::warning title=Discovery yield unavailable::Production counts could not be read. See the job summary; maintenance success does not establish discovery yield.');
    save(`## Discovery yield unavailable\n\n${message}\n\nThe existing deployment identity may lack logging read access. No permissions were changed.\n`);
    return false;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!runReport()) process.exitCode = 1;
}
