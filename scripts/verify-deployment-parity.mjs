import { collectDeploymentEvidence } from './deployment-evidence.mjs';
import { assertPinnedParity } from './release-image.mjs';

let verified = false;
for (let attempt = 0; attempt < 4; attempt++) {
  try {
    const lines = assertPinnedParity(collectDeploymentEvidence(), process.env.GCP_IMAGE);
    lines.forEach(line => console.log(line));
    verified = true;
    break;
  } catch (error) {
    if (attempt === 3) console.error(error.message);
    else { console.log('Waiting for production revision status to converge'); await new Promise(resolve => setTimeout(resolve, 5000)); }
  }
}
if (!verified) process.exitCode = 1;
