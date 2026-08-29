import React from 'react';
import { 
  Navigation, 
  ArrowUp, 
  ArrowUpLeft, 
  ArrowUpRight, 
  CornerDownLeft, 
  CornerDownRight, 
  MapPin, 
  X, 
  Footprints, 
  Compass 
} from 'lucide-react';
import { ActiveRoute, RouteStepType } from '../types';
import { formatDistance } from '../services/geoUtils';

interface RouteNavigationCardProps {
  route: ActiveRoute;
  onStopNavigation: () => void;
}

export const RouteNavigationCard: React.FC<RouteNavigationCardProps> = ({
  route,
  onStopNavigation
}) => {
  const currentStep = route.steps[0] || {
    instruction: 'Dirígete hacia el destino',
    distanceM: route.distanceM,
    durationSec: route.durationSec,
    type: 'straight' as RouteStepType
  };

  const getStepIcon = (type: RouteStepType) => {
    switch (type) {
      case 'turn-left':
        return <CornerDownLeft className="w-6 h-6 text-cyan-400" />;
      case 'turn-right':
        return <CornerDownRight className="w-6 h-6 text-cyan-400" />;
      case 'slight-left':
        return <ArrowUpLeft className="w-6 h-6 text-cyan-400" />;
      case 'slight-right':
        return <ArrowUpRight className="w-6 h-6 text-cyan-400" />;
      case 'arrive':
        return <MapPin className="w-6 h-6 text-fuchsia-400 animate-bounce" />;
      default:
        return <ArrowUp className="w-6 h-6 text-emerald-400" />;
    }
  };

  const minutesEst = Math.max(1, Math.round(route.durationSec / 60));

  return (
    <div className="absolute bottom-20 left-3 right-3 sm:left-auto sm:right-4 sm:w-96 z-30 bg-slate-900/95 backdrop-blur-md border border-fuchsia-500/50 rounded-2xl p-3.5 shadow-2xl animate-in slide-in-from-bottom-5">
      {/* Top indicator: Target & Offline badge */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-fuchsia-500/20 text-fuchsia-400 rounded-lg border border-fuchsia-500/40">
            <Footprints className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-100 uppercase tracking-wide truncate max-w-[200px]">
              {route.targetName}
            </h4>
            <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
              {route.isOfflineFallback ? (
                <span className="text-amber-400 font-bold">Rumbo Directo (Offline)</span>
              ) : (
                <span className="text-emerald-400 font-bold">Ruta Peatonal (OSRM)</span>
              )}
            </span>
          </div>
        </div>

        <button
          onClick={onStopNavigation}
          className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
          title="Finalizar navegación"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Main Turn-by-Turn Instruction */}
      <div className="flex items-center gap-3 my-2.5 bg-slate-950 p-3 rounded-xl border border-slate-800">
        <div className="p-2 bg-slate-900 rounded-xl border border-slate-800 shrink-0">
          {getStepIcon(currentStep.type)}
        </div>
        <div className="flex-1">
          <p className="text-xs font-bold text-slate-100 leading-snug">
            {currentStep.instruction}
          </p>
          <span className="text-[11px] font-mono text-cyan-400 mt-0.5 block">
            en {formatDistance(currentStep.distanceM)}
          </span>
        </div>
      </div>

      {/* Summary Footer: Distance remaining, Time remaining, Stop button */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-3 font-mono">
          <div>
            <span className="text-[10px] text-slate-500 uppercase block">Distancia</span>
            <span className="text-xs font-bold text-emerald-400">{formatDistance(route.distanceM)}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase block">Tiempo Est.</span>
            <span className="text-xs font-bold text-cyan-400">~{minutesEst} min</span>
          </div>
        </div>

        <button
          id="btn-stop-navigation"
          onClick={onStopNavigation}
          className="px-3 py-1.5 bg-slate-800 hover:bg-rose-950 text-slate-300 hover:text-rose-300 border border-slate-700 hover:border-rose-700 text-xs font-bold rounded-xl transition"
        >
          Finalizar
        </button>
      </div>
    </div>
  );
};
