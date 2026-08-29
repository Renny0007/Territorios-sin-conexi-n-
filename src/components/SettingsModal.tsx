import React, { useState } from 'react';
import { 
  Settings, 
  Layers, 
  Navigation, 
  Download, 
  Upload, 
  Trash2, 
  HelpCircle, 
  ShieldCheck, 
  Sparkles,
  HardDrive,
  Info,
  RefreshCw,
  Lock,
  Unlock,
  Fingerprint,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { AppSettings, MapProviderId } from '../types';
import { MAP_PROVIDERS } from '../services/tileManager';
import { dbService } from '../services/db';
import { swUpdateManager } from '../services/swUpdateManager';
import { APP_VERSION, APP_BUILD_DATE } from '../version';
import { parseGeoJSON, parseKML } from '../services/geoUtils';

interface SettingsModalProps {
  settings: AppSettings;
  onSaveSettings: (settings: AppSettings) => void;
  onClearAllData: () => void;
  onOpenHelpGuide: () => void;
  onReloadAllData?: () => Promise<void>;
  // Biometric / Admin Protection Props
  isAdminUnlocked: boolean;
  isBiometricSupported: boolean;
  onUnlockWithBiometrics: () => Promise<void>;
  onLockAdmin: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  onSaveSettings,
  onClearAllData,
  onOpenHelpGuide,
  onReloadAllData,
  isAdminUnlocked,
  isBiometricSupported,
  onUnlockWithBiometrics,
  onLockAdmin
}) => {
  const [currentSettings, setCurrentSettings] = useState<AppSettings>(settings);
  const [confirmClearData, setConfirmClearData] = useState<boolean>(false);
  const [importStatusMsg, setImportStatusMsg] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState<boolean>(false);
  const [updateMsg, setUpdateMsg] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);

  const handleBiometricClick = async () => {
    setIsAuthenticating(true);
    try {
      await onUnlockWithBiometrics();
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleCheckUpdate = async () => {
    setIsCheckingUpdate(true);
    setUpdateMsg('Buscando actualizaciones...');
    try {
      const hasUpdate = await swUpdateManager.checkForUpdates();
      if (hasUpdate) {
        setUpdateMsg('¡Nueva versión lista! Pulsa Actualizar.');
      } else {
        setUpdateMsg('Estás utilizando la versión más reciente.');
      }
    } catch {
      setUpdateMsg('No se pudo verificar la actualización.');
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const handleProviderChange = (provider: MapProviderId) => {
    const updated = { ...currentSettings, mapProvider: provider };
    setCurrentSettings(updated);
    onSaveSettings(updated);
  };

  const handleToggleAutoCenter = () => {
    const updated = { ...currentSettings, gpsAutoCenter: !currentSettings.gpsAutoCenter };
    setCurrentSettings(updated);
    onSaveSettings(updated);
  };

  const handleExportBackup = async () => {
    const jsonStr = await dbService.exportFullBackup();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `territorios_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportStatusMsg('Restaurando copia de seguridad...');

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      if (!content) {
        setIsImporting(false);
        setImportStatusMsg('El archivo seleccionado está vacío.');
        return;
      }

      try {
        const fileName = file.name.toLowerCase();
        let terrCount = 0;
        let noteCount = 0;
        let labelCount = 0;

        if (fileName.endsWith('.kml')) {
          const { territories: parsedTerritories, notes: parsedNotes } = parseKML(content);
          for (const t of parsedTerritories) {
            if (t.coordinates && t.coordinates.length >= 3) {
              await dbService.saveTerritory(t as any);
              terrCount++;
            }
          }
          for (const n of parsedNotes) {
            if (n.coordinate) {
              await dbService.saveNote(n as any);
              noteCount++;
            }
          }
        } else if (fileName.endsWith('.geojson')) {
          const { territories: parsedTerritories } = parseGeoJSON(content);
          for (const t of parsedTerritories) {
            if (t.coordinates && t.coordinates.length >= 3) {
              await dbService.saveTerritory(t as any);
              terrCount++;
            }
          }
        } else {
          // JSON Backup format
          const result = await dbService.importFullBackup(content);
          terrCount = result.importedTerritories;
          noteCount = result.importedNotes;
          labelCount = result.importedLabels;
        }

        if (onReloadAllData) {
          await onReloadAllData();
        }

        const msg = `Copia de seguridad restaurada exitosamente: ${terrCount} territorios, ${labelCount} letras y ${noteCount} notas. La app permanece en Modo usuario 🔒.`;
        setImportStatusMsg(msg);
      } catch (err: any) {
        console.error('Error al restaurar copia:', err);
        setImportStatusMsg(`Error al restaurar: ${err.message || 'Formato de archivo incompatible.'}`);
      } finally {
        setIsImporting(false);
      }
    };

    reader.onerror = () => {
      setIsImporting(false);
      setImportStatusMsg('Error de lectura al cargar el archivo de copia de seguridad.');
    };

    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="h-full w-full bg-slate-950 text-slate-100 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-800 p-4 shrink-0 shadow-md flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold uppercase tracking-wider text-slate-100 flex items-center gap-2">
            <Settings className="w-5 h-5 text-emerald-400" />
            Configuración del Sistema
          </h2>
          <p className="text-xs text-slate-400">
            Ajustes cartográficos, preferencias de GPS y gestión de datos
          </p>
        </div>

        <button
          onClick={onOpenHelpGuide}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded-xl text-xs font-semibold border border-slate-700 transition"
        >
          <HelpCircle className="w-4 h-4" />
          <span>Guía / Ayuda</span>
        </button>
      </div>

      {/* Scrollable Settings Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-2xl mx-auto w-full">
        {/* 1. Control de Acceso y Edición (Biometría / Administrador) */}
        <div className={`border rounded-2xl p-4 shadow-xl transition-all ${
          isAdminUnlocked 
            ? 'bg-emerald-950/40 border-emerald-500/60' 
            : 'bg-amber-950/40 border-amber-500/50'
        }`}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-2xl border shrink-0 ${
                isAdminUnlocked 
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' 
                  : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
              }`}>
                {isAdminUnlocked ? <Unlock className="w-6 h-6" /> : <Lock className="w-6 h-6" />}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-slate-400 font-mono uppercase tracking-wider">Estado actual:</span>
                  <h3 className="text-sm sm:text-base font-black text-slate-100">
                    {isAdminUnlocked ? 'Modo administrador' : 'Modo usuario'}
                  </h3>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                    isAdminUnlocked ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  }`}>
                    {isAdminUnlocked ? 'Edición Habilitada' : 'Solo Lectura'}
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1">
                  {isAdminUnlocked 
                    ? 'Permisos activos para crear, dibujar, mover y eliminar polígonos, letras y territorios.' 
                    : 'Protección activa contra cambios accidentales. Para editar polígonos o letras, desbloquea con tu huella.'}
                </p>
              </div>
            </div>

            {isAdminUnlocked ? (
              <button
                id="btn-lock-edition"
                onClick={onLockAdmin}
                className="w-full sm:w-auto px-4 py-3 bg-slate-900 hover:bg-rose-950 text-slate-200 hover:text-rose-200 font-bold text-xs sm:text-sm rounded-xl border border-slate-700 hover:border-rose-700 transition flex items-center justify-center gap-2 shrink-0 shadow-lg active:scale-95 whitespace-nowrap"
              >
                <Unlock className="w-4 h-4 text-emerald-400" />
                <span>Bloquear edición 🔓</span>
              </button>
            ) : (
              <button
                id="btn-unlock-edition"
                onClick={handleBiometricClick}
                disabled={isAuthenticating}
                className="w-full sm:w-auto px-4 py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black text-xs sm:text-sm rounded-xl shadow-lg shadow-amber-500/20 transition active:scale-95 flex items-center justify-center gap-2 shrink-0 whitespace-nowrap"
              >
                <Fingerprint className="w-5 h-5 stroke-[2.5]" />
                <span>{isAuthenticating ? 'Verificando huella...' : 'Desbloquear edición 🔒'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Map Provider Selection */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md">
          <h3 className="text-xs uppercase font-mono text-slate-400 font-bold mb-3 flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-400" />
            Capa de Mapa Base
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {(Object.keys(MAP_PROVIDERS) as MapProviderId[]).map((pid) => {
              const p = MAP_PROVIDERS[pid];
              const isSelected = currentSettings.mapProvider === pid;

              return (
                <button
                  key={pid}
                  onClick={() => handleProviderChange(pid)}
                  className={`p-3 rounded-xl border text-left transition flex items-center justify-between ${
                    isSelected
                      ? 'bg-emerald-950/80 border-emerald-500 text-slate-100 ring-1 ring-emerald-500'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div>
                    <span className="font-bold text-xs block text-slate-200">{p.name}</span>
                    <span className="text-[10px] text-slate-500 font-mono">Zoom Máx: {p.maxZoom}</span>
                  </div>
                  {isSelected && <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* GPS Behavior */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md">
          <h3 className="text-xs uppercase font-mono text-slate-400 font-bold mb-3 flex items-center gap-2">
            <Navigation className="w-4 h-4 text-cyan-400" />
            Comportamiento de Posicionamiento GPS
          </h3>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800">
              <div>
                <span className="text-xs font-bold text-slate-200 block">Auto-centrar mapa con GPS</span>
                <span className="text-[11px] text-slate-400">
                  Desplaza el mapa automáticamente siguiendo tu posición al caminar
                </span>
              </div>
              <input
                type="checkbox"
                checked={currentSettings.gpsAutoCenter}
                onChange={handleToggleAutoCenter}
                className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Backup & Restore */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md">
          <h3 className="text-xs uppercase font-mono text-slate-400 font-bold mb-3 flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-purple-400" />
            Copia de Seguridad y Restauración
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              id="btn-export-full-backup"
              onClick={handleExportBackup}
              className="p-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-left transition flex items-center gap-2.5"
            >
              <Download className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <span className="text-xs font-bold text-slate-200 block">Descargar Copia Completa</span>
                <span className="text-[10px] text-slate-500">Exporta todo a un archivo JSON seguro</span>
              </div>
            </button>

            <label className={`p-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-left transition flex items-center gap-2.5 cursor-pointer ${isImporting ? 'opacity-50 pointer-events-none' : ''}`}>
              <Upload className="w-4 h-4 text-cyan-400 shrink-0" />
              <div>
                <span className="text-xs font-bold text-slate-200 block">Restaurar Copia de Seguridad</span>
                <span className="text-[10px] text-slate-500">Carga polígonos, letras y territorios (.json, .kml, .geojson)</span>
              </div>
              <input
                id="input-restore-backup-file"
                type="file"
                accept=".json,.kml,.geojson"
                onChange={handleImportBackup}
                disabled={isImporting}
                className="hidden"
              />
            </label>
          </div>

          {/* Import Status Message */}
          {importStatusMsg && (
            <div className={`mt-3 p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
              importStatusMsg.includes('Error') || importStatusMsg.includes('incompatible')
                ? 'bg-rose-950/40 border-rose-800 text-rose-300'
                : 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
            }`}>
              {importStatusMsg.includes('Error') || importStatusMsg.includes('incompatible') ? (
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <span className="font-semibold block">{importStatusMsg}</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Los datos restaurados ya están listos en el mapa. Las funciones de edición manual permanecen protegidas.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Danger Zone: Clear Data */}
        <div className="bg-slate-900 border border-rose-900/40 rounded-2xl p-4 shadow-md">
          <h3 className="text-xs uppercase font-mono text-rose-400 font-bold mb-2 flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-rose-500" />
            Zona de Peligro
          </h3>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 bg-rose-950/20 border border-rose-900/50 rounded-xl">
            <div>
              <span className="text-xs font-bold text-rose-200 block">Borrar todos los datos locales</span>
              <span className="text-[11px] text-rose-400/80">
                Elimina todos los territorios, notas y mosaicos sin conexión de este dispositivo
              </span>
            </div>

            {confirmClearData ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setConfirmClearData(false)}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl transition"
                >
                  Cancelar
                </button>
                <button
                  id="btn-confirm-clear-all"
                  onClick={() => {
                    setConfirmClearData(false);
                    onClearAllData();
                  }}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl transition shadow animate-pulse"
                >
                  Confirmar Borrado
                </button>
              </div>
            ) : (
              <button
                id="btn-clear-all-data"
                onClick={() => setConfirmClearData(true)}
                className="px-3 py-2 bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800 font-bold text-xs rounded-xl transition shadow"
              >
                Borrar Todo
              </button>
            )}
          </div>
        </div>

        {/* App Version & Update Status */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 rounded-xl">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-200 block font-mono">
                  Versión {APP_VERSION} ({APP_BUILD_DATE})
                </span>
                <span className="text-[11px] text-slate-400">
                  {updateMsg || 'PWA con ciclo de actualización y caché automatizada'}
                </span>
              </div>
            </div>

            <button
              onClick={handleCheckUpdate}
              disabled={isCheckingUpdate}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 disabled:opacity-50 text-emerald-400 rounded-xl text-xs font-bold border border-slate-700 transition flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isCheckingUpdate ? 'animate-spin' : ''}`} />
              <span>{isCheckingUpdate ? 'Buscando...' : 'Comprobar'}</span>
            </button>
          </div>
        </div>

        {/* Technical Architecture Info */}
        <div className="p-2 text-center text-[11px] text-slate-500 font-mono">
          <p>Territorios Offline • Service Worker Activo • IndexedDB Seguro</p>
        </div>
      </div>
    </div>
  );
};
