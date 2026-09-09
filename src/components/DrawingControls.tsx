import React from 'react';
import { 
  Check, 
  X, 
  RotateCcw, 
  Footprints, 
  Square, 
  Pentagon, 
  AlertCircle,
  Type,
  Edit3,
  Fingerprint,
  RefreshCw
} from 'lucide-react';
import { DrawingToolMode, GPSState, ActiveRoute, LabelFontSize } from '../types';
import { formatArea, formatDistance } from '../services/geoUtils';

interface DrawingControlsProps {
  mode: DrawingToolMode;
  isAdminUnlocked?: boolean;
  onRequestUnlock?: () => void;
  onSetMode: (mode: DrawingToolMode) => void;
  onWalkPerimeter: () => void;
  activeRoute?: ActiveRoute | null;
  onClearRoute?: () => void;
  vertices: [number, number][];
  currentAreaM2: number;
  currentPerimeterM: number;
  gpsState: GPSState;
  onUndoVertex: () => void;
  onClearVertices: () => void;
  onFinishDrawing: () => void;
  onCancelDrawing: () => void;
  // Letter placement mode props
  letterText?: string;
  onChangeLetterText?: (text: string) => void;
  letterFontSize?: LabelFontSize;
  onChangeLetterFontSize?: (size: LabelFontSize) => void;
  onCancelLetterMode?: () => void;
  onOpenLetterModal?: () => void;
  onUpdateDatabase?: () => void;
  isUpdatingDatabase?: boolean;
}

