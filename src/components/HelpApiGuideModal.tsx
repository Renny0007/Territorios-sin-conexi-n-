import React, { useState } from 'react';
import { 
  X, 
  BookOpen, 
  Map, 
  Footprints, 
  CloudOff, 
  FileCode, 
  Compass, 
  CheckCircle2,
  ChevronRight
} from 'lucide-react';

interface HelpApiGuideModalProps {
  onClose: () => void;
}

export const HelpApiGuideModal: React.FC<HelpApiGuideModalProps> = ({ onClose }) => {
  const [activeSection, setActiveSection] = useState<string>('drawing');

  const sections = [
    {
      id: 'drawing',
      title: '1. Dibujo de Polígonos',
      icon: Map,
      content: (
        <div className="space-y-3 text-xs text-slate-300">
          <p className="font-semibold text-slate-100 text-sm">
            Creación de territorios mediante delimitación poligonal:
          </p>
          <ul className="space-y-2 list-disc list-inside">
            <li>
              En la pestaña <b className="text-emerald-400">Mapa</b>, pulsa el botón flotante <b className="text-slate-100">"Dibujar Polígono"</b>.
            </li>
            <li>
              Toca sobre el mapa para fijar cada uno de los vértices perimetrales del territorio.
            </li>
            <li>
              El sistema calcula en tiempo real el <b className="text-cyan-400">área geodésica (m² o ha)</b> y el <b className="text-amber-400">perímetro</b> exacto.
            </li>
            <li>
              Al colocar al menos 3 vértices, pulsa <b className="text-emerald-400">"Guardar"</b> para asignar código (ej. T-101), responsable, color y estado de cobertura.
            </li>
          </ul>
        </div>
      )
    },
    {
      id: 'gps_walk',
      title: '2. Caminar y Registrar GPS',
      icon: Footprints,
      content: (
        <div className="space-y-3 text-xs text-slate-300">
          <p className="font-semibold text-slate-100 text-sm">
            Trazado de perímetros en campo real:
          </p>
          <ul className="space-y-2 list-disc list-inside">
            <li>
              Activa el GPS en la barra superior asegurando buena señal (<span className="text-emerald-400 font-mono">±3m a ±5m</span>).
            </li>
            <li>
              Selecciona <b className="text-cyan-400">"Caminar Perímetro"</b> en la barra de herramientas de dibujo.
            </li>
            <li>
              Camina a lo largo del límite de la manzana o sector. Puedes pulsar <b className="text-cyan-400">"Fijar Vértice en Mi Posición GPS"</b> en cada esquina o punto de quiebre.
            </li>
            <li>
              Al rodear el territorio por completo, pulsa <b className="text-emerald-400">"Guardar"</b> para registrar el polígono final.
            </li>
          </ul>
        </div>
      )
    },
    {
      id: 'offline_tiles',
      title: '3. Mapas Sin Conexión',
      icon: CloudOff,
      content: (
        <div className="space-y-3 text-xs text-slate-300">
          <p className="font-semibold text-slate-100 text-sm">
            Uso 100% offline en zonas sin cobertura celular:
          </p>
          <ul className="space-y-2 list-disc list-inside">
            <li>
              Accede a la pestaña <b className="text-emerald-400">Offline</b> en el menú inferior.
            </li>
            <li>
              Pulsa <b className="text-slate-100">"Descargar Zona"</b> y selecciona el territorio deseado o la vista urbana actual.
            </li>
            <li>
              Elige el rango de zoom deseado (se recomienda zoom 14 a 17 para detalle peatonal con calles y números).
            </li>
            <li>
              Los mosaicos se guardan en <b className="text-cyan-400">IndexedDB local</b>, garantizando que el mapa se cargue instantáneamente incluso en Modo Avión.
            </li>
          </ul>
        </div>
      )
    },
    {
      id: 'kml_import',
      title: '4. KML y GeoJSON',
      icon: FileCode,
      content: (
        <div className="space-y-3 text-xs text-slate-300">
          <p className="font-semibold text-slate-100 text-sm">
            Interoperabilidad con Google Earth, QGIS y ArcGIS:
          </p>
          <ul className="space-y-2 list-disc list-inside">
            <li>
              <b>Importar:</b> En la pestaña <b className="text-emerald-400">Territorios</b>, pulsa "Importar" y selecciona un archivo <code className="text-cyan-300">.kml</code> o <code className="text-cyan-300">.geojson</code>.
            </li>
            <li>
              <b>Exportar:</b> Pulsa "Exportar" para descargar un paquete KML con los estilos, colores, centroides y etiquetas listos para visualizar en Google Earth.
            </li>
            <li>
              <b>Copia Completa:</b> En "Ajustes" puedes descargar una copia JSON con todos los territorios, notas y configuraciones.
            </li>
          </ul>
        </div>
      )
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-4 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-emerald-400" />
            <h3 className="font-bold text-sm text-slate-100 uppercase tracking-wide">
              Manual y Guía de Operación
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Tabs */}
        <div className="flex border-b border-slate-800 overflow-x-auto bg-slate-950/40 p-1">
          {sections.map((sec) => (
            <button
              key={sec.id}
              onClick={() => setActiveSection(sec.id)}
              className={`px-3 py-2 text-xs font-semibold rounded-xl whitespace-nowrap transition flex items-center gap-1.5 ${
                activeSection === sec.id
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/50'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <sec.icon className="w-3.5 h-3.5" />
              <span>{sec.title}</span>
            </button>
          ))}
        </div>

        {/* Active Section Body */}
        <div className="p-4 overflow-y-auto flex-1 bg-slate-900">
          {sections.find((s) => s.id === activeSection)?.content}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-slate-950/60 border-t border-slate-800 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold rounded-xl text-xs transition"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
