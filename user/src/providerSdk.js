import { ProviderGameSDK, ProviderSDKError } from '@gamotech/game-sdk-client';

/**
 * Phase 3 — Game client (Provider Integration Guide)
 *
 * launchUrl → ?sessionToken=...
 * 1) POST /sessions/validate
 * 2) TABLE_CREATED
 * 3) ROUND_CREATED → ROUND_STARTED → ROUND_ENDED (per crash round)
 * 4) SESSION_ENDED on unload
 *
 * Wallet debit/credit stays on the Java game server (never in browser).
 */

const API_BASE = import.meta.env.VITE_PROVIDER_API_URL || '';

let sdk = null;
let tableId = null;
let ready = false;

export function getProviderSdk() {
  return sdk;
}

export function isProviderReady() {
  return ready && !!sdk?.sessionToken;
}

export function getLaunchSessionParams(search = window.location.search) {
  const params = new URLSearchParams(search);
  return {
    token: params.get('token') || params.get('sessionToken'),
    partnerCode: params.get('partner_code'),
    gid: params.get('gid'),
    gameCode: params.get('game_code'),
    username: params.get('username'),
    userId: params.get('user_id'),
    currency: params.get('currency') || 'INR',
    lang: params.get('lang') || 'en',
    extsess: params.get('extsess'),
    closeUrl: params.get('close_url')
  };
}

export function getSessionToken() {
  return sdk?.sessionToken || getLaunchSessionParams().token || null;
}

export function getProviderTableId() {
  return tableId;
}

export function hasLaunchSessionToken(search = window.location.search) {
  return !!getLaunchSessionParams(search).token;
}

/**
 * @returns {Promise<
 *   | { mode: 'local' }
 *   | { mode: 'provider', session: object, tableId: string }
 *   | { mode: 'error', error: string, status?: number }
 * >}
 */
export async function initProviderSession() {
  const launch = getLaunchSessionParams();
  const launchedWithToken = !!launch.token;
  sdk = new ProviderGameSDK({ apiBaseUrl: API_BASE });

  if (!launchedWithToken) {
    ready = false;
    sdk = null;
    return { mode: 'local' };
  }

  try {
    // 1) Validate session (supports both ?token=... from Game Developer Guide and ?sessionToken=...)
    const hasSessionTokenParam = !!new URLSearchParams(window.location.search).get('sessionToken');
    const validated = hasSessionTokenParam
      ? await sdk.initFromUrl()
      : typeof sdk.validateSession === 'function'
        ? await sdk.validateSession(launch.token)
        : await sdk.initFromUrl(`?sessionToken=${encodeURIComponent(launch.token)}`);
    const session = {
      ...launch,
      ...(validated || {}),
      playerUsername: validated?.playerUsername || launch.username,
      playerId: validated?.playerId || launch.userId,
      operatorId: validated?.operatorId || launch.partnerCode,
      gameCode: validated?.gameCode || launch.gameCode,
      currency: validated?.currency || launch.currency,
      language: validated?.language || launch.lang
    };
    sdk.attachUnloadHandler();

    // 2) TABLE_CREATED after local table setup
    tableId = await sdk.createTable({
      tableId: `bulletrani_${Date.now()}`,
      game: session.gameCode || 'BULLETRANI'
    });

    ready = true;
    return { mode: 'provider', session, tableId };
  } catch (err) {
    ready = false;
    sdk = null;
    tableId = null;

    const message = err?.message || 'Session invalid';
    const status = err?.status;
    // Token was present but validation/events failed → block gameplay
    return { mode: 'error', error: friendlySessionError(message, status), status };
  }
}

function friendlySessionError(message, status) {
  if (status === 401 || /expired|missing/i.test(message)) {
    return 'Session expired or missing. Please re-launch the game from your operator lobby.';
  }
  if (status === 403 || /ended|revoked|closed/i.test(message)) {
    return 'Session closed. Please re-launch the game from your operator lobby.';
  }
  if (status === 404 || /not found|invalid/i.test(message)) {
    return 'Invalid session. Please re-launch the game from your operator lobby.';
  }
  return message || 'Unable to start Provider session.';
}

/** ROUND_CREATED — when the game allocates a new round (countdown / preparing) */
export async function notifyRoundCreated(roundNumber, payload = {}) {
  if (!isProviderReady()) return;
  try {
    await sdk.createRound({
      roundId: String(roundNumber),
      tableId,
      ...payload
    });
  } catch (e) {
    console.warn('[provider] ROUND_CREATED failed', e);
  }
}

/** ROUND_STARTED — when flight / gameplay begins */
export async function notifyRoundStarted(roundNumber, payload = {}) {
  if (!isProviderReady()) return;
  try {
    await sdk.startRound({
      roundId: String(roundNumber),
      tableId,
      ...payload
    });
  } catch (e) {
    console.warn('[provider] ROUND_STARTED failed', e);
  }
}

/** Step 7: ROUND_ENDED */
export async function notifyRoundEnded(roundNumber, payload = {}) {
  if (!isProviderReady()) return;
  try {
    await sdk.endRound({
      roundId: String(roundNumber),
      tableId,
      ...payload
    });
  } catch (e) {
    console.warn('[provider] ROUND_ENDED failed', e);
  }
}

export function exitGame(closeUrl) {
  if (!closeUrl) return window.close();
  try {
    (window.top || window).location.href = closeUrl;
  } catch {
    window.location.href = closeUrl;
  }
}

export { ProviderSDKError };