export const DrawingControls: React.FC<DrawingControlsProps> = ({
  mode,
  isAdminUnlocked = false,
  onRequestUnlock,
  onSetMode,
  onWalkPerimeter,
  activeRoute,
  onClearRoute,
  vertices,
  currentAreaM2,
  currentPerimeterM,
  onUndoVertex,
  onClearVertices,
  onFinishDrawing,
  onCancelDrawing,
  letterText = 'A',
  letterFontSize = 'md',
  onCancelLetterMode,
  onOpenLetterModal,
  onUpdateDatabase,
  isUpdatingDatabase = false
}) => {
  if (mode === 'none') {
    return (
      <div className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 z-20 flex items-center pointer-events-auto max-w-[calc(100vw-1.5rem)]">
        <div className="bg-slate-950/90 backdrop-blur-md border border-slate-700/80 p-1 sm:p-1.5 rounded-xl shadow-2xl flex flex-wrap gap-1.5 items-center justify-end">
          {/* Drawing & Letter tools when Admin Mode is enabled */}
          {isAdminUnlocked ? (
            <>
              <button
                id="btn-mode-polygon"
                onClick={() => onSetMode('polygon')}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs sm:text-sm rounded-lg shadow transition active:scale-95 whitespace-nowrap"
                title="Dibujar polígono vértice por vértice haciendo clic en el mapa"
              >
                <Pentagon className="w-4 h-4 shrink-0" />
                <span>Dibujar Polígono</span>
              </button>

              {/* Button: Letra (Abre el diálogo para escribir la letra y luego pulsar Colocar en el mapa) */}
              <button
                id="btn-mode-letter"
                onClick={onOpenLetterModal || (() => onSetMode('letter'))}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm rounded-lg shadow transition active:scale-95 whitespace-nowrap"
                title="Agregar letra o etiqueta georreferenciada sobre el mapa"
              >
                <Type className="w-4 h-4 shrink-0" />
                <span>Letra</span>
              </button>
            </>
          ) : (
            /* Quick Unlock trigger button when in Normal / Locked Mode */
            onRequestUnlock && (
              <button
                id="btn-quick-unlock-drawing"
                onClick={onRequestUnlock}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 bg-slate-900/90 hover:bg-amber-950/80 text-amber-300 font-semibold text-xs sm:text-sm rounded-lg border border-amber-500/40 shadow transition active:scale-95 whitespace-nowrap"
                title="Desbloquear con huella dactilar para dibujar polígonos o colocar letras"
              >
                <Fingerprint className="w-4 h-4 text-amber-400 shrink-0 stroke-[2.5]" />
                <span>Desbloquear Edición</span>
              </button>
            )
          )}

          {/* Caminar Perímetro is always accessible to normal and admin users */}
          <button
            id="btn-walk-perimeter"
            onClick={onWalkPerimeter}
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs sm:text-sm rounded-lg shadow-lg transition active:scale-95 whitespace-nowrap tracking-wide"
            title="Calcular y mostrar automáticamente la ruta para caminar hacia el territorio"
          >
            <Footprints className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5] shrink-0" />
            <span>Caminar Perímetro</span>
          </button>

          {/* Botón ACTUALIZAR en la pantalla principal, junto a los demás botones */}
          <button
            id="btn-main-actualizar"
            type="button"
            onClick={onUpdateDatabase}
            disabled={isUpdatingDatabase}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white font-black text-xs sm:text-sm rounded-lg shadow-lg transition active:scale-95 whitespace-nowrap tracking-wide cursor-pointer ${
              isUpdatingDatabase ? 'opacity-75 cursor-wait' : ''
            }`}
            title="Actualizar base de datos de territorios"
          >
            <RefreshCw className={`w-4 h-4 sm:w-5 sm:h-5 shrink-0 ${isUpdatingDatabase ? 'animate-spin' : ''}`} />
            <span>ACTUALIZAR</span>
          </button>

          {activeRoute && onClearRoute && (
            <button
              id="btn-clear-route"
              onClick={onClearRoute}
              className="flex items-center gap-1.5 px-2.5 py-2 bg-slate-800 hover:bg-rose-950 text-slate-300 hover:text-rose-300 font-bold text-xs rounded-lg border border-slate-700 hover:border-rose-700 transition active:scale-95 whitespace-nowrap"
              title="Quitar trazado de ruta del mapa"
            >
              <X className="w-4 h-4 shrink-0" />
              <span>Quitar Ruta</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // Active Letter Placement Guidance Banner
  if (mode === 'letter') {
    return (
      <div 
        id="banner-placing-letter"
        className="absolute top-16 left-3 right-3 sm:left-auto sm:right-4 sm:w-96 z-30 bg-slate-950/95 backdrop-blur-md border-2 border-amber-400 rounded-2xl p-3 shadow-2xl transition-all animate-fadeIn"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            {/* Visual active letter badge */}
            <div className="w-10 h-10 rounded-xl bg-slate-900 border-2 border-amber-400 flex items-center justify-center font-mono font-black text-amber-300 text-xl shadow-lg shrink-0">
              {letterText || 'A'}
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                <span>Modo: Colocar Letra</span>
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              </h4>
              <p className="text-[11px] text-amber-200 font-semibold leading-tight mt-0.5">
                Toca cualquier punto del mapa o polígono para colocarla
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {onOpenLetterModal && (
              <button
                onClick={onOpenLetterModal}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-xl border border-slate-700 transition"
                title="Cambiar letra o tamaño"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            )}

            <button
              id="btn-cancel-placing-letter"
              onClick={onCancelLetterMode || onCancelDrawing}
              className="p-1.5 bg-slate-800 hover:bg-rose-950 text-slate-300 hover:text-rose-300 rounded-xl border border-slate-700 transition"
              title="Salir del modo colocar letra"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Footer info bar */}
        <div className="mt-2.5 pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
          <span className="text-slate-400 text-[11px]">
            Tamaño: <strong className="text-amber-300 uppercase">{letterFontSize}</strong>
          </span>
          <button
            onClick={onCancelLetterMode || onCancelDrawing}
            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-white font-bold rounded-lg transition"
          >
            Salir
          </button>
        </div>
      </div>
    );
  }

  const isPolygonReady = vertices.length >= 3;

  return (
    <div className="absolute top-16 left-3 right-3 sm:left-auto sm:right-4 sm:w-96 z-20 bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-2xl p-3 shadow-2xl transition-all">
      {/* Top Banner: Mode & Status */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          {mode === 'polygon' && (
            <div className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg border border-emerald-500/40">
              <Pentagon className="w-4 h-4" />
            </div>
          )}
          {mode === 'rectangle' && (
            <div className="p-1.5 bg-blue-500/20 text-blue-400 rounded-lg border border-blue-500/40">
              <Square className="w-4 h-4" />
            </div>
          )}
          <div>
            <h4 className="text-xs font-bold text-slate-100 uppercase tracking-wide">
              {mode === 'polygon' && 'Dibujo Poligonal Manual'}
              {mode === 'rectangle' && 'Modo Rectángulo'}
            </h4>
            <p className="text-[11px] text-slate-400">
              {mode === 'polygon' && 'Toca el mapa para colocar los vértices del perímetro'}
              {mode === 'rectangle' && 'Toca dos esquinas opuestas en el mapa'}
            </p>
          </div>
        </div>

        <button
          onClick={onCancelDrawing}
          className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg"
          title="Cancelar dibujo"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Live Geodesic Metrics */}
      <div className="grid grid-cols-3 gap-2 my-2.5">
        <div className="bg-slate-950/70 p-2 rounded-xl border border-slate-800/80 text-center">
          <span className="text-[10px] uppercase font-mono text-slate-400 block">Vértices</span>
          <span className="text-sm font-bold font-mono text-emerald-400">{vertices.length}</span>
        </div>
        <div className="bg-slate-950/70 p-2 rounded-xl border border-slate-800/80 text-center">
          <span className="text-[10px] uppercase font-mono text-slate-400 block">Área estimada</span>
          <span className="text-sm font-bold font-mono text-cyan-400 truncate block">
            {formatArea(currentAreaM2)}
          </span>
        </div>
        <div className="bg-slate-950/70 p-2 rounded-xl border border-slate-800/80 text-center">
          <span className="text-[10px] uppercase font-mono text-slate-400 block">Perímetro</span>
          <span className="text-sm font-bold font-mono text-amber-400 truncate block">
            {formatDistance(currentPerimeterM)}
          </span>
        </div>
      </div>

      {/* Notice if not enough vertices */}
      {!isPolygonReady && (
        <div className="flex items-center gap-1.5 text-amber-400 bg-amber-950/40 border border-amber-800/50 p-2 rounded-lg text-xs mb-2.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>Se requieren al menos 3 vértices para guardar el territorio ({vertices.length}/3)</span>
        </div>
      )}

      {/* Drawing Actions Toolbar */}
      <div className="flex items-center gap-2">
        <button
          onClick={onUndoVertex}
          disabled={vertices.length === 0}
          className="flex-1 py-2 px-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 flex items-center justify-center gap-1.5 transition"
          title="Deshacer último vértice"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Deshacer</span>
        </button>

        <button
          onClick={onClearVertices}
          disabled={vertices.length === 0}
          className="py-2 px-2 bg-slate-800 hover:bg-rose-950 text-slate-300 hover:text-rose-300 disabled:opacity-40 text-xs font-semibold rounded-xl border border-slate-700 flex items-center justify-center gap-1 transition"
          title="Limpiar todos los vértices"
        >
          <span>Limpiar</span>
        </button>

        <button
          id="btn-finish-drawing"
          onClick={onFinishDrawing}
          disabled={!isPolygonReady}
          className="flex-1 py-2 px-3 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:hover:bg-emerald-500 text-slate-950 text-xs font-bold rounded-xl shadow-lg border border-emerald-400 flex items-center justify-center gap-1.5 transition active:scale-98"
        >
          <Check className="w-4 h-4 stroke-[3]" />
          <span>Guardar</span>
        </button>
      </div>
    </div>
  );
};
