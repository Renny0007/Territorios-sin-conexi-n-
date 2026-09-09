import React, { useState, useEffect } from 'react';
import { 
  X, 
  CloudDownload, 
  RefreshCw, 
  Undo2, 
  History, 
  CheckCircle2, 
  AlertTriangle, 
  Github, 
  Layers, 
  HelpCircle, 
  Clock, 
  Edit3, 
  Check, 
  RotateCcw,
  Sparkles,
  Database
} from 'lucide-react';
import { 
  masterDatabaseSyncService, 
  VersionCheckResult, 
  LocalDatabaseVersionInfo 
} from '../services/masterDatabaseSyncService';
import { githubSyncService, RestorePointInfo } from '../services/githubSyncService';
import { DEFAULT_DATABASE_JSON_URL } from '../config/databaseConfig';

interface DatabaseSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  localTerritoriesCount: number;
  onReloadAllData?: () => Promise<void>;
  onShowToast?: (msg: string) => void;
  autoCheckOnOpen?: boolean;
}

export const DatabaseSyncModal: React.FC<DatabaseSyncModalProps> = ({
  isOpen,
  onClose,
  localTerritoriesCount,
  onReloadAllData,
  onShowToast,
  autoCheckOnOpen = true
}) => {
  // Configured URL
  const [dbUrl, setDbUrl] = useState<string>('');
  const [isEditingUrl, setIsEditingUrl] = useState<boolean>(false);
  const [tempUrl, setTempUrl] = useState<string>('');

  // Flow State
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [isUndoing, setIsUndoing] = useState<boolean>(false);

  // Results & Info
  const [localVersionInfo, setLocalVersionInfo] = useState<LocalDatabaseVersionInfo | null>(null);
  const [checkResult, setCheckResult] = useState<VersionCheckResult | null>(null);
  const [restorePoint, setRestorePoint] = useState<RestorePointInfo>({ exists: false });
  const [showConfirmPrompt, setShowConfirmPrompt] = useState<boolean>(false);

  // Status banner messages
  const [feedback, setFeedback] = useState<{
    type: 'updating' | 'success' | 'error' | 'info';
    title: string;
    description?: string;
  } | null>(null);

  const [showHelpDetails, setShowHelpDetails] = useState<boolean>(false);

  // Initialize data on open
  useEffect(() => {
    if (isOpen) {
      const currentUrl = masterDatabaseSyncService.getConfiguredUrl();
      setDbUrl(currentUrl);
      setTempUrl(currentUrl);
      setIsEditingUrl(false);
      setShowConfirmPrompt(false);
      setCheckResult(null);
      setFeedback(null);

      loadInitialMetadata().then(() => {
        if (autoCheckOnOpen) {
          handleCheckUpdates(currentUrl);
        }
      });
    }
  }, [isOpen]);

  const loadInitialMetadata = async () => {
    try {
      const [localInfo, undoInfo] = await Promise.all([
        masterDatabaseSyncService.getLocalVersionInfo(),
        githubSyncService.getRestorePointInfo()
      ]);
      setLocalVersionInfo(localInfo);
      setRestorePoint(undoInfo);
    } catch (err) {
      console.warn('Error loading initial metadata:', err);
    }
  };

  if (!isOpen) return null;

  // 1. Check for updates
  const handleCheckUpdates = async (urlToCheck?: string) => {
    const url = urlToCheck || dbUrl;
    if (!url || !url.trim()) {
      setFeedback({
        type: 'error',
        title: '❌ No se pudo actualizar',
        description: 'La URL de database.json no está configurada.'
      });
      return;
    }

    setIsChecking(true);
    setFeedback(null);
    setShowConfirmPrompt(false);
    setCheckResult(null);

    try {
      const result = await masterDatabaseSyncService.checkForUpdates(url.trim());
      setCheckResult(result);

      if (result.hasNewVersion) {
        setShowConfirmPrompt(true);
      } else if (result.isDowngradeRisk) {
        setFeedback({
          type: 'info',
          title: 'Base de datos al día',
          description: result.message
        });
      } else {
        setFeedback({
          type: 'info',
          title: '✅ Tu base de datos está al día',
          description: `La versión en tu dispositivo (${result.localDate}) coincide con la versión en GitHub.`
        });
      }
    } catch (err: any) {
      console.error('Error checking database updates:', err);
      setFeedback({
        type: 'error',
        title: '❌ No se pudo actualizar',
        description: err.message || 'No se pudo consultar el archivo database.json en GitHub.'
      });
    } finally {
      setIsChecking(false);
    }
  };

  // 2. Perform Database Download & Import
  const handleConfirmUpdate = async () => {
    setIsUpdating(true);
    setShowConfirmPrompt(false);
    setFeedback({
      type: 'updating',
      title: '⏳ Actualizando...',
      description: 'Descargando database.json e importando polígonos, territorios y letras...'
    });

    try {
      const result = await masterDatabaseSyncService.downloadAndApplyUpdate(checkResult?.rawRemoteData);

      // Reload UI in memory
      if (onReloadAllData) {
        await onReloadAllData();
      }

      // Refresh version and restore point info
      await loadInitialMetadata();

      setFeedback({
        type: 'success',
        title: '✅ Base de datos actualizada correctamente',
        description: `Se importaron ${result.importedTerritories} territorios/polígonos, ${result.importedLabels} letras y ${result.importedNotes} notas. Guardado para uso 100% sin conexión.`
      });

      if (onShowToast) {
        onShowToast(`✅ Base de datos actualizada (${result.importedTerritories} territorios)`);
      }
    } catch (err: any) {
      console.error('Error applying database update:', err);
      setFeedback({
        type: 'error',
        title: '❌ No se pudo actualizar',
        description: err.message || 'Error al procesar el archivo database.json.'
      });
    } finally {
      setIsUpdating(false);
    }
  };

  // 3. Revert / Undo changes
  const handleUndoLastUpdate = async () => {
    if (!restorePoint.exists) return;

    const confirmed = window.confirm(
      '¿Deseas revertir los cambios y restaurar la base de datos previa a la última actualización?'
    );
    if (!confirmed) return;

    setIsUndoing(true);
    setFeedback({
      type: 'updating',
      title: '⏳ Restaurando versión anterior...',
      description: 'Recuperando los territorios guardados en el punto de restauración...'
    });

    try {
      const result = await githubSyncService.undoLastSync();

      if (onReloadAllData) {
        await onReloadAllData();
      }

      await loadInitialMetadata();

      setFeedback({
        type: 'info',
        title: '↩️ Versión anterior restaurada',
        description: `Se recuperaron los ${result.restoredTerritories} territorios previos.`
      });

      if (onShowToast) {
        onShowToast(`↩️ Versión anterior restaurada (${result.restoredTerritories} territorios)`);
      }
    } catch (err: any) {
      console.error('Error undoing sync:', err);
      setFeedback({
        type: 'error',
        title: '❌ Error al restaurar',
        description: err.message || 'No se pudo recuperar la copia previa.'
      });
    } finally {
      setIsUndoing(false);
    }
  };

  // Save custom URL
  const handleSaveUrl = () => {
    const trimmed = tempUrl.trim();
    if (!trimmed) {
      masterDatabaseSyncService.resetDefaultUrl();
      const def = masterDatabaseSyncService.getConfiguredUrl();
      setDbUrl(def);
      setTempUrl(def);
    } else {
      masterDatabaseSyncService.setConfiguredUrl(trimmed);
      setDbUrl(trimmed);
    }
    setIsEditingUrl(false);
    handleCheckUpdates(trimmed);
  };

  const handleResetDefaultUrl = () => {
    masterDatabaseSyncService.resetDefaultUrl();
    const def = masterDatabaseSyncService.getConfiguredUrl();
    setDbUrl(def);
    setTempUrl(def);
    setIsEditingUrl(false);
    handleCheckUpdates(def);
  };

  return (
    <div 
      id="modal-database-sync-backdrop"
      className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div 
        id="modal-database-sync-container"
        className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-scaleUp text-slate-100 flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
              <RefreshCw className={`w-5 h-5 ${isChecking || isUpdating ? 'animate-spin' : ''}`} />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-slate-100 flex items-center gap-2">
                🔄 ACTUALIZAR BASE DE DATOS
              </h2>
              <p className="text-xs text-slate-400">
                Sincronización de datos de territorios desde GitHub
              </p>
            </div>
          </div>

          <button
            id="btn-close-sync-modal"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 text-xs">

          {/* Status Message Banner (Updating, Success, Error, Info) */}
          {feedback && (
            <div className={`p-4 rounded-2xl border flex items-start gap-3 animate-fadeIn ${
              feedback.type === 'updating'
                ? 'bg-amber-950/40 border-amber-500/60 text-amber-200'
                : feedback.type === 'success'
                  ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-200'
                  : feedback.type === 'error'
                    ? 'bg-rose-950/60 border-rose-800 text-rose-200'
                    : 'bg-slate-950 border-slate-700 text-slate-200'
            }`}>
              {feedback.type === 'updating' && (
                <RefreshCw className="w-5 h-5 text-amber-400 animate-spin shrink-0 mt-0.5" />
              )}
              {feedback.type === 'success' && (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              )}
              {feedback.type === 'error' && (
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              )}
              {feedback.type === 'info' && (
                <CheckCircle2 className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <p className="font-bold text-sm">{feedback.title}</p>
                {feedback.description && (
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    {feedback.description}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* New Version Confirmation Card */}
          {showConfirmPrompt && checkResult && (
            <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-950/80 to-indigo-950/80 border-2 border-purple-500/80 text-slate-100 shadow-xl space-y-3 animate-fadeIn">
              <div className="flex items-center gap-2 text-purple-300 font-bold text-sm">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span>Hay una nueva base de datos disponible. ¿Deseas actualizar?</span>
              </div>

              <div className="grid grid-cols-2 gap-2 bg-slate-950/70 p-3 rounded-xl border border-purple-800/40 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-mono">Versión en GitHub</span>
                  <span className="font-bold text-emerald-400 text-sm block">
                    {checkResult.remoteTerritoriesCount} Territorios
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Fecha: {checkResult.remoteDate}
                  </span>
                  {checkResult.remoteLabelsCount > 0 && (
                    <span className="text-[10px] text-amber-400 block">
                      +{checkResult.remoteLabelsCount} Letras/Puntos
                    </span>
                  )}
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-mono">En tu dispositivo</span>
                  <span className="font-bold text-slate-300 text-sm block">
                    {localVersionInfo?.territoriesCount ?? localTerritoriesCount} Territorios
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Fecha: {localVersionInfo?.formattedDate || 'Sin registro'}
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-purple-200">
                Al confirmar, se descargarán los nuevos polígonos, letras y notas. Tu versión actual se guardará automáticamente en un punto de restauración por seguridad.
              </p>

              <div className="flex items-center gap-2 pt-1">
                <button
                  id="btn-confirm-database-update"
                  type="button"
                  onClick={handleConfirmUpdate}
                  disabled={isUpdating}
                  className="flex-1 py-3 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 text-slate-950 font-black text-xs sm:text-sm rounded-xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RefreshCw className={`w-4 h-4 ${isUpdating ? 'animate-spin' : ''}`} />
                  <span>Sí, Actualizar Ahora</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowConfirmPrompt(false)}
                  className="py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl transition cursor-pointer"
                >
                  Más tarde
                </button>
              </div>
            </div>
          )}

          {/* Quick Overview Card */}
          <div className="grid grid-cols-2 gap-2 bg-slate-950 p-3 rounded-2xl border border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-emerald-950/80 text-emerald-400 rounded-xl border border-emerald-800/50">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-mono">En tu dispositivo</span>
                <span className="text-xs sm:text-sm font-bold text-slate-200">
                  {localVersionInfo?.territoriesCount ?? localTerritoriesCount} Territorios
                </span>
                {localVersionInfo?.labelsCount ? (
                  <span className="text-[10px] text-amber-400 block">
                    {localVersionInfo.labelsCount} Letras
                  </span>
                ) : null}
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-slate-900 text-cyan-400 rounded-xl border border-slate-800">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-mono">Última actualización</span>
                <span className="text-xs font-semibold text-slate-300 block truncate max-w-[130px]" title={localVersionInfo?.formattedDate}>
                  {localVersionInfo?.formattedDate || 'Sin registro'}
                </span>
              </div>
            </div>
          </div>

          {/* Main Action Button (Check & Update) */}
          <button
            id="btn-trigger-main-database-update"
            onClick={() => handleCheckUpdates()}
            disabled={isChecking || isUpdating || isUndoing}
            className="w-full py-3.5 px-4 bg-gradient-to-r from-purple-700 via-indigo-600 to-purple-800 hover:from-purple-600 hover:to-indigo-500 active:scale-[0.98] disabled:opacity-50 text-white font-black text-xs sm:text-sm rounded-2xl shadow-xl shadow-purple-950/60 transition flex items-center justify-center gap-2 cursor-pointer border border-purple-500/40"
          >
            {isChecking ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-purple-200" />
                <span>Consultando GitHub (database.json)...</span>
              </>
            ) : isUpdating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-purple-200" />
                <span>⏳ Actualizando base de datos...</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 text-purple-300" />
                <span>Comprobar y Actualizar Base de Datos</span>
              </>
            )}
          </button>

          {/* Centralized database.json URL Configuration (Easily changeable) */}
          <div className="space-y-2 bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Github className="w-4 h-4 text-purple-400" />
                <span>Ubicación de database.json</span>
              </span>

              {!isEditingUrl ? (
                <button
                  type="button"
                  onClick={() => setIsEditingUrl(true)}
                  className="text-[11px] text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Edit3 className="w-3 h-3" />
                  <span>Cambiar URL</span>
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleResetDefaultUrl}
                    className="text-[10px] text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer"
                    title="Restaurar repositorio por defecto"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Por defecto</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveUrl}
                    className="text-[11px] text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-0.5 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Guardar</span>
                  </button>
                </div>
              )}
            </div>

            {isEditingUrl ? (
              <div className="space-y-1.5">
                <input
                  id="input-custom-database-url"
                  type="url"
                  value={tempUrl}
                  onChange={(e) => setTempUrl(e.target.value)}
                  placeholder="https://raw.githubusercontent.com/usuario/repo/main/database.json"
                  className="w-full bg-slate-900 border border-purple-500 text-slate-200 font-mono text-xs p-2.5 rounded-xl focus:outline-none"
                />
                <p className="text-[10px] text-slate-400">
                  La URL queda configurada en un único lugar centralizado. No requiere tokens ni credenciales.
                </p>
              </div>
            ) : (
              <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-300 break-all select-all flex items-center justify-between">
                <span>{dbUrl}</span>
              </div>
            )}
          </div>

          {/* UNDO / REVERT SECTION */}
          {restorePoint.exists && (
            <div className="bg-slate-950 border border-amber-900/40 rounded-2xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-amber-400" />
                  <span className="font-bold text-xs text-amber-300">
                    Deshacer y Restaurar Versión Previa
                  </span>
                </div>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-600/40">
                  Punto de control listo
                </span>
              </div>

              <p className="text-[11px] text-slate-400">
                Guardado el {restorePoint.formattedDate} ({restorePoint.territoriesCount} territorios). Puedes revertir los cambios si no te convence la última actualización.
              </p>

              <button
                id="btn-undo-database-update"
                onClick={handleUndoLastUpdate}
                disabled={isUndoing || isUpdating || isChecking}
                className="w-full py-2.5 px-3 bg-amber-950/30 hover:bg-amber-950/70 active:scale-[0.98] disabled:opacity-50 text-amber-300 font-bold text-xs rounded-xl border border-amber-600/40 hover:border-amber-500 transition flex items-center justify-center gap-2 cursor-pointer shadow"
              >
                {isUndoing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                    <span>Restaurando...</span>
                  </>
                ) : (
                  <>
                    <Undo2 className="w-4 h-4 text-amber-400" />
                    <span>Deshacer y Volver a la Versión Anterior</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Information Notice */}
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-1">
            <p className="flex items-center gap-1.5 font-semibold text-slate-300">
              <Database className="w-3.5 h-3.5 text-purple-400" />
              <span>Sincronización segura de datos:</span>
            </p>
            <ul className="list-disc pl-4 space-y-0.5 text-slate-400 text-[10px]">
              <li>No modifica el código de la aplicación ni interfiere con los mapas sin conexión.</li>
              <li>Almacena los datos en memoria local para que sigan disponibles sin conexión.</li>
              <li>Si el archivo está dañado o no es compatible, la base local se mantiene intacta.</li>
            </ul>
          </div>

        </div>

        {/* Footer */}
        <div className="p-3.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <span className="text-[11px] text-slate-500">
            Territorios Offline • Base de datos maestra
          </span>
          <button
            id="btn-footer-close-sync"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-semibold transition cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
