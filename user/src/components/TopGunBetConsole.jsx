import React, { useState, useEffect } from 'react';

export default function TopGunBetConsole({
  panelId,
  gameState,
  currentMultiplier,
  userBalance,
  activeBet,
  onPlaceBet,
  onCancelBet,
  onCashout,
  sound,
  collapsible = false,
  collapsed = false,
  onToggleCollapse
}) {
  const [amount, setAmount] = useState(20);
  const [mode, setMode] = useState('bet');
  const [autoCashout, setAutoCashout] = useState(2.0);

  const presets = [20, 100, 1000, 5000];

  useEffect(() => {
    if (gameState === 'WAITING' && mode === 'auto' && !activeBet) {
      onPlaceBet(panelId, amount, autoCashout);
    }
  }, [gameState, mode, activeBet]);

  const handleAmountChange = (val) => {
    if (sound) sound.playClick();
    setAmount(Math.max(10, Math.min(100000, Math.round(val))));
  };

  const handleActionClick = () => {
    if (sound) sound.playClick();
    if (!activeBet) {
      onPlaceBet(panelId, amount, mode === 'auto' ? autoCashout : null);
    } else if (gameState === 'WAITING') {
      onCancelBet(panelId);
    } else if (gameState === 'FLYING' && activeBet.status === 'active') {
      onCashout(panelId);
    }
  };

  const liveWinAmount = activeBet && gameState === 'FLYING'
    ? (activeBet.betAmount * currentMultiplier).toFixed(2)
    : null;

  const formatAmt = (n) =>
    Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (collapsed && collapsible) {
    return (
      <button
        onClick={onToggleCollapse}
        className="w-full min-h-[56px] bg-[#1b1c1e] rounded-xl px-4 flex items-center justify-between select-none cursor-pointer border border-dashed border-white/10 hover:border-white/20 transition-colors"
      >
        <span className="text-[12px] font-bold text-gray-200">+ Add Bet {panelId}</span>
        <span className="text-[10px] text-gray-500">Tap to open</span>
      </button>
    );
  }

  const cyclePreset = () => {
    if (activeBet) return;
    const idx = presets.indexOf(amount);
    const next = presets[(idx + 1) % presets.length];
    handleAmountChange(next);
  };

  const setMaxAmount = () => {
    if (activeBet) return;
    const maxVal = Math.min(5000, Math.max(20, Math.floor(userBalance || 20)));
    handleAmountChange(maxVal);
  };

  const actionBtn =
    'w-full h-full rounded-xl font-black flex flex-col items-center justify-center gap-0.5 active:scale-[0.98] cursor-pointer transition-transform py-1.5 border-2 border-[#facc15] shadow-[0_3px_10px_rgba(0,0,0,0.45)]';

  return (
    <div className="relative w-full bg-[#26060f]/85 rounded-xl p-1.5 flex items-stretch gap-1.5 select-none border border-[#eab308]/40">
      {/* Left column: Cream-gold amount stepper + Auto Cashout toggle */}
      <div className="w-[44%] min-w-0 flex flex-col justify-between gap-1.5">
        <div className="flex items-center justify-between bg-[#fef3c7] border-2 border-[#eab308] rounded-full h-8 px-1 shadow-inner">
          <button
            onClick={() => handleAmountChange(amount - 20)}
            disabled={!!activeBet}
            className="w-6 h-6 rounded-full bg-[#9f1239] border border-[#facc15] text-[#facc15] flex items-center justify-center text-[10px] font-black leading-none disabled:opacity-40 active:scale-95 cursor-pointer shrink-0"
            aria-label="Decrease bet"
          >
            ▼
          </button>
          <div className="font-black text-[#450a0a] text-[13px] tracking-tight tabular-nums truncate px-1 leading-none">
            {formatAmt(amount)}
          </div>
          <button
            onClick={() => handleAmountChange(amount + 20)}
            disabled={!!activeBet}
            className="w-6 h-6 rounded-full bg-[#9f1239] border border-[#facc15] text-[#facc15] flex items-center justify-center text-[10px] font-black leading-none disabled:opacity-40 active:scale-95 cursor-pointer shrink-0"
            aria-label="Increase bet"
          >
            ▲
          </button>
        </div>

        <div className="flex items-center justify-between gap-1 px-0.5">
          <span className="text-[9px] font-extrabold uppercase tracking-wide text-amber-100/90 leading-tight">
            Auto Cashout
          </span>
          <button
            type="button"
            onClick={() => {
              if (sound) sound.playClick();
              setMode((m) => (m === 'auto' ? 'bet' : 'auto'));
            }}
            className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer shrink-0 border ${
              mode === 'auto'
                ? 'bg-[#22c55e] border-[#fef08a]'
                : 'bg-[#160409] border-[#eab308]/35'
            }`}
            aria-label="Toggle auto cashout"
          >
            <div
              className={`w-3.5 h-3.5 rounded-full bg-white transition-transform ${
                mode === 'auto' ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
          {mode === 'auto' && (
            <input
              type="number"
              min="1.01"
              step="0.1"
              value={autoCashout}
              disabled={!!activeBet}
              onChange={(e) => setAutoCashout(Math.max(1.01, parseFloat(e.target.value) || 1.01))}
              className="w-11 bg-[#1a050b] border border-[#eab308]/60 rounded px-1 py-0.5 text-right text-[#facc15] text-[10px] font-bold outline-none"
            />
          )}
        </div>
      </div>

      {/* Middle column: SELECT & MAX */}
      <div className="w-[24%] min-w-0 flex flex-col gap-1">
        <button
          type="button"
          disabled={!!activeBet}
          onClick={cyclePreset}
          className="flex-1 rounded-lg bg-gradient-to-b from-[#881337] to-[#4c0519] border border-[#facc15] text-white text-[10px] font-extrabold uppercase tracking-wide cursor-pointer active:scale-95 disabled:opacity-40"
        >
          Select
        </button>
        <button
          type="button"
          disabled={!!activeBet}
          onClick={setMaxAmount}
          className="flex-1 rounded-lg bg-gradient-to-b from-[#881337] to-[#4c0519] border border-[#facc15] text-white text-[10px] font-extrabold uppercase tracking-wide cursor-pointer active:scale-95 disabled:opacity-40"
        >
          Max
        </button>
      </div>

      {/* Right column: Big BET / CANCEL / CASHOUT */}
      <div className="w-[32%] min-w-0 flex">
        {activeBet && activeBet.status === 'active' && gameState === 'FLYING' ? (
          <button
            onClick={handleActionClick}
            className={`${actionBtn} bg-gradient-to-b from-[#f59e0b] to-[#d97706] text-white animate-pulse`}
          >
            <span className="text-[10px] uppercase tracking-wide font-extrabold leading-none">Cash Out</span>
            <span className="text-[14px] font-black leading-none tabular-nums">{formatAmt(liveWinAmount)}</span>
          </button>
        ) : activeBet && activeBet.status === 'active' && gameState === 'WAITING' ? (
          <button
            onClick={handleActionClick}
            className={`${actionBtn} bg-gradient-to-b from-[#ef4444] to-[#b91c1c] text-white`}
          >
            <span className="text-[10px] uppercase tracking-wide font-extrabold leading-none">Cancel</span>
            <span className="text-[14px] font-black leading-none tabular-nums">{formatAmt(activeBet.betAmount)}</span>
          </button>
        ) : activeBet && activeBet.status === 'cashed_out' ? (
          <div className={`${actionBtn} bg-[#14301f] border-emerald-400 text-emerald-300 cursor-default`}>
            <span className="text-[10px] uppercase tracking-wide font-extrabold leading-none">Won</span>
            <span className="text-[14px] font-black leading-none tabular-nums">+{formatAmt(activeBet.winAmount)}</span>
          </div>
        ) : (
          <button
            onClick={handleActionClick}
            disabled={userBalance < amount}
            className={`${actionBtn} bg-gradient-to-b from-[#9f1239] to-[#5b0b22] text-white disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            <span className="text-[12px] uppercase tracking-wider font-black leading-none">BET</span>
            <span className="text-[14px] font-black leading-none tabular-nums">{formatAmt(amount)}</span>
          </button>
        )}
      </div>
    </div>
  );
}
