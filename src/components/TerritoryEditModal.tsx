import React, { useState } from 'react';
import { 
  X, 
  Save, 
  Trash2, 
  Layers, 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  MapPin, 
  Compass 
} from 'lucide-react';
import { Territory, TerritoryStatus, TerritoryPriority } from '../types';
import { formatArea, formatDistance, formatCoordinate } from '../services/geoUtils';

interface TerritoryEditModalProps {
  initialTerritory: Partial<Territory>;
  onSave: (territory: Territory) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
}

const TACTICAL_COLORS = [
  { name: 'Esmeralda', hex: '#10b981' },
  { name: 'Cian Táctico', hex: '#06b6d4' },
  { name: 'Azul Marino', hex: '#3b82f6' },
  { name: 'Índigo', hex: '#6366f1' },
  { name: 'Fucsia', hex: '#d946ef' },
  { name: 'Ámbar Alerta', hex: '#f59e0b' },
  { name: 'Naranja Fuerte', hex: '#f97316' },
  { name: 'Rojo Urgente', hex: '#ef4444' },
  { name: 'Lima', hex: '#84cc16' }
];

export const TerritoryEditModal: React.FC<TerritoryEditModalProps> = ({
  initialTerritory,
  onSave,
  onDelete,
  onClose
}) => {
  const [code, setCode] = useState<string>(initialTerritory.code || 'T-101');
  const [name, setName] = useState<string>(initialTerritory.name || '');
  const [assignedTo, setAssignedTo] = useState<string>(initialTerritory.assignedTo || '');
  const [status, setStatus] = useState<TerritoryStatus>(initialTerritory.status || 'activo');
  const [priority, setPriority] = useState<TerritoryPriority>(initialTerritory.priority || 'media');
  const [color, setColor] = useState<string>(initialTerritory.color || '#10b981');
  const [description, setDescription] = useState<string>(initialTerritory.description || '');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const coordinates = initialTerritory.coordinates || [];
  const areaM2 = initialTerritory.areaM2 || 0;
  const perimeterM = initialTerritory.perimeterM || 0;
  const centroid = initialTerritory.centroid || [0, 0];

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setErrorMsg('El código de territorio es obligatorio (ej. T-101)');
      return;
    }
    if (!name.trim()) {
      setErrorMsg('El nombre o sector del territorio es obligatorio');
      return;
    }

    const territory: Territory = {
      id: initialTerritory.id || `t_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      code: code.trim().toUpperCase(),
      name: name.trim(),
      assignedTo: assignedTo.trim(),
      status,
      priority,
      color,
      coordinates,
      areaM2,
      perimeterM,
      centroid,
      description: description.trim(),
      createdAt: initialTerritory.createdAt || Date.now(),
      updatedAt: Date.now(),
      completedAt: status === 'completado' ? (initialTerritory.completedAt || Date.now()) : undefined
    };

    onSave(territory);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-4 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-2">
            <div 
              className="w-3.5 h-3.5 rounded-full shadow" 
              style={{ backgroundColor: color }}
            />
            <h3 className="font-bold text-sm text-slate-100 uppercase tracking-wide">
              {initialTerritory.id ? `Editar Territorio ${code}` : 'Nuevo Territorio'}
            </h3>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form id="territory-form" onSubmit={handleSave} className="p-4 overflow-y-auto space-y-4 flex-1">
          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Spatial Info Banner */}
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-mono block">Área</span>
              <span className="text-xs font-mono font-bold text-emerald-400">{formatArea(areaM2)}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-mono block">Perímetro</span>
              <span className="text-xs font-mono font-bold text-cyan-400">{formatDistance(perimeterM)}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-mono block">Vértices</span>
              <span className="text-xs font-mono font-bold text-amber-400">{coordinates.length}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-mono block">Centroide</span>
              <span className="text-[10px] font-mono text-slate-300 truncate block">
                {formatCoordinate(centroid[0], centroid[1])}
              </span>
            </div>
          </div>

          {/* Code & Name Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-mono uppercase text-slate-400 mb-1">
                Código / Número <span className="text-emerald-400">*</span>
              </label>
              <input
                id="input-territory-code"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="ej. 18 (#2) o 17 (03)"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-100 focus:border-emerald-500 focus:outline-none"
                required
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-mono uppercase text-slate-400 mb-1">
                Nombre / Sector <span className="text-emerald-400">*</span>
              </label>
              <input
                id="input-territory-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ej. Barrio San José - Sector Norte"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none"
                required
              />
            </div>
          </div>

          {/* Assigned Worker & Priority */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-mono uppercase text-slate-400 mb-1">
                Asignado a
              </label>
              <input
                id="input-territory-assigned"
                type="text"
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                placeholder="Nombre del brigadista o voluntario"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-slate-400 mb-1">
                Prioridad
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TerritoryPriority)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none"
              >
                <option value="baja">Baja</option>
                <option value="media">Media</option>
                <option value="alta">Alta</option>
                <option value="urgente">Urgente</option>
              </select>
            </div>
          </div>

          {/* Status Selection */}
          <div>
            <label className="block text-xs font-mono uppercase text-slate-400 mb-1.5">
              Estado de Cobertura
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'activo' as TerritoryStatus, label: 'Activo', color: 'border-emerald-500 text-emerald-400 bg-emerald-950/30' },
                { id: 'en_progreso' as TerritoryStatus, label: 'En Progreso', color: 'border-blue-500 text-blue-400 bg-blue-950/30' },
                { id: 'pendiente' as TerritoryStatus, label: 'Pendiente', color: 'border-amber-500 text-amber-400 bg-amber-950/30' },
                { id: 'completado' as TerritoryStatus, label: 'Completado', color: 'border-slate-500 text-slate-300 bg-slate-800/40' }
              ].map((st) => (
                <button
                  type="button"
                  key={st.id}
                  onClick={() => setStatus(st.id)}
                  className={`py-2 px-2 rounded-xl text-xs font-bold border transition text-center ${
                    status === st.id
                      ? `${st.color} ring-1 ring-emerald-500`
                      : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tactical Color Palette */}
          <div>
            <label className="block text-xs font-mono uppercase text-slate-400 mb-1.5">
              Color en el Mapa
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              {TACTICAL_COLORS.map((c) => (
                <button
                  type="button"
                  key={c.hex}
                  onClick={() => setColor(c.hex)}
                  className={`w-7 h-7 rounded-full transition-transform flex items-center justify-center ${
                    color === c.hex ? 'scale-125 ring-2 ring-white ring-offset-2 ring-offset-slate-900' : 'hover:scale-110'
                  }`}
                  style={{ backgroundColor: c.hex }}
                  title={c.name}
                >
                  {color === c.hex && <div className="w-2 h-2 rounded-full bg-slate-950" />}
                </button>
              ))}
            </div>
          </div>

          {/* Description / Field notes */}
          <div>
            <label className="block text-xs font-mono uppercase text-slate-400 mb-1">
              Notas y Observaciones de Campo
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Instrucciones especiales, puntos de acceso, perros sueltos, horarios recomendados..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none resize-none"
            />
          </div>
        </form>

        {/* Footer Actions */}
        <div className="px-4 py-3 bg-slate-950/60 border-t border-slate-800 flex items-center justify-between gap-2">
          {initialTerritory.id && onDelete ? (
            <button
              type="button"
              id="btn-delete-territory-modal"
              onClick={() => {
                onDelete(initialTerritory.id!);
              }}
              className="px-3 py-2 bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Eliminar</span>
            </button>
          ) : <div />}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
            >
              Cancelar
            </button>

            <button
              type="submit"
              form="territory-form"
              id="btn-save-territory-submit"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-950 transition active:scale-95"
            >
              <Save className="w-4 h-4" />
              <span>Guardar Territorio</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
