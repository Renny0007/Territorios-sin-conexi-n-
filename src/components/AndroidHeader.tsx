import React, { useState, useEffect } from 'react';
import { 
  Navigation, 
  Compass, 
  Wifi, 
  WifiOff, 
  BatteryCharging, 
  Battery, 
  Play, 
  Square, 
  Radio,
  Lock,
  Unlock,
  Fingerprint,
  Settings,
  Download
} from 'lucide-react';
import { GPSState } from '../types';
import { gpsService } from '../services/gpsService';

interface AndroidHeaderProps {
  gpsState: GPSState;
  isAdminUnlocked?: boolean;
  onOpenPermissionHelp: () => void;
  onCenterLocation?: () => void;
  onOpenBiometricPrompt?: () => void;
  onOpenSettings?: () => void;
  onOpenInstallModal?: () => void;
  isInstallable?: boolean;
}

export const AndroidHeader: React.FC<AndroidHeaderProps> = ({
  gpsState,
  isAdminUnlocked = false,
  onOpenPermissionHelp,
  onCenterLocation,
  onOpenBiometricPrompt,
  onOpenSettings,
  onOpenInstallModal,
  isInstallable = true
}) => {
  const [time, setTime] = useState<string>('');
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [isCharging, setIsCharging] = useState<boolean>(false);

  // Digital clock update
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString('es-ES', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Online / Offline tracking
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Battery status if supported
  useEffect(() => {
    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        const updateBattery = () => {
          setBatteryLevel(Math.round(battery.level * 100));
          setIsCharging(battery.charging);
        };
        updateBattery();
        battery.addEventListener('levelchange', updateBattery);
        battery.addEventListener('chargingchange', updateBattery);
      }).catch(() => {
        // Battery API not permitted
      });
    }
  }, []);

  const handleGpsClick = () => {
    if (!gpsState.active) {
      gpsService.startTracking(onOpenPermissionHelp);
    }
    if (onCenterLocation) {
      onCenterLocation();
    }
  };

  const toggleSimulation = () => {
    if (gpsState.simulated) {
      gpsService.stopTracking();
    } else {
      gpsService.startSimulation(40.4168, -3.7038);
      if (onCenterLocation) {
        onCenterLocation();
      }
    }
  };

  // Accuracy color logic
  const getAccuracyBadge = () => {
    if (!gpsState.active || gpsState.accuracy === null) {
      return (
        <span className="text-slate-400 text-xs font-mono">GPS OFF</span>
      );
    }
    const acc = Math.round(gpsState.accuracy);
    if (acc <= 5) {
      return (
        <span className="text-emerald-400 text-xs font-mono font-bold flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          ±{acc}m
        </span>
      );
    }
    if (acc <= 15) {
      return (
        <span className="text-amber-400 text-xs font-mono font-medium flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
          ±{acc}m
        </span>
      );
    }
    return (
      <span className="text-rose-400 text-xs font-mono font-medium flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
        ±{acc}m
      </span>
    );
  };

  return (
    <header className="h-14 bg-slate-900 border-b border-slate-800 px-3 flex items-center justify-between select-none z-30 shrink-0 shadow-md">
      {/* Left: App title & Online status */}
      <div className="flex items-center gap-2.5">
        <div className="flex items-center gap-1.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-black text-xs tracking-tighter shadow-inner">
            <Radio className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm tracking-wider text-slate-100 uppercase">Territorios</span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-800 text-emerald-400 border border-emerald-500/30">
                Offline
              </span>
            </div>
          </div>
        </div>

        {/* Connectivity status */}
        <div className="hidden sm:flex items-center">
          {isOnline ? (
            <span className="flex items-center gap-1 text-[11px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-full">
              <Wifi className="w-3 h-3" /> ONLINE
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[11px] font-mono text-amber-400 bg-amber-950/70 border border-amber-700/60 px-2 py-0.5 rounded-full animate-pulse">
              <WifiOff className="w-3 h-3" /> OFFLINE
            </span>
          )}
        </div>
      </div>

      {/* Middle: GPS Status & Precision info */}
      <div className="flex items-center gap-2">
        <button
          id="btn-toggle-gps"
          onClick={handleGpsClick}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono transition-all border ${
            gpsState.active
              ? 'bg-emerald-950/90 border-emerald-500 text-emerald-300 shadow-sm shadow-emerald-950 active:scale-95'
              : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 active:scale-95'
          }`}
          title={gpsState.active ? 'Centrar mapa en mi ubicación actual' : 'Activar GPS y centrar en mi ubicación'}
        >
          <Navigation className={`w-3.5 h-3.5 ${gpsState.active ? 'text-emerald-400 fill-emerald-400/30 animate-pulse' : 'text-slate-400'}`} />
          <span>GPS</span>
          {getAccuracyBadge()}
        </button>

        {/* Compass Heading */}
        {gpsState.heading !== null && (
          <div className="hidden md:flex items-center gap-1 bg-slate-800 border border-slate-700 px-2 py-1 rounded-md text-xs font-mono text-cyan-300">
            <Compass className="w-3.5 h-3.5 text-cyan-400" />
            <span>{gpsState.heading}°</span>
          </div>
        )}

        {/* GPS Demo Simulation button */}
        <button
          id="btn-toggle-gps-simulation"
          onClick={toggleSimulation}
          className={`hidden lg:flex items-center gap-1 text-[11px] font-mono px-2 py-1 rounded border transition-colors ${
            gpsState.simulated
              ? 'bg-cyan-950 text-cyan-300 border-cyan-500'
              : 'bg-slate-800/60 text-slate-400 border-slate-700 hover:text-slate-300'
          }`}
          title="Modo Simulación GPS (Para pruebas sin moverte)"
        >
          {gpsState.simulated ? <Square className="w-3 h-3 text-cyan-400 fill-cyan-400" /> : <Play className="w-3 h-3 text-cyan-400" />}
          <span>{gpsState.simulated ? 'Simulando' : 'Simular GPS'}</span>
        </button>
      </div>

      {/* Right: Lock/Unlock Mode Button, Clock & Battery */}
      <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
        {/* PWA Install Button */}
        {onOpenInstallModal && isInstallable && (
          <button
            id="btn-header-install-pwa"
            onClick={onOpenInstallModal}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold font-sans bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-500/50 text-emerald-300 transition shadow-sm active:scale-95 cursor-pointer"
            title="Instalar como Aplicación (PWA)"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Instalar</span>
          </button>
        )}

        {/* Visual Lock / Unlock status and prompt trigger */}
        {onOpenBiometricPrompt && (
          <button
            id="btn-header-lock-status"
            onClick={onOpenBiometricPrompt}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold font-sans transition shadow-sm active:scale-95 border ${
              isAdminUnlocked
                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/60 hover:bg-emerald-900'
                : 'bg-amber-950/80 text-amber-300 border-amber-500/60 hover:bg-amber-900'
            }`}
            title={isAdminUnlocked ? 'Modo Administrador Activo (Toca para opciones o bloquear)' : 'Modo Bloqueado (Toca para desbloquear con huella)'}
          >
            {isAdminUnlocked ? (
              <>
                <Unlock className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Desbloqueado</span>
              </>
            ) : (
              <>
                <Fingerprint className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Desbloquear</span>
              </>
            )}
          </button>
        )}

        {/* Quick Settings Button */}
        {onOpenSettings && (
          <button
            id="btn-header-open-settings"
            onClick={onOpenSettings}
            className="p-1.5 rounded-lg bg-slate-800/80 text-slate-300 hover:text-emerald-400 hover:bg-slate-700/80 border border-slate-700 transition active:scale-95"
            title="Ir a Configuración"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        )}

        {batteryLevel !== null && (
          <div className="hidden sm:flex items-center gap-1 bg-slate-800/60 px-2 py-0.5 rounded border border-slate-700/60 text-[11px]">
            {isCharging ? (
              <BatteryCharging className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Battery className="w-3.5 h-3.5 text-slate-300" />
            )}
            <span>{batteryLevel}%</span>
          </div>
        )}

        <div className="bg-slate-950/80 px-2.5 py-1 rounded border border-slate-800 text-slate-200 font-bold tracking-wider">
          {time || '--:--:--'}
        </div>
      </div>
    </header>
  );
};
