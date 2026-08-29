import React from 'react';
import { RefreshCw, X, Sparkles } from 'lucide-react';
import { swUpdateManager } from '../services/swUpdateManager';

interface UpdateNotificationBannerProps {
  onDismiss: () => void;
}

export const UpdateNotificationBanner: React.FC<UpdateNotificationBannerProps> = ({
  onDismiss
}) => {
  return (
    <div className="absolute top-16 left-3 right-3 sm:left-auto sm:right-4 sm:w-96 z-50 bg-slate-900/95 border-2 border-emerald-500 rounded-2xl p-3.5 shadow-2xl backdrop-blur-md animate-in slide-in-from-top-4 flex items-center justify-between gap-3 text-slate-100 ring-4 ring-emerald-500/20">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="p-2 bg-emerald-500 text-slate-950 rounded-xl font-bold shrink-0">
          <Sparkles className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <h4 className="text-xs font-bold text-emerald-200">
            Hay una nueva versión disponible.
          </h4>
          <p className="text-[11px] text-slate-300">
            Actualizar ahora (conserva todos tus datos intactos)
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={() => swUpdateManager.applyUpdate()}
          className="px-3 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow-lg flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Actualizar</span>
        </button>
        <button
          onClick={onDismiss}
          className="p-1.5 text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
          title="Cerrar aviso"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
