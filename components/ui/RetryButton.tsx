'use client';

import { RotateCcw } from 'lucide-react';

export default function RetryButton() {
  return (
    <button 
      onClick={() => window.location.reload()} 
      className="text-[10px] font-bold text-brandAccent uppercase tracking-widest border border-brandAccent/20 px-6 py-2 rounded-pill hover:bg-brandBackground transition-all flex items-center gap-2 mx-auto"
    >
      <RotateCcw size={12} />
      Retry Connection
    </button>
  );
}
