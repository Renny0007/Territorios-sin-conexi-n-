import React, { useState } from 'react';
import { 
  X, 
  Save, 
  Trash2, 
  MapPin, 
  Navigation, 
  AlertTriangle, 
  Building, 
  FileText 
} from 'lucide-react';
import { MapNote, NoteCategory, Territory, GPSState } from '../types';
import { formatCoordinate } from '../services/geoUtils';

interface NoteEditModalProps {
  initialNote: Partial<MapNote>;
  territories: Territory[];
  gpsState: GPSState;
  onSave: (note: MapNote) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
}

const CATEGORIES: { id: NoteCategory; label: string; bg: string; border: string }[] = [
  { id: 'visita', label: 'Visita Exitosa', bg: 'bg-emerald-950/80', border: 'border-emerald-500' },
  { id: 'no_en_casa', label: 'No en Casa', bg: 'bg-amber-950/80', border: 'border-amber-500' },
  { id: 'impedimento', label: 'Impedimento / Perro', bg: 'bg-rose-950/80', border: 'border-rose-500' },
  { id: 'revisitar', label: 'Volver a Visitar', bg: 'bg-blue-950/80', border: 'border-blue-500' },
  { id: 'peligro', label: 'Alerta / Peligro', bg: 'bg-red-950/80', border: 'border-red-600' },
  { id: 'general', label: 'Nota General', bg: 'bg-purple-950/80', border: 'border-purple-500' }
];

export const NoteEditModal: React.FC<NoteEditModalProps> = ({
  initialNote,
  territories,
  gpsState,
  onSave,
  onDelete,
  onClose
}) => {
  const [title, setTitle] = useState<string>(initialNote.title || '');
  const [address, setAddress] = useState<string>(initialNote.address || '');
  const [description, setDescription] = useState<string>(initialNote.description || '');
  const [category, setCategory] = useState<NoteCategory>(initialNote.category || 'visita');
  const [territoryId, setTerritoryId] = useState<string>(initialNote.territoryId || '');
  const [coordinate, setCoordinate] = useState<[number, number]>(
    initialNote.coordinate || [gpsState.latitude || 18.48517, gpsState.longitude || -69.30083]
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleUseCurrentGps = () => {
    if (gpsState.active && gpsState.latitude !== null && gpsState.longitude !== null) {
      setCoordinate([gpsState.latitude, gpsState.longitude]);
    } else {
      setErrorMsg('El GPS no está activo en este momento.');
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg('El título de la nota o dirección es obligatorio.');
      return;
    }

    const note: MapNote = {
      id: initialNote.id || `n_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      territoryId: territoryId || undefined,
      title: title.trim(),
      address: address.trim(),
      description: description.trim(),
      category,
      coordinate,
      status: initialNote.status || 'abierto',
      createdAt: initialNote.createdAt || Date.now(),
      updatedAt: Date.now()
    };

    onSave(note);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-4 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-cyan-400" />
            <h3 className="font-bold text-sm text-slate-100 uppercase tracking-wide">
              {initialNote.id ? 'Editar Nota de Campo' : 'Nueva Nota de Campo'}
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
        <form id="note-form" onSubmit={handleSave} className="p-4 overflow-y-auto space-y-4 flex-1">
          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Category Selector */}
          <div>
            <label className="block text-xs font-mono uppercase text-slate-400 mb-1.5">
              Tipo / Categoría
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  type="button"
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  className={`py-2 px-2 rounded-xl text-xs font-semibold border transition text-center ${
                    category === cat.id
                      ? `${cat.bg} ${cat.border} text-white ring-1 ring-white`
                      : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Title & Street Address */}
          <div>
            <label className="block text-xs font-mono uppercase text-slate-400 mb-1">
              Título / Referencia <span className="text-emerald-400">*</span>
            </label>
            <input
              id="input-note-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="ej. Casa con portón blanco o Dpto 4B"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-mono uppercase text-slate-400 mb-1">
              Dirección o Calle
            </label>
            <input
              id="input-note-address"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="ej. Av. Libertad #1240"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          {/* Territory Association */}
          <div>
            <label className="block text-xs font-mono uppercase text-slate-400 mb-1">
              Vincular a Territorio (Opcional)
            </label>
            <select
              value={territoryId}
              onChange={(e) => setTerritoryId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none"
            >
              <option value="">-- Sin vincular a territorio --</option>
              {territories.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.code} - {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Coordinates & GPS capture */}
          <div>
            <label className="block text-xs font-mono uppercase text-slate-400 mb-1">
              Coordenadas Geográficas
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-cyan-300">
                {formatCoordinate(coordinate[0], coordinate[1])}
              </div>
              <button
                type="button"
                onClick={handleUseCurrentGps}
                disabled={!gpsState.active || gpsState.latitude === null}
                className="px-3 py-2 bg-cyan-950 border border-cyan-700 text-cyan-300 hover:bg-cyan-900 disabled:opacity-40 disabled:hover:bg-cyan-950 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
                title="Capturar posición GPS actual"
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>Mi GPS</span>
              </button>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-mono uppercase text-slate-400 mb-1">
              Detalle / Observaciones
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Detalles de la visita, motivo de ausencia, persona de contacto..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none resize-none"
            />
          </div>
        </form>

        {/* Footer Actions */}
        <div className="px-4 py-3 bg-slate-950/60 border-t border-slate-800 flex items-center justify-between gap-2">
          {initialNote.id && onDelete ? (
            <button
              type="button"
              id="btn-delete-note-modal"
              onClick={() => {
                onDelete(initialNote.id!);
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
              form="note-form"
              id="btn-save-note-submit"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-950 transition active:scale-95"
            >
              <Save className="w-4 h-4" />
              <span>Guardar Nota</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
