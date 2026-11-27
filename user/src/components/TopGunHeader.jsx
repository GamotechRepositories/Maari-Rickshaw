import React from 'react';
import { IconChevronLeft } from './Icons';

export default function TopGunHeader({
  username = 'TopGunPilot',
  onOpenProfile
}) {
  return (
    <header className="w-full h-8 sm:h-9 bg-[#0a1115] border-b border-white/10 px-2.5 sm:px-4 flex items-center justify-between select-none z-30 shrink-0 safe-top">
      <div className="flex items-center gap-1 text-white/90 font-semibold text-xs sm:text-sm tracking-tight">
        <IconChevronLeft className="w-3.5 h-3.5 text-white/70" />
        <span>Rocket Rickshaw</span>
      </div>

      <button
        onClick={onOpenProfile}
        className="flex items-center gap-1.5 text-white/90 hover:text-white text-xs sm:text-sm font-semibold cursor-pointer"
        aria-label={username}
      >
        <span className="truncate max-w-[140px]">{username}</span>
        <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full overflow-hidden border border-white/25 bg-black/60 shrink-0">
          <img src="/riksha.png?v=7" alt="" className="w-full h-full object-contain p-0.5" />
        </div>
      </button>
    </header>
  );
}
