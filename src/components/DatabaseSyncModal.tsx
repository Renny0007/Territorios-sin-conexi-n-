import React, { useState, useEffect } from 'react';
import { 
  X, 
  CloudDownload, 
  RefreshCw, 
  Undo2, 
  History, 
  CheckCircle2, 
  AlertTriangle, 
  ExternalLink, 
  Github, 
  Database,
  Layers,
  HelpCircle,
  Clock
} from 'lucide-react';
import { githubSyncService, RestorePointInfo, SyncMetadata } from '../services/githubSyncService';

interface DatabaseSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  localTerritoriesCount: number;
  onReloadAllData?: () => Promise<void>;
  onShowToast?: (msg: string) => void;
}

export const DatabaseSyncModal: React.FC<DatabaseSyncModalProps> = ({
  isOpen,
  onClose,
  localTerritoriesCount,
  onReloadAllData,
  onShowToast
}) => {
  const [syncUrl, setSyncUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isUndoing, setIsUndoing] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [restorePoint, setRestorePoint] = useState<RestorePointInfo>({ exists: false });
  const [lastSync, setLastSync] = useState<SyncMetadata | null>(null);
  const [showHelpDetails, setShowHelpDetails] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      const storedUrl = githubSyncService.getStoredUrl();
      setSyncUrl(storedUrl);
      setStatusMsg(null);
      refreshMetadata();
    }
  }, [isOpen]);

  const refreshMetadata = async () => {
    const meta = await githubSyncService.getRestorePointInfo();
    setRestorePoint(meta);
    const last = githubSyncService.getLastSyncInfo();
    setLastSync(last);
  };

  if (!isOpen) return null;

  const handleSyncNow = async () => {
    if (!syncUrl.trim()) {
      setStatusMsg({
        type: 'error',
        text: 'Por favor ingresa la URL de tu archivo JSON en GitHub o Gist.'
      });
      return;
    }

    setIsLoading(true);
    setStatusMsg(null);

    try {
      const result = await githubSyncService.syncFromRemote(syncUrl.trim(), true);
      
      // Reload UI data from database
      if (onReloadAllData) {
        await onReloadAllData();
      }

      await refreshMetadata();

      const successText = `¡Base de datos sincronizada con éxito! Se cargaron ${result.importedTerritories} territorios y ${result.importedNotes} notas. Se guardó un punto de restauración previo.`;
      setStatusMsg({
        type: 'success',
        text: successText
      });

      if (onShowToast) {
        onShowToast(`✅ Sincronizados ${result.importedTerritories} territorios desde GitHub`);
      }
    } catch (err: any) {
      console.error('Sync error:', err);
      setStatusMsg({
        type: 'error',
        text: err.message || 'Error al conectar y descargar los datos desde GitHub.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUndoSync = async () => {
    if (!restorePoint.exists) return;

    const confirmed = window.confirm(
      '¿Deseas revertir los cambios y restaurar la versión anterior guardada antes de la última actualización?'
    );
    if (!confirmed) return;

    setIsUndoing(true);
    setStatusMsg(null);

    try {
      const result = await githubSyncService.undoLastSync();

      // Reload all data in memory and map
      if (onReloadAllData) {
        await onReloadAllData();
      }

      await refreshMetadata();

      const successText = `Se deshicieron los cambios. Se restauraron los ${result.restoredTerritories} territorios previos a la actualización.`;
      setStatusMsg({
        type: 'info',
        text: successText
      });

      if (onShowToast) {
        onShowToast(`↩️ Versión anterior restaurada (${result.restoredTerritories} territorios)`);
      }
    } catch (err: any) {
      console.error('Undo error:', err);
      setStatusMsg({
        type: 'error',
        text: err.message || 'Error al restaurar la versión anterior.'
      });
    } finally {
      setIsUndoing(false);
    }
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setSyncUrl(text.trim());
      }
    } catch {
      // Ignore if clipboard permissions are not available
    }
  };

  return (
    <div 
      id="modal-database-sync-backdrop"
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fadeIn"
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
              <CloudDownload className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-100 flex items-center gap-2">
                Actualizar Base de Datos
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-purple-950 text-purple-300 border border-purple-500/40 uppercase">
                  GitHub
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Descarga y actualiza territorios con respaldo previo automático
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
          
          {/* Status notification banner */}
          {statusMsg && (
            <div className={`p-3.5 rounded-2xl border flex items-start gap-3 animate-fadeIn ${
              statusMsg.type === 'error'
                ? 'bg-rose-950/50 border-rose-800/80 text-rose-200'
                : statusMsg.type === 'success'
                  ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-200'
                  : 'bg-cyan-950/60 border-cyan-500/60 text-cyan-200'
            }`}>
              {statusMsg.type === 'error' ? (
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <p className="font-semibold">{statusMsg.text}</p>
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
                  {localTerritoriesCount} Territorios
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-slate-900 text-cyan-400 rounded-xl border border-slate-800">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-mono">Última descarga</span>
                <span className="text-xs font-semibold text-slate-300 truncate block max-w-[120px]">
                  {lastSync?.timestamp 
                    ? new Date(lastSync.timestamp).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
                    : 'Ninguna'}
                </span>
              </div>
            </div>
          </div>

          {/* URL Input Form */}
          <div className="space-y-2 bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
            <div className="flex items-center justify-between">
              <label htmlFor="input-sync-url" className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Github className="w-4 h-4 text-slate-400" />
                <span>Enlace directo a territorios.json</span>
              </label>
              <button
                type="button"
                onClick={handlePasteClipboard}
                className="text-[11px] text-purple-400 hover:text-purple-300 font-semibold underline underline-offset-2 cursor-pointer"
              >
                Pegar enlace
              </button>
            </div>

            <div className="relative">
              <input
                id="input-sync-url"
                type="url"
                placeholder="https://raw.githubusercontent.com/usuario/repo/main/territorios.json"
                value={syncUrl}
                onChange={(e) => setSyncUrl(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 text-slate-200 font-mono text-xs p-3 rounded-xl focus:outline-none focus:border-purple-500 transition shadow-inner placeholder:text-slate-600"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <p className="text-[11px] text-slate-400">
                Compatible con enlaces <strong>Raw</strong> de repositorios de GitHub y <strong>Gists públicos</strong>.
              </p>
              <button
                type="button"
                onClick={() => setShowHelpDetails(!showHelpDetails)}
                className="text-[11px] text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1 cursor-pointer shrink-0 ml-2"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>{showHelpDetails ? 'Ocultar ayuda' : '¿Cómo obtenerlo?'}</span>
              </button>
            </div>

            {/* Help instructions accordion */}
            {showHelpDetails && (
              <div className="mt-2 p-3 bg-slate-900 rounded-xl border border-slate-800 text-[11px] text-slate-300 space-y-1.5">
                <p className="font-bold text-cyan-300">Instrucciones rápidas para GitHub:</p>
                <ol className="list-decimal pl-4 space-y-1 text-slate-400">
                  <li>Sube tu archivo <code className="text-amber-300">territorios.json</code> a un repositorio o a <span className="text-slate-200">gist.github.com</span>.</li>
                  <li>Abre el archivo en GitHub y haz clic en el botón <strong className="text-slate-200">Raw</strong>.</li>
                  <li>Copia la dirección del navegador y pégala en esta casilla.</li>
                </ol>
                <p className="text-[10px] text-slate-500 pt-1">
                  💡 La aplicación convierte automáticamente los enlaces web normales a enlaces directos descargables.
                </p>
              </div>
            )}
          </div>

          {/* Sync Action Button */}
          <button
            id="btn-trigger-github-sync"
            onClick={handleSyncNow}
            disabled={isLoading || isUndoing}
            className="w-full py-3.5 px-4 bg-gradient-to-r from-purple-600 to-emerald-600 hover:from-purple-500 hover:to-emerald-500 active:scale-[0.98] disabled:opacity-50 text-white font-bold text-xs sm:text-sm rounded-2xl shadow-xl shadow-purple-950 transition flex items-center justify-center gap-2 cursor-pointer"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Descargando y actualizando base de datos...</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                <span>Actualizar Base de Datos Ahora</span>
              </>
            )}
          </button>

          {/* UNDO / DESHACER SECTION (Key user requirement) */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-amber-400" />
                <span className="font-bold text-xs text-slate-200">
                  Punto de Restauración y Deshacer
                </span>
              </div>
              {restorePoint.exists && (
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-600/40">
                  Disponible
                </span>
              )}
            </div>

            {restorePoint.exists ? (
              <div className="space-y-2.5">
                <div className="p-3 bg-amber-950/20 border border-amber-700/40 rounded-xl text-[11px] text-slate-300 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Versión previa guardada:</span>
                    <span className="font-mono text-amber-300 font-semibold">{restorePoint.formattedDate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Contenido guardado:</span>
                    <span className="text-slate-200 font-semibold">
                      {restorePoint.territoriesCount} territorios, {restorePoint.notesCount} notas
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400">
                  Si la última actualización no quedó como esperabas, puedes deshacer los cambios y volver exactamente a tu versión previa con un solo toque:
                </p>

                <button
                  id="btn-undo-github-sync"
                  onClick={handleUndoSync}
                  disabled={isUndoing || isLoading}
                  className="w-full py-2.5 px-3 bg-slate-900 hover:bg-amber-950/80 active:scale-[0.98] disabled:opacity-50 text-amber-300 hover:text-amber-200 font-bold text-xs rounded-xl border border-amber-600/50 hover:border-amber-500 transition flex items-center justify-center gap-2 cursor-pointer shadow"
                >
                  {isUndoing ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                      <span>Restaurando versión previa...</span>
                    </>
                  ) : (
                    <>
                      <Undo2 className="w-4 h-4 text-amber-400" />
                      <span>Deshacer y Restaurar Versión Anterior</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800/80 text-[11px] text-slate-400">
                <p>
                  🛡️ Cada vez que pulses <em>"Actualizar Base de Datos Ahora"</em>, el sistema creará automáticamente un punto de restauración para que puedas deshacer cualquier cambio si no te gusta el resultado.
                </p>
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="p-3.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <span className="text-[11px] text-slate-500">
            Los datos se guardan para uso 100% offline
          </span>
          <button
            id="btn-footer-close-sync"
            onClick={onClose}
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-semibold transition cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
