const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_TOKEN_RE = /^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/;
const MAX_MESSAGES_PER_REQUEST = 100;
const DEFAULT_TIMEOUT_MS = 10_000;

function normalizeMessage(message = {}) {
  const to = String(message.to || '').trim();
  if (!EXPO_TOKEN_RE.test(to)) throw new Error('A valid Expo push token is required');

  const normalized = { to };
  for (const key of ['title', 'body', 'sound', 'channelId', 'categoryId', 'subtitle']) {
    if (message[key] !== undefined && message[key] !== null && String(message[key]) !== '') normalized[key] = message[key];
  }
  if (message.data !== undefined) normalized.data = message.data;
  if (message.badge !== undefined) normalized.badge = message.badge;
  if (message.priority !== undefined) normalized.priority = message.priority;
  if (message.ttl !== undefined) normalized.ttl = message.ttl;
  return normalized;
}

function chunk(items, size = MAX_MESSAGES_PER_REQUEST) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

function ticketError(ticket) {
  return String(ticket?.details?.error || ticket?.message || '').trim();
}

async function sendExpoPush(messages, {
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  endpoint = EXPO_PUSH_URL,
} = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('Push delivery requires fetch');
  const normalized = (Array.isArray(messages) ? messages : [messages]).filter(Boolean).map(normalizeMessage);
  if (normalized.length === 0) return { sentCount: 0, acceptedCount: 0, failedCount: 0, tickets: [], deviceNotRegisteredTokens: [] };

  const tickets = [];
  const deviceNotRegisteredTokens = [];

  for (const batch of chunk(normalized)) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.max(1000, Number(timeoutMs) || DEFAULT_TIMEOUT_MS));
    let response;
    try {
      response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'Accept-Encoding': 'gzip, deflate',
        },
        body: JSON.stringify(batch),
        signal: controller.signal,
      });
    } catch (error) {
      if (error?.name === 'AbortError') throw new Error('Expo push request timed out');
      throw error;
    } finally {
      clearTimeout(timeout);
    }

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const message = payload?.errors?.[0]?.message || payload?.error || `Expo push request failed with HTTP ${response.status}`;
      const error = new Error(message);
      error.status = response.status;
      throw error;
    }

    const batchTickets = Array.isArray(payload?.data) ? payload.data : [];
    if (batchTickets.length !== batch.length) throw new Error('Expo push response did not match the submitted message count');
    tickets.push(...batchTickets);

    batchTickets.forEach((ticket, index) => {
      if (ticket?.status === 'error' && ticketError(ticket) === 'DeviceNotRegistered') {
        deviceNotRegisteredTokens.push(batch[index].to);
      }
    });
  }

  const failedCount = tickets.filter((ticket) => ticket?.status === 'error').length;
  return {
    sentCount: normalized.length,
    acceptedCount: normalized.length - failedCount,
    failedCount,
    tickets,
    deviceNotRegisteredTokens: [...new Set(deviceNotRegisteredTokens)],
  };
}

module.exports = {
  EXPO_PUSH_URL,
  MAX_MESSAGES_PER_REQUEST,
  normalizeMessage,
  sendExpoPush,
};
