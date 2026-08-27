function imageUrl(value) {
  if (!value) return null;
  if (typeof value === 'string') return /^https?:\/\//i.test(value) ? value : null;
  if (typeof value !== 'object') return null;
  const candidates = [value.link, value.url, value.src, value.large, value.hi_res, value.hiRes, value.image];
  for (const candidate of candidates) {
    const found = imageUrl(candidate);
    if (found) return found;
  }
  return null;
}

function imageCandidates(...values) {
  const out = [];
  const visit = (value) => {
    if (!value) return;
    if (Array.isArray(value)) return value.forEach(visit);
    const found = imageUrl(value);
    if (found && !out.includes(found)) out.push(found);
  };
  values.forEach(visit);
  return out;
}

module.exports = { imageUrl, imageCandidates };
