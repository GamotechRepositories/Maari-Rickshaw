import React from 'react';
import { exitGame } from '../providerSdk';

/**
 * Blocks gameplay when launch URL had token/sessionToken but validation failed (401/403/404).
 */
export default function SessionGate({ title, message, closeUrl }) {
  return (
    <div className="min-h-dvh bg-[#050b14] text-white flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-3xl border border-white/10 bg-[#121622] p-6 shadow-2xl text-center">
        <div className="mx-auto mb-4 w-14 h-14 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center">
          <span className="text-red-400 text-lg font-black">!</span>
        </div>
        <h1
          className="text-xl font-black tracking-wide mb-2"
          style={{ fontFamily: "'Chakra Petch', sans-serif" }}
        >
          {title || 'Session unavailable'}
        </h1>
        <p className="text-sm text-gray-400 leading-relaxed mb-5">{message}</p>
        {closeUrl ? (
          <button
            onClick={() => exitGame(closeUrl)}
            className="w-full py-2.5 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-bold text-sm cursor-pointer transition-colors"
          >
            Return to Lobby
          </button>
        ) : (
          <p className="text-[11px] text-gray-500">
            Open this game from your operator lobby so a valid{' '}
            <code className="text-gray-300">token</code> is issued.
          </p>
        )}
      </div>
    </div>
  );
}
