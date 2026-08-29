import React, { useState, useMemo } from 'react';
import { 
  FileText, 
  Plus, 
  Search, 
  MapPin, 
  Navigation, 
  Trash2, 
  Edit3, 
  CheckCircle,
  Building,
  AlertTriangle
} from 'lucide-react';
import { MapNote, NoteCategory, Territory } from '../types';
import { formatCoordinate } from '../services/geoUtils';

interface NotesListViewProps {
  notes: MapNote[];
  territories: Territory[];
  onSelectNoteOnMap: (note: MapNote) => void;
  onNavigateToNote: (note: MapNote) => void;
  onEditNote: (note: MapNote) => void;
  onDeleteNote: (id: string) => void;
  onNewNote: () => void;
}

const CATEGORY_MAP: Record<NoteCategory, { label: string; bg: string; text: string; border: string }> = {
  visita: { label: 'Visita', bg: 'bg-emerald-950/80', text: 'text-emerald-400', border: 'border-emerald-700' },
  no_en_casa: { label: 'No en Casa', bg: 'bg-amber-950/80', text: 'text-amber-400', border: 'border-amber-700' },
  impedimento: { label: 'Impedimento', bg: 'bg-rose-950/80', text: 'text-rose-400', border: 'border-rose-700' },
  revisitar: { label: 'Revisitar', bg: 'bg-blue-950/80', text: 'text-blue-400', border: 'border-blue-700' },
  peligro: { label: 'Peligro', bg: 'bg-red-950/80', text: 'text-red-400', border: 'border-red-700' },
  general: { label: 'General', bg: 'bg-purple-950/80', text: 'text-purple-400', border: 'border-purple-700' }
};

export const NotesListView: React.FC<NotesListViewProps> = ({
  notes,
  territories,
  onSelectNoteOnMap,
  onNavigateToNote,
  onEditNote,
  onDeleteNote,
  onNewNote
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('todos');

  const filtered = useMemo(() => {
    return notes.filter((n) => {
      const matchSearch =
        n.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (n.address && n.address.toLowerCase().includes(searchTerm.toLowerCase())) ||
        n.description.toLowerCase().includes(searchTerm.toLowerCase());

      const matchCategory = categoryFilter === 'todos' || n.category === categoryFilter;

      return matchSearch && matchCategory;
    });
  }, [notes, searchTerm, categoryFilter]);

  const getTerritoryCode = (tid?: string) => {
    if (!tid) return null;
    const t = territories.find(item => item.id === tid);
    return t ? t.code : null;
  };

  return (
    <div className="h-full w-full bg-slate-950 text-slate-100 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-800 p-4 shrink-0 shadow-md flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold uppercase tracking-wider text-slate-100 flex items-center gap-2">
            <FileText className="w-5 h-5 text-cyan-400" />
            Notas y Registros de Campo
          </h2>
          <p className="text-xs text-slate-400">
            {notes.length} incidencias, visitas y direcciones registradas
          </p>
        </div>

        <button
          id="btn-create-field-note"
          onClick={onNewNote}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs rounded-xl shadow-md transition active:scale-95"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Nueva Nota</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="p-3 bg-slate-900/50 border-b border-slate-800 flex flex-col sm:flex-row gap-2 shrink-0">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por título, dirección o detalle..."
            className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
          />
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setCategoryFilter('todos')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
              categoryFilter === 'todos'
                ? 'bg-cyan-600 text-slate-950 font-bold'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            Todos
          </button>
          {(Object.keys(CATEGORY_MAP) as NoteCategory[]).map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                categoryFilter === cat
                  ? 'bg-cyan-600 text-slate-950 font-bold'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {CATEGORY_MAP[cat].label}
            </button>
          ))}
        </div>
      </div>

      {/* Notes List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-slate-500">
            <FileText className="w-12 h-12 mx-auto mb-2 opacity-30 text-cyan-400" />
            <p className="text-sm font-semibold text-slate-400">No se encontraron notas</p>
            <p className="text-xs text-slate-600 mt-1">
              Agrega una nueva nota desde el mapa o presiona "Nueva Nota"
            </p>
          </div>
        ) : (
          filtered.map((note) => {
            const catInfo = CATEGORY_MAP[note.category] || CATEGORY_MAP.general;
            const tCode = getTerritoryCode(note.territoryId);

            return (
              <div
                key={note.id}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-3.5 shadow-md transition flex flex-col gap-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border font-mono ${catInfo.bg} ${catInfo.text} ${catInfo.border}`}>
                        {catInfo.label}
                      </span>
                      {tCode && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-950 text-emerald-400 border border-slate-800 font-mono">
                          {tCode}
                        </span>
                      )}
                      <h4 className="font-bold text-sm text-slate-100">{note.title}</h4>
                    </div>

                    {note.address && (
                      <p className="text-xs text-cyan-300/90 mt-1 flex items-center gap-1 font-medium">
                        <Building className="w-3 h-3 text-cyan-400" />
                        <span>{note.address}</span>
                      </p>
                    )}
                  </div>

                  <span className="text-[10px] font-mono text-slate-500">
                    {new Date(note.createdAt).toLocaleDateString('es-ES')}
                  </span>
                </div>

                {note.description && (
                  <p className="text-xs text-slate-300 bg-slate-950/40 p-2 rounded-xl border border-slate-800/60">
                    {note.description}
                  </p>
                )}

                <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                  <span className="text-[10px] font-mono text-slate-500 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-slate-500" />
                    {formatCoordinate(note.coordinate[0], note.coordinate[1])}
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onSelectNoteOnMap(note)}
                      className="px-2.5 py-1.5 bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-700/60 rounded-xl text-xs font-semibold flex items-center gap-1 transition"
                      title="Ver en el mapa"
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      <span>Ver</span>
                    </button>

                    <button
                      onClick={() => onNavigateToNote(note)}
                      className="px-2.5 py-1.5 bg-fuchsia-950/80 hover:bg-fuchsia-900 text-fuchsia-300 border border-fuchsia-700/60 rounded-xl text-xs font-semibold flex items-center gap-1 transition"
                      title="Navegar a pie hacia esta nota"
                    >
                      <Navigation className="w-3.5 h-3.5" />
                      <span>Navegar</span>
                    </button>

                    <button
                      onClick={() => onEditNote(note)}
                      className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition"
                      title="Editar nota"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>

                    <button
                      id={`btn-delete-note-${note.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteNote(note.id);
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/60 active:scale-90 rounded-lg transition"
                      title="Eliminar nota"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
