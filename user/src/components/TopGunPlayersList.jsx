import React, { useState } from 'react';

export default function TopGunPlayersList({ allBets, currentUserId }) {
  const [tab, setTab] = useState('all'); // all | my | top

  const defaultPlayers = [
    { id: 1, name: '6***2', bet: 20.00, mult: null, win: null, avatar: 1 },
    { id: 2, name: 'v***7', bet: 320.00, mult: null, win: null, avatar: 2 },
    { id: 3, name: 'A***g', bet: 100.00, mult: null, win: null, avatar: 3 },
    { id: 4, name: 'R***t', bet: 50.00, mult: 1.76, win: 88.00, avatar: 4 },
    { id: 5, name: 'S***g', bet: 250.00, mult: null, win: null, avatar: 5 },
    { id: 6, name: 'P***p', bet: 500.00, mult: null, win: null, avatar: 1 },
    { id: 7, name: 'M***k', bet: 75.00, mult: 2.10, win: 157.50, avatar: 2 },
    { id: 8, name: 'K***a', bet: 1000.00, mult: null, win: null, avatar: 3 },
    { id: 9, name: 'L***e', bet: 40.00, mult: null, win: null, avatar: 4 },
    { id: 10, name: 'J***n', bet: 20.00, mult: null, win: null, avatar: 5 }
  ];

  const mapped = (allBets && allBets.length > 0)
    ? allBets.map((b, idx) => ({
        id: b.id || idx,
        userId: b.userId,
        name: b.username && b.username.length > 3
          ? `${b.username[0]}***${b.username.slice(-1)}`
          : (b.username || 'P***p'),
        bet: b.betAmount,
        mult: b.cashoutMultiplier,
        win: b.winAmount,
        avatar: (idx % 5) + 1
      }))
    : defaultPlayers;

  let displayList = mapped;
  if (tab === 'my' && currentUserId) {
    displayList = mapped.filter((p) => p.userId === currentUserId);
  } else if (tab === 'top') {
    displayList = [...mapped]
      .filter((p) => p.win)
      .sort((a, b) => (b.win || 0) - (a.win || 0));
    if (displayList.length === 0) {
      displayList = [...mapped].sort((a, b) => (b.bet || 0) - (a.bet || 0));
    }
  }

  const totalCount = tab === 'all'
    ? (allBets && allBets.length > 0 ? allBets.length : 928)
    : displayList.length;

  const tabLabel = tab === 'all' ? 'ALL BETS' : tab === 'my' ? 'MY BETS' : 'TOP';

  const avatarColors = [
    'bg-[#3b4a6b]',
    'bg-[#5b3b6b]',
    'bg-[#3b6b4a]',
    'bg-[#6b4a3b]',
    'bg-[#3b5b6b]'
  ];

  const formatAmt = (n) =>
    n == null
      ? ''
      : Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="w-full h-full flex flex-col overflow-hidden select-none">
      {/* Compact mode tabs */}
      <div className="flex items-center justify-between gap-1 px-1 pb-1 shrink-0">
        <div className="flex items-center gap-1 bg-[#24060e]/90 border border-[#eab308]/40 rounded-full p-0.5 w-full">
          {[
            { id: 'all', label: `All (${totalCount})` },
            { id: 'my', label: 'My Bets' },
            { id: 'top', label: 'Top' }
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-0.5 rounded-full text-[10px] font-bold tracking-wide transition-all cursor-pointer ${
                tab === t.id
                  ? 'bg-[#9f1239] text-white shadow'
                  : 'text-amber-100/70 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Column headers */}
      <div className="px-2 py-1 text-[10px] font-bold text-amber-200/90 uppercase tracking-wider shrink-0">
        <div className="grid grid-cols-12 w-full">
          <span className="col-span-4 text-left">Users ({totalCount})</span>
          <span className="col-span-3 text-center">Bet</span>
          <span className="col-span-3 text-center">Payout</span>
          <span className="col-span-2 text-right">X</span>
        </div>
      </div>

      {/* Gold-bordered maroon table */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain rounded-xl border-2 border-[#eab308]/75 bg-[#2a0711]/90 divide-y divide-[#eab308]/20 scrollbar-thin">
        {displayList.length === 0 ? (
          <div className="text-center text-amber-100/60 text-xs py-6">No bets yet</div>
        ) : (
          displayList.map((p) => {
            const isWin = !!p.win && p.win > 0;
            return (
              <div
                key={p.id}
                className={`grid grid-cols-12 items-center px-2 py-1.5 text-[11px] font-bold ${
                  isWin ? 'bg-[#143a24]/70' : 'bg-[#4f1020]/55'
                }`}
              >
                <div className="col-span-4 flex items-center gap-1.5 truncate">
                  <div
                    className={`w-5 h-5 rounded-full ${avatarColors[(p.avatar || 1) - 1]} border border-white/25 flex items-center justify-center shrink-0 text-[9px] font-bold text-white`}
                  >
                    {p.name?.[0] || '?'}
                  </div>
                  <span className="truncate text-white/95">{p.name}</span>
                </div>

                <div className="col-span-3 text-center text-white/95 tabular-nums">
                  {formatAmt(p.bet)}
                </div>

                <div className="col-span-3 text-center tabular-nums">
                  {isWin ? (
                    <span className="text-[#4ade80]">{formatAmt(p.win)}</span>
                  ) : (
                    <span className="text-purple-200/60">0</span>
                  )}
                </div>

                <div className="col-span-2 text-right tabular-nums">
                  {p.mult ? (
                    <span className="text-[#facc15]">{Number(p.mult).toFixed(2)}x</span>
                  ) : (
                    <span className="text-purple-200/50">—</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
