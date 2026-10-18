/**
 * In-store API HTTP server bridge (Node.js / main process)
 *
 * Hosts the multi-register HTTP API for server-mode registers. The desktop
 * (Electron) app is the only supported server host — Android/iOS registers
 * run as clients and must never open a listening socket on the LAN.
 *
 * The main process owns the socket; route handling stays in the renderer.
 * Each request is forwarded to the renderer via `instore-server-request`
 * events with a generated `requestId`, and the renderer answers through the
 * `instore-server-respond` IPC channel. Pending responses time out so a hung
 * renderer cannot leak sockets.
 */

const http = require('http');
const crypto = require('crypto');

const REQUEST_TIMEOUT_MS = 30000;
const MAX_REQUEST_BODY_LENGTH = 1024 * 1024;
const MAX_PENDING_REQUESTS = 256;

let server = null;
let emitRequest = null;
const pendingResponses = new Map();

/**
 * Start the HTTP server.
 * @param {number} port
 * @param {(request: object) => void} onRequest — called with { requestId, method, url, headers, data }
 * @returns {Promise<void>}
 */
function startInstoreServer(port, onRequest) {
  if (server) {
    return Promise.reject(new Error('In-store API server already running'));
  }

  emitRequest = onRequest;
  pendingResponses.clear();

  server = http.createServer((req, res) => {
    const requestId = crypto.randomUUID();

    const chunks = [];
    let received = 0;
    let aborted = false;

    req.on('data', chunk => {
      received += chunk.length;
      if (received > MAX_REQUEST_BODY_LENGTH && !aborted) {
        aborted = true;
        sendJson(res, 413, { error: 'Request body too large' });
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      if (aborted) return;

      if (pendingResponses.size >= MAX_PENDING_REQUESTS) {
        sendJson(res, 503, { error: 'Server busy' });
        return;
      }

      const entry = { res };
      entry.timer = setTimeout(() => {
        pendingResponses.delete(requestId);
        sendJson(res, 504, { error: 'Request timed out' });
      }, REQUEST_TIMEOUT_MS);

      pendingResponses.set(requestId, entry);
      emitRequest?.({
        requestId,
        method: req.method || 'GET',
        url: req.url || '/',
        headers: normaliseHeaders(req.headers),
        data: Buffer.concat(chunks).toString('utf8'),
      });
    });

    req.on('error', () => {
      pendingResponses.delete(requestId);
      if (!res.destroyed) res.destroy();
    });
  });

  return new Promise((resolve, reject) => {
    const onError = err => {
      server = null;
      emitRequest = null;
      reject(err instanceof Error ? err : new Error(String(err)));
    };
    server.once('error', onError);
    server.listen(port, () => {
      server?.removeListener('error', onError);
      resolve();
    });
  });
}

/**
 * Stop the HTTP server and fail every pending request.
 * @returns {Promise<void>}
 */
function stopInstoreServer() {
  const current = server;
  server = null;
  emitRequest = null;

  for (const entry of pendingResponses.values()) {
    clearTimeout(entry.timer);
    sendJson(entry.res, 503, { error: 'Server stopped' });
  }
  pendingResponses.clear();

  return new Promise(resolve => {
    if (current) {
      current.close(() => resolve());
    } else {
      resolve();
    }
  });
}

/**
 * Respond to a request forwarded to the renderer.
 * @param {string} requestId
 * @param {number} status
 * @param {string} mimeType
 * @param {string} body
 * @returns {boolean} — false when the request is unknown or already answered
 */
function respondToInstoreRequest(requestId, status, mimeType, body) {
  const entry = pendingResponses.get(requestId);
  if (!entry) {
    return false;
  }
  pendingResponses.delete(requestId);
  clearTimeout(entry.timer);

  const res = entry.res;
  res.writeHead(status, { 'Content-Type': mimeType });
  res.end(body);
  return true;
}

function normaliseHeaders(headers) {
  const result = {};
  for (const [key, value] of Object.entries(headers || {})) {
    result[key] = Array.isArray(value) ? value.join(', ') : String(value ?? '');
  }
  return result;
}

function sendJson(res, status, payload) {
  if (res.writableEnded) return;
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

module.exports = {
  startInstoreServer,
  stopInstoreServer,
  respondToInstoreRequest,
};
