import { ProviderGameSDK, ProviderSDKError } from '@gamotech/game-sdk-client';
import { API_BASE as GAME_API_BASE } from './config';

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
 *   | { mode: 'operations', session: object, gameJwt: string, user: object, balance: number }
 *   | { mode: 'provider', session: object, tableId: string }
 *   | { mode: 'error', error: string, status?: number, closeUrl?: string }
 * >}
 */
export async function initProviderSession() {
  const launch = getLaunchSessionParams();
  if (!launch.token) {
    ready = false;
    sdk = null;
    return { mode: 'local' };
  }

  // Operations Launch & Boot flow (?token=...&partner_code=...&gid=...)
  // Never calls /api/v1/wallet/* from the browser — forwards token to our game backend.
  const isLegacySdk = !!new URLSearchParams(window.location.search).get('sessionToken') && !!API_BASE;
  if (!isLegacySdk) {
    try {
      const res = await fetch(`${GAME_API_BASE}/api/provider/boot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: launch.token,
          partner_code: launch.partnerCode,
          gid: launch.gid,
          game_code: launch.gameCode,
          username: launch.username,
          user_id: launch.userId,
          currency: launch.currency,
          lang: launch.lang,
          extsess: launch.extsess
        })
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        return {
          mode: 'error',
          error: friendlySessionError(data?.error || 'Session validation failed', res.status),
          status: res.status,
          closeUrl: launch.closeUrl
        };
      }
      return {
        mode: 'operations',
        session: launch,
        gameJwt: data.token,
        user: data.user,
        balance: data.balance
      };
    } catch (err) {
      return {
        mode: 'error',
        error: err?.message || 'Unable to connect to game server.',
        closeUrl: launch.closeUrl
      };
    }
  }

  sdk = new ProviderGameSDK({ apiBaseUrl: API_BASE });
  try {
    // Legacy @gamotech/game-sdk-client flow (?sessionToken=...)
    const validated = await sdk.initFromUrl();
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
    return { mode: 'error', error: friendlySessionError(message, status), status, closeUrl: launch.closeUrl };
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
