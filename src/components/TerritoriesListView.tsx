import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Plus, 
  Download, 
  Upload, 
  Map, 
  Navigation, 
  Edit3, 
  Trash2, 
  Layers, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  FileCode,
  Share2,
  Fingerprint,
  RefreshCw,
  CloudDownload
} from 'lucide-react';
import { Territory, TerritoryStatus } from '../types';
import { formatArea, formatDistance, exportToKML, exportToGeoJSON, parseKML, parseGeoJSON, getTerritoryDisplayCode } from '../services/geoUtils';
import { dbService } from '../services/db';

interface TerritoriesListViewProps {
  territories: Territory[];
  isAdminUnlocked?: boolean;
  onRequestUnlock?: () => void;
  onSelectTerritoryOnMap: (territory: Territory) => void;
  onNavigateToTerritory: (territory: Territory) => void;
  onEditTerritory: (territory: Territory) => void;
  onDeleteTerritory: (id: string) => void;
  onStartDrawing: () => void;
  onImportTerritories: (imported: Partial<Territory>[]) => void;
  onReloadAllData?: () => Promise<void>;
  onOpenDatabaseSyncModal?: () => void;
}

export const TerritoriesListView: React.FC<TerritoriesListViewProps> = ({
  territories,
  isAdminUnlocked = false,
  onRequestUnlock,
  onSelectTerritoryOnMap,
  onNavigateToTerritory,
  onEditTerritory,
  onDeleteTerritory,
  onStartDrawing,
  onImportTerritories,
  onReloadAllData,
  onOpenDatabaseSyncModal
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [exportMenuOpen, setExportMenuOpen] = useState<boolean>(false);

  // Statistics
  const stats = useMemo(() => {
    const total = territories.length;
    const totalArea = territories.reduce((acc, t) => acc + (t.areaM2 || 0), 0);
    const completed = territories.filter(t => t.status === 'completado').length;
    const active = territories.filter(t => t.status === 'activo').length;
    const inProgress = territories.filter(t => t.status === 'en_progreso').length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { total, totalArea, completed, active, inProgress, completionRate };
  }, [territories]);

  // Filtered territories
  const filtered = useMemo(() => {
    return territories.filter((t) => {
      const displayCode = getTerritoryDisplayCode(t);
      const matchSearch =
        t.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        displayCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.assignedTo && t.assignedTo.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchStatus = statusFilter === 'todos' || t.status === statusFilter;

      return matchSearch && matchStatus;
    });
  }, [territories, searchTerm, statusFilter]);

  // Handle file import / restore backup
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      if (!content) return;

      try {
        const fileName = file.name.toLowerCase();

        if (fileName.endsWith('.kml')) {
          const { territories: parsedTerritories } = parseKML(content);
          if (parsedTerritories.length > 0) {
            onImportTerritories(parsedTerritories);
            alert(`Se importaron exitosamente ${parsedTerritories.length} territorios desde el archivo KML. La app permanece en Modo usuario 🔒.`);
          } else {
            alert('No se encontraron polígonos válidos en el archivo KML.');
          }
        } else if (fileName.endsWith('.geojson')) {
          const { territories: parsedTerritories } = parseGeoJSON(content);
          if (parsedTerritories.length > 0) {
            onImportTerritories(parsedTerritories);
            alert(`Se importaron exitosamente ${parsedTerritories.length} territorios desde GeoJSON. La app permanece en Modo usuario 🔒.`);
          } else {
            alert('No se encontraron geometrías poligonales en el GeoJSON.');
          }
        } else {
          // JSON backup or GeoJSON
          try {
            const parsedJson = JSON.parse(content);
            if (parsedJson.territories || parsedJson.labels || parsedJson.app) {
              const res = await dbService.importFullBackup(content);
              if (onReloadAllData) {
                await onReloadAllData();
              }
              alert(`Copia de seguridad restaurada con éxito (${res.importedTerritories} territorios, ${res.importedLabels} letras, ${res.importedNotes} notas). La app permanece en Modo usuario 🔒.`);
            } else {
              const { territories: parsedTerritories } = parseGeoJSON(content);
              if (parsedTerritories.length > 0) {
                onImportTerritories(parsedTerritories);
                alert(`Se importaron exitosamente ${parsedTerritories.length} territorios desde el archivo JSON.`);
              } else {
                const res = await dbService.importFullBackup(content);
                if (onReloadAllData) {
                  await onReloadAllData();
                }
                alert(`Copia de seguridad restaurada (${res.importedTerritories} territorios importados).`);
              }
            }
          } catch {
            const { territories: parsedTerritories } = parseGeoJSON(content);
            if (parsedTerritories.length > 0) {
              onImportTerritories(parsedTerritories);
              alert(`Se importaron exitosamente ${parsedTerritories.length} territorios.`);
            } else {
              alert('No se pudieron procesar los datos del archivo.');
            }
          }
        }
      } catch (err) {
        alert('Error al leer el archivo. Asegúrate de que sea un JSON, KML o GeoJSON válido.');
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // reset
  };

  const downloadFile = (content: string, fileName: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportAllKML = () => {
    const kml = exportToKML(territories);
    downloadFile(kml, `territorios_${new Date().toISOString().slice(0, 10)}.kml`, 'application/vnd.google-earth.kml+xml');
    setExportMenuOpen(false);
  };

  const handleExportAllGeoJSON = () => {
    const geojson = exportToGeoJSON(territories);
    downloadFile(geojson, `territorios_${new Date().toISOString().slice(0, 10)}.geojson`, 'application/geo+json');
    setExportMenuOpen(false);
  };

  const getStatusBadge = (status: TerritoryStatus) => {
    switch (status) {
      case 'completado':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-800">Completado</span>;
      case 'en_progreso':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-950/80 text-blue-400 border border-blue-800">En progreso</span>;
      case 'pendiente':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950/80 text-amber-400 border border-amber-800">Pendiente</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">Activo</span>;
    }
  };

  return (
    <div className="h-full w-full bg-slate-950 text-slate-100 flex flex-col overflow-hidden">
      {/* Top Banner & Stats */}
      <div className="bg-slate-900 border-b border-slate-800 p-3 sm:p-4 shrink-0 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-3">
          <div>
            <h2 className="text-base font-bold uppercase tracking-wider text-slate-100 flex items-center gap-2">
              <Layers className="w-5 h-5 text-emerald-400" />
              Gestión de Territorios
            </h2>
            <p className="text-xs text-slate-400">
              {territories.length} polígonos registrados en memoria local
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Database Sync from GitHub - Highlighted Purple Button */}
            {onOpenDatabaseSyncModal && (
              <button
                id="btn-open-sync-territories-header"
                type="button"
                onClick={onOpenDatabaseSyncModal}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 text-white text-xs font-bold rounded-xl border border-purple-400/50 transition shadow-md shadow-purple-950/50 cursor-pointer active:scale-95"
                title="Actualizar base de datos desde GitHub o Gist"
              >
                <RefreshCw className="w-3.5 h-3.5 text-purple-200 animate-spin-slow" />
                <span>Actualizar (GitHub)</span>
              </button>
            )}

            {/* Import file / Restore Backup */}
            <label className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 cursor-pointer transition">
              <Upload className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">Importar</span>
              <input
                id="input-import-territories-file"
                type="file"
                accept=".kml,.geojson,.json"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>

            {/* Export dropdown */}
            <div className="relative">
              <button
                id="btn-export-territories-menu"
                onClick={() => setExportMenuOpen(!exportMenuOpen)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Exportar</span>
              </button>

              {exportMenuOpen && (
                <div className="absolute right-0 top-9 w-44 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-1.5 z-30 flex flex-col gap-1">
                  <button
                    onClick={handleExportAllKML}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-slate-200 hover:bg-slate-800 text-left"
                  >
                    <FileCode className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Exportar KML</span>
                  </button>
                  <button
                    onClick={handleExportAllGeoJSON}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-slate-200 hover:bg-slate-800 text-left"
                  >
                    <FileCode className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Exportar GeoJSON</span>
                  </button>
                </div>
              )}
            </div>

            {/* New Territory Draw (Admin Only) or Quick Unlock */}
            {isAdminUnlocked ? (
              <button
                id="btn-new-territory-draw"
                onClick={onStartDrawing}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs rounded-xl shadow-md transition active:scale-95"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Dibujar</span>
              </button>
            ) : (
              onRequestUnlock && (
                <button
                  id="btn-unlock-territories-view"
                  onClick={onRequestUnlock}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-md transition active:scale-95"
                  title="Desbloquear con huella para crear, editar o importar territorios"
                >
                  <Fingerprint className="w-4 h-4 stroke-[2.5]" />
                  <span>Desbloquear Edición</span>
                </button>
              )
            )}
          </div>
        </div>

        {/* Global Summary Stats Cards */}
        <div className="grid grid-cols-4 gap-2 text-center bg-slate-950 p-2.5 rounded-xl border border-slate-800">
          <div>
            <span className="text-[10px] uppercase font-mono text-slate-500 block">Total</span>
            <span className="text-sm font-mono font-bold text-slate-200">{stats.total}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-mono text-slate-500 block">Área Total</span>
            <span className="text-sm font-mono font-bold text-emerald-400 truncate block">{formatArea(stats.totalArea)}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-mono text-slate-500 block">En Curso</span>
            <span className="text-sm font-mono font-bold text-cyan-400">{stats.active + stats.inProgress}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-mono text-slate-500 block">Completitud</span>
            <span className="text-sm font-mono font-bold text-amber-400">{stats.completionRate}%</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-3 bg-slate-900/50 border-b border-slate-800 flex flex-col sm:flex-row gap-2 shrink-0">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="input-search-territories"
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por código, nombre o asignado..."
            className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: 'todos', label: 'Todos' },
            { id: 'activo', label: 'Activos' },
            { id: 'en_progreso', label: 'En Progreso' },
            { id: 'completado', label: 'Completados' },
            { id: 'pendiente', label: 'Pendientes' }
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                statusFilter === f.id
                  ? 'bg-emerald-600 text-slate-950 font-bold'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable Territories List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-slate-500">
            <Layers className="w-12 h-12 mx-auto mb-2 opacity-30 text-emerald-400" />
            <p className="text-sm font-semibold text-slate-400">No se encontraron territorios</p>
            <p className="text-xs text-slate-600 mt-1">
              {searchTerm ? 'Prueba con otro término de búsqueda' : 'Dibuja o importa un nuevo polígono territorial'}
            </p>
          </div>
        ) : (
          filtered.map((territory) => (
            <div
              key={territory.id}
              className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-2xl p-3.5 shadow-md transition flex flex-col gap-2.5"
            >
              {/* Card Header: Code, Name, Status */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5">
                  <div
                    className="w-3.5 h-3.5 rounded-full mt-1 shrink-0 shadow-sm"
                    style={{ backgroundColor: territory.color }}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-xs text-emerald-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800 tracking-wide">
                        {getTerritoryDisplayCode(territory)}
                      </span>
                      <h4 className="font-bold text-sm text-slate-100 leading-tight">
                        {territory.name}
                      </h4>
                    </div>
                    {territory.assignedTo && (
                      <p className="text-xs text-slate-400 mt-0.5">
                        Asignado a: <span className="text-slate-200 font-medium">{territory.assignedTo}</span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="shrink-0">{getStatusBadge(territory.status)}</div>
              </div>

              {/* Spatial metrics */}
              <div className="flex items-center gap-3 text-xs font-mono text-slate-400 bg-slate-950/60 px-3 py-1.5 rounded-xl border border-slate-800/80">
                <div>
                  <span className="text-slate-500">Área: </span>
                  <span className="text-emerald-400 font-bold">{formatArea(territory.areaM2)}</span>
                </div>
                <div>
                  <span className="text-slate-500">Perímetro: </span>
                  <span className="text-cyan-400 font-bold">{formatDistance(territory.perimeterM)}</span>
                </div>
                <div>
                  <span className="text-slate-500">Vértices: </span>
                  <span className="text-slate-300 font-bold">{territory.coordinates.length}</span>
                </div>
              </div>

              {/* Description if any */}
              {territory.description && (
                <p className="text-xs text-slate-300 bg-slate-950/30 p-2 rounded-lg border border-slate-800/50 line-clamp-2">
                  {territory.description}
                </p>
              )}

              {/* Card Action Buttons */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => onSelectTerritoryOnMap(territory)}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-700/60 rounded-xl text-xs font-semibold transition"
                    title="Centrar en el visor cartográfico"
                  >
                    <Map className="w-3.5 h-3.5" />
                    <span>Ver en Mapa</span>
                  </button>

                  <button
                    onClick={() => onNavigateToTerritory(territory)}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-fuchsia-950/80 hover:bg-fuchsia-900 text-fuchsia-300 border border-fuchsia-700/60 rounded-xl text-xs font-semibold transition"
                    title="Iniciar navegación peatonal hacia el centroide"
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    <span>Navegar</span>
                  </button>
                </div>

                {isAdminUnlocked && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onEditTerritory(territory)}
                      className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition"
                      title="Editar territorio"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>

                    <button
                      id={`btn-delete-territory-${territory.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteTerritory(territory.id);
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/60 active:scale-90 rounded-lg transition"
                      title="Eliminar territorio"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
