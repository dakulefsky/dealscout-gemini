import { fileURLToPath } from 'node:url';
import path from 'node:path';

export function immutableBuiltImage(build, tag) {
  const image = build.results?.images?.find(image => image.name === tag);
  if (!image || !/^sha256:[a-f0-9]{64}$/.test(image.digest || '') || !/^[a-z0-9][a-z0-9._/:+-]*:[a-f0-9]{40}$/.test(tag)) throw new Error('The completed build has no valid digest for the expected commit image');
  return `${tag.slice(0, tag.lastIndexOf(':'))}@${image.digest}`;
}

export function assertPinnedParity(services, expected) {
  if (!/^[a-z0-9][a-z0-9._/:+-]*@sha256:[a-f0-9]{64}$/.test(expected || '')) throw new Error('An immutable image digest is required');
  if (services.length !== 2) throw new Error('Both production services must be checked');
  for (const service of services) {
    if (service.desiredImage !== expected || service.readyImageDigest !== expected || !service.latestReadyRevision || service.latestCreatedRevision !== service.latestReadyRevision || service.traffic.length !== 1 || Number(service.traffic[0].percent) !== 100 || service.traffic[0].revision !== service.latestReadyRevision) {
      throw new Error(`${service.service} is not serving 100% of the expected immutable image on its latest ready revision`);
    }
  }
  return services.map(service => `${service.service}: ${service.latestReadyRevision}, 100% traffic, ${service.readyImageDigest}`);
}

async function main() {
  let input = '';
  for await (const chunk of process.stdin) input += chunk;
  console.log(immutableBuiltImage(JSON.parse(input), process.argv[2]));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => { console.error('Unable to pin the completed build to its expected image digest'); process.exitCode = 1; });
}
