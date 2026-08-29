import React from 'react';
import { X, Navigation, CheckCircle2, AlertTriangle } from 'lucide-react';

interface LocationPermissionModalProps {
  onClose: () => void;
  onRetry: () => void;
}

export const LocationPermissionModal: React.FC<LocationPermissionModalProps> = ({
  onClose,
  onRetry
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-4 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-2">
            <Navigation className="w-4 h-4 text-emerald-400" />
            <h3 className="font-bold text-sm text-slate-100 uppercase tracking-wide">
              Permiso de Ubicación GPS
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3.5 text-xs text-slate-300">
          <div className="p-3 bg-amber-950/40 border border-amber-800/60 rounded-xl flex items-start gap-2.5 text-amber-300">
            <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400" />
            <p className="leading-snug">
              Para registrar polígonos por caminata y calcular rutas peatonales con precisión táctica, la app necesita acceso a tu GPS.
            </p>
          </div>

          <div className="space-y-2">
            <p className="font-bold text-slate-100">Cómo activar en Android:</p>
            <ol className="space-y-1.5 list-decimal list-inside text-slate-300">
              <li>
                Toca el <b>icono del candado o ajustes</b> a la izquierda de la barra de direcciones del navegador.
              </li>
              <li>
                Selecciona <b>"Permisos"</b> o <b>"Ubicación"</b> y elige <b>"Permitir"</b>.
              </li>
              <li>
                Verifica que la <b>"Ubicación de alta precisión"</b> esté activa en los Ajustes de Android.
              </li>
            </ol>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-slate-950/60 border-t border-slate-800 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
          >
            Cerrar
          </button>
          <button
            onClick={() => {
              onClose();
              onRetry();
            }}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow"
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>Reintentar Conexión GPS</span>
          </button>
        </div>
      </div>
    </div>
  );
};
