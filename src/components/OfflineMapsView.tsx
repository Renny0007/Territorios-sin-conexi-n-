import React, { useState, useEffect } from 'react';
import { 
  CloudOff, 
  Download, 
  Trash2, 
  HardDrive, 
  CheckCircle, 
  AlertCircle, 
  Map, 
  Layers, 
  Loader2,
  X
} from 'lucide-react';
import { TilePackage, Territory, MapProviderId } from '../types';
import { MAP_PROVIDERS, tileManager, getTilesInBounds } from '../services/tileManager';
import { calculateBounds } from '../services/geoUtils';

interface OfflineMapsViewProps {
  tilePackages: TilePackage[];
  territories: Territory[];
  mapProvider: MapProviderId;
  onDownloadPackage: (
    name: string,
    bounds: [[number, number], [number, number]],
    minZoom: number,
    maxZoom: number,
    provider: MapProviderId
  ) => Promise<void>;
  onDeletePackage: (id: string) => void;
  onCancelDownload: (id: string) => void;
  activeDownload: { packageId: string; downloaded: number; total: number } | null;
}

export const OfflineMapsView: React.FC<OfflineMapsViewProps> = ({
  tilePackages,
  territories,
  mapProvider,
  onDownloadPackage,
  onDeletePackage,
  onCancelDownload,
  activeDownload
}) => {
  const [showNewDownloadModal, setShowNewDownloadModal] = useState<boolean>(false);
  const [packageName, setPackageName] = useState<string>('Zona Urbana Principal');
  const [selectedTerritoryId, setSelectedTerritoryId] = useState<string>('');
  const [minZoom, setMinZoom] = useState<number>(14);
  const [maxZoom, setMaxZoom] = useState<number>(17);
  const [storageInfo, setStorageInfo] = useState<{ usedBytes: number; quotaBytes: number; percentage: number }>({
    usedBytes: 0,
    quotaBytes: 1024 * 1024 * 1024,
    percentage: 0
  });

  // Calculate storage usage
  useEffect(() => {
    tileManager.getStorageUsage().then(setStorageInfo);
  }, [tilePackages]);

  // Selected bounds calculation
  const getSelectedBounds = (): [[number, number], [number, number]] => {
    if (selectedTerritoryId) {
      const terr = territories.find(t => t.id === selectedTerritoryId);
      if (terr && terr.coordinates.length > 0) {
        return calculateBounds(terr.coordinates);
      }
    }
    // Default fallback: Naime Etapa 2, San Pedro de Macorís bounds ~2km radius
    return [
      [18.4750, -69.3100],
      [18.4950, -69.2900]
    ];
  };

  const estimatedTiles = React.useMemo(() => {
    const b = getSelectedBounds();
    const tiles = getTilesInBounds(b, minZoom, maxZoom);
    return tiles.length;
  }, [selectedTerritoryId, minZoom, maxZoom, territories]);

  const estimatedSizeMb = ((estimatedTiles * 22) / 1024).toFixed(1); // approx 22KB per tile

  const handleStartDownload = async () => {
    if (!packageName.trim()) return;
    const b = getSelectedBounds();
    setShowNewDownloadModal(false);
    await onDownloadPackage(packageName.trim(), b, minZoom, maxZoom, mapProvider);
  };

  const formatMb = (bytes: number) => (bytes / (1024 * 1024)).toFixed(1);

  return (
    <div className="h-full w-full bg-slate-950 text-slate-100 flex flex-col overflow-hidden">
      {/* Top Header */}
      <div className="bg-slate-900 border-b border-slate-800 p-4 shrink-0 shadow-md">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div>
            <h2 className="text-base font-bold uppercase tracking-wider text-slate-100 flex items-center gap-2">
              <CloudOff className="w-5 h-5 text-emerald-400" />
              Mapas Sin Conexión
            </h2>
            <p className="text-xs text-slate-400">
              Descarga mapas y la red de calles peatonales para navegar sin internet
            </p>
          </div>

          <button
            id="btn-download-new-package"
            onClick={() => setShowNewDownloadModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs rounded-xl shadow-md transition active:scale-95"
          >
            <Download className="w-4 h-4 stroke-[3]" />
            <span>Descargar Zona</span>
          </button>
        </div>

        {/* Device Storage Status Card */}
        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-xs font-mono mb-1.5">
            <span className="text-slate-400 flex items-center gap-1">
              <HardDrive className="w-3.5 h-3.5 text-cyan-400" />
              Almacenamiento Local (IndexedDB)
            </span>
            <span className="text-slate-200 font-bold">
              {formatMb(storageInfo.usedBytes)} MB / {formatMb(storageInfo.quotaBytes)} MB ({storageInfo.percentage}%)
            </span>
          </div>

          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all duration-300"
              style={{ width: `${Math.max(3, storageInfo.percentage)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Active Download Progress Card if running */}
      {activeDownload && (
        <div className="p-3 bg-emerald-950/40 border-b border-emerald-800/60 flex flex-col gap-2 shrink-0 animate-in fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
              <span className="text-xs font-bold text-emerald-300">
                Descargando mosaicos ({activeDownload.downloaded} / {activeDownload.total})
              </span>
            </div>
            <button
              onClick={() => onCancelDownload(activeDownload.packageId)}
              className="text-xs text-rose-400 hover:text-rose-300 bg-rose-950/60 px-2 py-0.5 rounded border border-rose-800"
            >
              Cancelar
            </button>
          </div>

          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all"
              style={{
                width: `${activeDownload.total > 0 ? (activeDownload.downloaded / activeDownload.total) * 100 : 0}%`
              }}
            />
          </div>
        </div>
      )}

      {/* List of Downloaded Packages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        <h3 className="text-xs uppercase font-mono text-slate-400 px-1 font-bold">
          Paquetes de Mosaicos Guardados ({tilePackages.length})
        </h3>

        {tilePackages.length === 0 ? (
          <div className="py-12 text-center text-slate-500 bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6">
            <CloudOff className="w-12 h-12 mx-auto mb-2 opacity-30 text-emerald-400" />
            <p className="text-sm font-semibold text-slate-400">No hay paquetes sin conexión descargados</p>
            <p className="text-xs text-slate-600 mt-1 max-w-sm mx-auto">
              Presiona "Descargar Zona" para guardar un área en la memoria del dispositivo y usar el mapa en modo avión o sin cobertura.
            </p>
          </div>
        ) : (
          tilePackages.map((pkg) => (
            <div
              key={pkg.id}
              className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-3.5 shadow-md flex items-center justify-between gap-3"
            >
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-800/60 text-emerald-400 mt-0.5">
                  <Map className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-100">{pkg.name}</h4>
                  <div className="flex items-center gap-2 text-xs font-mono text-slate-400 mt-0.5">
                    <span>{pkg.downloadedTiles} mosaicos</span>
                    <span>•</span>
                    <span className="text-cyan-400 font-bold">{formatMb(pkg.sizeBytes)} MB</span>
                    <span>•</span>
                    <span>Zoom {pkg.minZoom}-{pkg.maxZoom}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[10px] bg-emerald-950/80 border border-emerald-700/80 text-emerald-300 font-mono font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle className="w-3 h-3 text-emerald-400" />
                      Mapa + Rutas Peatonales Offline
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono mt-1 block">
                    Capa: {MAP_PROVIDERS[pkg.provider as MapProviderId]?.name || pkg.provider}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  id={`btn-delete-pkg-${pkg.id}`}
                  onClick={() => onDeletePackage(pkg.id)}
                  className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-950/60 active:scale-95 rounded-xl border border-slate-800 transition"
                  title="Eliminar paquete offline"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* New Package Download Modal */}
      {showNewDownloadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="px-4 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
              <div className="flex items-center gap-2">
                <Download className="w-4 h-4 text-emerald-400" />
                <h3 className="font-bold text-sm text-slate-100 uppercase tracking-wide">
                  Descargar Paquete Offline
                </h3>
              </div>
              <button
                onClick={() => setShowNewDownloadModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-mono uppercase text-slate-400 mb-1">
                  Nombre del Paquete
                </label>
                <input
                  type="text"
                  value={packageName}
                  onChange={(e) => setPackageName(e.target.value)}
                  placeholder="ej. Sector Norte y Centro"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-slate-400 mb-1">
                  Área Geográfica a Descargar
                </label>
                <select
                  value={selectedTerritoryId}
                  onChange={(e) => setSelectedTerritoryId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none"
                >
                  <option value="">Vista Central Urbana (Predeterminada)</option>
                  {territories.map((t) => (
                    <option key={t.id} value={t.id}>
                      Polígono {t.code} - {t.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Zoom levels */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono uppercase text-slate-400 mb-1">
                    Zoom Mínimo ({minZoom})
                  </label>
                  <input
                    type="range"
                    min={12}
                    max={16}
                    value={minZoom}
                    onChange={(e) => setMinZoom(parseInt(e.target.value))}
                    className="w-full accent-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono uppercase text-slate-400 mb-1">
                    Zoom Máximo ({maxZoom})
                  </label>
                  <input
                    type="range"
                    min={15}
                    max={18}
                    value={maxZoom}
                    onChange={(e) => setMaxZoom(parseInt(e.target.value))}
                    className="w-full accent-emerald-500"
                  />
                </div>
              </div>

              {/* Estimate Calculation Banner */}
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between text-xs font-mono">
                <div>
                  <span className="text-slate-500 block">Total Mosaicos</span>
                  <span className="font-bold text-emerald-400">{estimatedTiles} tiles</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Peso Estimado</span>
                  <span className="font-bold text-cyan-400">~{estimatedSizeMb} MB</span>
                </div>
              </div>
            </div>

            <div className="px-4 py-3 bg-slate-950/60 border-t border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNewDownloadModal(false)}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                id="btn-confirm-start-download"
                onClick={handleStartDownload}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-lg"
              >
                <Download className="w-4 h-4" />
                <span>Iniciar Descarga</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
