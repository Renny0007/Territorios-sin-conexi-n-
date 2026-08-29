import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { 
  Territory, 
  MapNote, 
  GPSState, 
  ActiveRoute, 
  DrawingToolMode, 
  MapProviderId,
  MapLabel
} from '../types';
import { MAP_PROVIDERS, getTileStorageKey } from '../services/tileManager';
import { dbService } from '../services/db';
import { formatArea, formatDistance, calculateDistance, getTerritoryDisplayCode } from '../services/geoUtils';
import { 
  Navigation, 
  Maximize2, 
  Layers, 
  PlusCircle, 
  Type
} from 'lucide-react';

interface MapComponentProps {
  territories: Territory[];
  notes: MapNote[];
  labels: MapLabel[];
  selectedTerritoryId: string | null;
  isAdminUnlocked?: boolean;
  onSelectTerritory: (territory: Territory) => void;
  onSelectNote: (note: MapNote) => void;
  onAddLabel: (coord: [number, number]) => void;
  onUpdateLabel: (label: MapLabel) => void;
  onDeleteLabel: (id: string) => void;
  gpsState: GPSState;
  activeRoute: ActiveRoute | null;
  drawingMode: DrawingToolMode;
  onSetDrawingMode?: (mode: DrawingToolMode) => void;
  onOpenLetterModal?: () => void;
  drawingVertices: [number, number][];
  onAddDrawingVertex: (coord: [number, number]) => void;
  onAddNoteAtCenter: (coord: [number, number]) => void;
  mapProvider: MapProviderId;
  onChangeProvider: (provider: MapProviderId) => void;
  autoCenterGps: boolean;
  onToggleAutoCenter: () => void;
  centerGpsTrigger?: number;
  onRequestActivateGps?: () => void;
}

export const MapComponent: React.FC<MapComponentProps> = ({
  territories,
  notes,
  labels,
  selectedTerritoryId,
  isAdminUnlocked = false,
  onSelectTerritory,
  onSelectNote,
  onAddLabel,
  onUpdateLabel,
  onDeleteLabel,
  gpsState,
  activeRoute,
  drawingMode,
  onSetDrawingMode,
  onOpenLetterModal,
  drawingVertices,
  onAddDrawingVertex,
  onAddNoteAtCenter,
  mapProvider,
  onChangeProvider,
  autoCenterGps,
  onToggleAutoCenter,
  centerGpsTrigger,
  onRequestActivateGps
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const pendingCenterRef = useRef<boolean>(false);

  // Layer groups
  const territoriesLayerRef = useRef<L.FeatureGroup | null>(null);
  const notesLayerRef = useRef<L.FeatureGroup | null>(null);
  const labelsLayerRef = useRef<L.FeatureGroup | null>(null);
  const drawingLayerRef = useRef<L.FeatureGroup | null>(null);
  const gpsLayerRef = useRef<L.FeatureGroup | null>(null);
  const routeLayerRef = useRef<L.FeatureGroup | null>(null);

  const [showLayerMenu, setShowLayerMenu] = React.useState<boolean>(false);
  const [mapCenterCoord, setMapCenterCoord] = React.useState<[number, number]>([18.48517, -69.30083]);

  // Refs for event handlers in Leaflet callbacks
  const drawingModeRef = useRef(drawingMode);
  drawingModeRef.current = drawingMode;
  const onAddDrawingVertexRef = useRef(onAddDrawingVertex);
  onAddDrawingVertexRef.current = onAddDrawingVertex;
  const onAddLabelRef = useRef(onAddLabel);
  onAddLabelRef.current = onAddLabel;
  const onUpdateLabelRef = useRef(onUpdateLabel);
  onUpdateLabelRef.current = onUpdateLabel;
  const onDeleteLabelRef = useRef(onDeleteLabel);
  onDeleteLabelRef.current = onDeleteLabel;

  // 1. Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Default center: Naime Etapa 2, San Pedro de Macorís, República Dominicana
    const initialCenter: [number, number] = [18.48517, -69.30083];
    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: 16,
      zoomControl: false,
      attributionControl: true
    });

    // Custom zoom control in bottom-left
    L.control.zoom({ position: 'bottomleft' }).addTo(map);

    // Create high-priority pane for the selected territory so its borders always sit above adjacent polygons
    const selectedPane = map.createPane('selectedTerritoryPane');
    selectedPane.style.zIndex = '480';

    // Initialize layer groups
    territoriesLayerRef.current = L.featureGroup().addTo(map);
    labelsLayerRef.current = L.featureGroup().addTo(map);
    notesLayerRef.current = L.featureGroup().addTo(map);
    drawingLayerRef.current = L.featureGroup().addTo(map);
    gpsLayerRef.current = L.featureGroup().addTo(map);
    routeLayerRef.current = L.featureGroup().addTo(map);

    mapRef.current = map;

    // Map events
    map.on('move', () => {
      const c = map.getCenter();
      setMapCenterCoord([c.lat, c.lng]);
    });

    // Cancel any pending programmatic centering as soon as the user drags or zooms
    map.on('dragstart movestart zoomstart', () => {
      pendingCenterRef.current = false;
    });

    // Map click for drawing vertices or placing letter labels
    map.on('click', (e: L.LeafletMouseEvent) => {
      if (drawingModeRef.current === 'letter') {
        onAddLabelRef.current([e.latlng.lat, e.latlng.lng]);
      } else if (drawingModeRef.current !== 'none') {
        onAddDrawingVertexRef.current([e.latlng.lat, e.latlng.lng]);
      }
    });

    // ResizeObserver for reliable responsive canvas
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(mapContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // 2. Setup TileLayer with Offline DB Interceptor
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    const providerConfig = MAP_PROVIDERS[mapProvider] || MAP_PROVIDERS.carto_dark;

    // Custom Tile Layer class with IndexedDB offline support
    const CustomOfflineTileLayer = L.TileLayer.extend({
      createTile(coords: { x: number; y: number; z: number }, done: (error: any, tile: HTMLImageElement) => void) {
        const tile = document.createElement('img');
        tile.setAttribute('role', 'presentation');

        const key = getTileStorageKey(mapProvider, coords.x, coords.y, coords.z);

        // First attempt: Check IndexedDB offline tile cache
        dbService.getTile(key).then((cached) => {
          if (cached && cached.dataUrl) {
            tile.src = cached.dataUrl;
            tile.onload = () => done(null, tile);
            tile.onerror = () => {
              // Fallback to online url if cached data is corrupt
              const onlineUrl = (this as any).getTileUrl(coords);
              tile.src = onlineUrl;
            };
          } else {
            // Not in DB: fetch directly from map provider
            const onlineUrl = (this as any).getTileUrl(coords);
            tile.src = onlineUrl;
            tile.onload = () => done(null, tile);
            tile.onerror = (e) => done(e, tile);
          }
        }).catch(() => {
          const onlineUrl = (this as any).getTileUrl(coords);
          tile.src = onlineUrl;
          tile.onload = () => done(null, tile);
          tile.onerror = (e) => done(e, tile);
        });

        return tile;
      }
    });

    const newLayer = new (CustomOfflineTileLayer as any)(providerConfig.url, {
      subdomains: providerConfig.subdomains || ['a', 'b', 'c'],
      maxZoom: providerConfig.maxZoom,
      attribution: providerConfig.attribution
    });

    newLayer.addTo(map);
    tileLayerRef.current = newLayer;
  }, [mapProvider]);

  // 3. Render Territories Polygons
  useEffect(() => {
    const layer = territoriesLayerRef.current;
    if (!layer) return;

    layer.clearLayers();

    // Sort territories so unselected are drawn first, and the selected territory is drawn last on top
    const sortedTerritories = [...territories].sort((a, b) => {
      if (a.id === selectedTerritoryId) return 1;
      if (b.id === selectedTerritoryId) return -1;
      return 0;
    });

    sortedTerritories.forEach((territory) => {
      if (territory.coordinates.length < 3) return;

      const isSelected = territory.id === selectedTerritoryId;
      const baseColor = territory.color || '#10b981';

      // Status fill color modifier
      let fillColor = baseColor;
      if (territory.status === 'completado') fillColor = '#059669';
      if (territory.status === 'pendiente') fillColor = '#d97706';
      if (territory.status === 'en_progreso') fillColor = '#2563eb';

      const polygon = L.polygon(territory.coordinates, {
        pane: isSelected ? 'selectedTerritoryPane' : 'overlayPane',
        color: isSelected ? '#ea580c' : baseColor, // Vivid Mamei / Orange border on selection
        weight: isSelected ? 5 : 2.5,
        opacity: 1,
        lineJoin: 'round',
        lineCap: 'round',
        fillColor,
        fillOpacity: isSelected ? 0.35 : 0.25,
        dashArray: territory.status === 'pendiente' ? '6, 6' : undefined
      });

      const displayCode = getTerritoryDisplayCode(territory);

      // Tactical Tooltip / Label
      polygon.bindTooltip(
        `<div class="tactical-tooltip text-center">
          <div class="text-[11px] font-black uppercase text-emerald-300 font-mono tracking-wider">${displayCode}</div>
          <div class="text-xs font-semibold text-slate-100">${territory.name}</div>
          <div class="text-[10px] text-slate-300 font-mono mt-0.5">${formatArea(territory.areaM2)}</div>
        </div>`,
        { permanent: false, direction: 'center', opacity: 0.95 }
      );

      // Centroid permanent badge marker encompassing full number and parentheses
      if (territory.centroid) {
        const badgeIcon = L.divIcon({
          className: 'tactical-badge',
          html: `<div class="tactical-badge-inner ${isSelected ? 'selected' : ''}" title="${territory.code} - ${territory.name}">
                  <span>${displayCode}</span>
                </div>`,
          iconSize: [0, 0]
        });
        const badgeMarker = L.marker(territory.centroid, { 
          icon: badgeIcon, 
          interactive: true,
          pane: isSelected ? 'selectedTerritoryPane' : 'markerPane',
          zIndexOffset: isSelected ? 1000 : 0
        });
        badgeMarker.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          onSelectTerritory(territory);
        });
        layer.addLayer(badgeMarker);
      }

      polygon.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        onSelectTerritory(territory);
      });

      layer.addLayer(polygon);

      if (isSelected) {
        polygon.bringToFront();
      }
    });
  }, [territories, selectedTerritoryId, onSelectTerritory]);

  // 4. Render Field Notes
  useEffect(() => {
    const layer = notesLayerRef.current;
    if (!layer) return;

    layer.clearLayers();

    notes.forEach((note) => {
      const catColors: Record<string, { bg: string; border: string; label: string }> = {
        visita: { bg: '#10b981', border: '#047857', label: 'V' },
        no_en_casa: { bg: '#f59e0b', border: '#b45309', label: 'NC' },
        impedimento: { bg: '#ef4444', border: '#b91c1c', label: 'X' },
        revisitar: { bg: '#3b82f6', border: '#1d4ed8', label: 'R' },
        peligro: { bg: '#dc2626', border: '#7f1d1d', label: '!' },
        general: { bg: '#8b5cf6', border: '#6d28d9', label: 'N' }
      };

      const style = catColors[note.category] || catColors.general;

      const noteIcon = L.divIcon({
        className: 'tactical-marker-pin',
        html: `<div class="w-6 h-6 rounded-full flex items-center justify-center text-slate-950 font-black text-[10px] font-mono border-2 shadow-lg cursor-pointer transform -translate-x-1/2 -translate-y-1/2" 
                    style="background-color: ${style.bg}; border-color: ${style.border};">
                ${style.label}
              </div>`,
        iconSize: [0, 0]
      });

      const marker = L.marker(note.coordinate, { icon: noteIcon });

      marker.bindTooltip(
        `<div class="tactical-tooltip">
          <div class="text-xs font-bold text-slate-100">${note.title}</div>
          <div class="text-[10px] text-slate-300 capitalize">${note.category.replace('_', ' ')}</div>
          ${note.address ? `<div class="text-[10px] text-cyan-300 truncate">${note.address}</div>` : ''}
        </div>`,
        { direction: 'top', offset: [0, -10] }
      );

      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        onSelectNote(note);
      });

      layer.addLayer(marker);
    });
  }, [notes, onSelectNote]);

  // 4b. Render Georeferenced Map Letter Labels
  useEffect(() => {
    const layer = labelsLayerRef.current;
    if (!layer) return;

    layer.clearLayers();

    labels.forEach((label) => {
      const sizeClass = `size-${label.fontSize || 'md'}`;
      const customColor = label.color || '#fbbf24';

      const labelIcon = L.divIcon({
        className: 'map-letter-icon',
        html: `<div class="map-letter-badge ${sizeClass}" style="color: ${customColor}; border-color: ${customColor};" title="Letra ${label.text} (Arrastra para mover)">
                <span>${label.text}</span>
              </div>`,
        iconSize: [0, 0]
      });

      const marker = L.marker([label.lat, label.lng], {
        icon: labelIcon,
        draggable: isAdminUnlocked,
        zIndexOffset: 700
      });

      // Draggable event -> updates geographical coords immediately
      if (isAdminUnlocked) {
        marker.on('dragend', (e: any) => {
          const newPos = e.target.getLatLng();
          onUpdateLabelRef.current({
            ...label,
            lat: newPos.lat,
            lng: newPos.lng,
            updatedAt: Date.now()
          });
        });
      }

      // Popup with options: Edit text, change size, and delete (Admin) or Read-only (Normal)
      const popupDiv = document.createElement('div');
      popupDiv.className = 'flex flex-col gap-2 p-1 min-w-[200px] text-slate-100';

      if (isAdminUnlocked) {
        popupDiv.innerHTML = `
          <div class="flex items-center justify-between pb-1.5 border-b border-slate-700">
            <div class="flex items-center gap-1.5">
              <span class="font-mono font-black text-amber-400 text-lg">${label.text}</span>
              <span class="text-[11px] text-slate-300 font-semibold">Etiqueta de Mapa</span>
            </div>
            <span class="text-[10px] text-emerald-400 font-mono">🔓 Edición</span>
          </div>

          <div class="flex items-center gap-1.5 mt-1">
            <input 
              type="text" 
              id="popup-input-${label.id}" 
              value="${label.text}" 
              maxlength="10" 
              class="bg-slate-900 border border-slate-700 text-amber-300 font-bold font-mono text-sm px-2 py-1 rounded-lg w-20 focus:outline-none focus:border-amber-400"
            />
            <button 
              id="popup-btn-save-${label.id}" 
              class="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs px-2.5 py-1.5 rounded-lg shadow transition active:scale-95 text-center"
            >
              Guardar
            </button>
          </div>

          <div class="flex items-center justify-between pt-1">
            <div class="flex items-center gap-1 text-[10px] text-slate-400">
              <span>Tamaño:</span>
              <button id="popup-sz-sm-${label.id}" class="px-1.5 py-0.5 rounded text-[10px] ${label.fontSize === 'sm' ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}">S</button>
              <button id="popup-sz-md-${label.id}" class="px-1.5 py-0.5 rounded text-[10px] ${label.fontSize === 'md' || !label.fontSize ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}">M</button>
              <button id="popup-sz-lg-${label.id}" class="px-1.5 py-0.5 rounded text-[10px] ${label.fontSize === 'lg' ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}">L</button>
              <button id="popup-sz-xl-${label.id}" class="px-1.5 py-0.5 rounded text-[10px] ${label.fontSize === 'xl' ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}">XL</button>
            </div>
          </div>

          <div class="flex items-center justify-between pt-1 border-t border-slate-800 text-[11px]">
            <span class="text-[10px] text-slate-400">↔ Arrastra para mover</span>
            <button 
              id="popup-btn-del-${label.id}" 
              class="text-rose-400 hover:text-rose-300 hover:underline font-bold text-xs"
            >
              Eliminar
            </button>
          </div>
        `;
      } else {
        popupDiv.innerHTML = `
          <div class="flex items-center justify-between pb-1.5 border-b border-slate-700">
            <div class="flex items-center gap-1.5">
              <span class="font-mono font-black text-amber-400 text-lg">${label.text}</span>
              <span class="text-[11px] text-slate-300 font-semibold">Etiqueta de Mapa</span>
            </div>
            <span class="text-[10px] text-amber-400 font-mono">🔒 Protegido</span>
          </div>
          <p class="text-xs text-slate-400 mt-1">
            Letra fijada en coordenadas: [${label.lat.toFixed(5)}, ${label.lng.toFixed(5)}].
          </p>
          <div class="pt-1.5 border-t border-slate-800 text-[10px] text-slate-500">
            Desbloquea en Configuración para editar o mover.
          </div>
        `;
      }

      marker.bindPopup(popupDiv, { maxWidth: 260 });

      marker.on('popupopen', () => {
        const inputEl = document.getElementById(`popup-input-${label.id}`) as HTMLInputElement;
        const saveBtn = document.getElementById(`popup-btn-save-${label.id}`);
        const delBtn = document.getElementById(`popup-btn-del-${label.id}`);
        const szSm = document.getElementById(`popup-sz-sm-${label.id}`);
        const szMd = document.getElementById(`popup-sz-md-${label.id}`);
        const szLg = document.getElementById(`popup-sz-lg-${label.id}`);
        const szXl = document.getElementById(`popup-sz-xl-${label.id}`);

        if (saveBtn && inputEl) {
          saveBtn.onclick = () => {
            const val = inputEl.value.trim().toUpperCase();
            if (val) {
              onUpdateLabelRef.current({ ...label, text: val, updatedAt: Date.now() });
              marker.closePopup();
            }
          };
          inputEl.onkeydown = (e) => {
            if (e.key === 'Enter') {
              const val = inputEl.value.trim().toUpperCase();
              if (val) {
                onUpdateLabelRef.current({ ...label, text: val, updatedAt: Date.now() });
                marker.closePopup();
              }
            }
          };
        }

        if (delBtn) {
          delBtn.onclick = () => {
            onDeleteLabelRef.current(label.id);
            marker.closePopup();
          };
        }

        const handleSizeChange = (newSize: 'sm' | 'md' | 'lg' | 'xl') => {
          onUpdateLabelRef.current({ ...label, fontSize: newSize, updatedAt: Date.now() });
          marker.closePopup();
        };

        if (szSm) szSm.onclick = () => handleSizeChange('sm');
        if (szMd) szMd.onclick = () => handleSizeChange('md');
        if (szLg) szLg.onclick = () => handleSizeChange('lg');
        if (szXl) szXl.onclick = () => handleSizeChange('xl');
      });

      layer.addLayer(marker);
    });
  }, [labels]);

  // 5. Render Drawing Layer (Vertices & Polygon in progress + GPS connecting line)
  useEffect(() => {
    const layer = drawingLayerRef.current;
    if (!layer) return;

    layer.clearLayers();

    if (drawingVertices.length > 0) {
      // Draw line between vertices
      const line = L.polyline(drawingVertices, {
        color: '#38bdf8',
        weight: 3,
        dashArray: '4, 6',
        opacity: 0.9
      });
      layer.addLayer(line);

      // If at least 3 vertices, draw semi-transparent closed preview
      if (drawingVertices.length >= 3) {
        const previewPoly = L.polygon(drawingVertices, {
          color: '#38bdf8',
          weight: 2,
          fillColor: '#0284c7',
          fillOpacity: 0.25,
          dashArray: '6, 6'
        });
        layer.addLayer(previewPoly);
      }

      // Draw numbered vertex dots
      drawingVertices.forEach((coord, idx) => {
        const isFirst = idx === 0;
        const vertexIcon = L.divIcon({
          className: 'drawing-vertex',
          html: `<div class="w-5 h-5 rounded-full ${
            isFirst ? 'bg-emerald-400 border-2 border-white' : 'bg-cyan-400 border border-slate-900'
          } flex items-center justify-center text-slate-950 font-bold text-[10px] shadow transform -translate-x-1/2 -translate-y-1/2 cursor-pointer">
                  ${idx + 1}
                </div>`,
          iconSize: [0, 0]
        });

        const vertexMarker = L.marker(coord, { icon: vertexIcon });
        layer.addLayer(vertexMarker);
      });
    }

    // Dynamic GPS connection line to the polygon being drawn (when drawingVertices.length > 0 and GPS active)
    if (gpsState.active && gpsState.latitude !== null && gpsState.longitude !== null && drawingVertices.length > 0) {
      const gpsCoord: [number, number] = [gpsState.latitude, gpsState.longitude];
      const lastVertex = drawingVertices[drawingVertices.length - 1];
      const dist = calculateDistance(gpsCoord, lastVertex);

      // Active tether line connecting GPS to the last vertex
      const tetherLine = L.polyline([gpsCoord, lastVertex], {
        color: '#06b6d4',
        weight: 3.5,
        dashArray: '6, 8',
        opacity: 0.95
      });
      layer.addLayer(tetherLine);

      // Floating badge displaying distance from GPS to polygon
      const midpoint: [number, number] = [
        (gpsCoord[0] + lastVertex[0]) / 2,
        (gpsCoord[1] + lastVertex[1]) / 2
      ];
      const badgeIcon = L.divIcon({
        className: 'gps-tether-badge',
        html: `<div class="bg-slate-950/95 text-cyan-300 border border-cyan-400/80 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold shadow-xl whitespace-nowrap transform -translate-x-1/2 -translate-y-1/2 flex items-center gap-1">
                <span>📍 GPS ➔ ${formatDistance(dist)}</span>
              </div>`,
        iconSize: [0, 0]
      });
      const badgeMarker = L.marker(midpoint, { icon: badgeIcon, interactive: false });
      layer.addLayer(badgeMarker);

      // If >= 2 vertices, also draw a subtle closing guide back to first vertex
      if (drawingVertices.length >= 2) {
        const closingGuide = L.polyline([gpsCoord, drawingVertices[0]], {
          color: '#38bdf8',
          weight: 1.5,
          dashArray: '3, 6',
          opacity: 0.5
        });
        layer.addLayer(closingGuide);
      }
    }
  }, [drawingVertices, drawingMode, gpsState]);

  // 6. Render GPS Marker & Accuracy Circle
  useEffect(() => {
    const layer = gpsLayerRef.current;
    if (!layer) return;

    layer.clearLayers();

    if (gpsState.active && gpsState.latitude !== null && gpsState.longitude !== null) {
      const gpsCoord: [number, number] = [gpsState.latitude, gpsState.longitude];

      // Accuracy circle
      if (gpsState.accuracy !== null && gpsState.accuracy > 0) {
        const circle = L.circle(gpsCoord, {
          radius: gpsState.accuracy,
          color: '#38bdf8',
          weight: 1.5,
          opacity: 0.6,
          fillColor: '#0284c7',
          fillOpacity: 0.12
        });
        layer.addLayer(circle);
      }

      // GPS Position Dot with Pulse and Heading Cone
      const hasHeading = gpsState.heading !== null;
      const headingDeg = gpsState.heading || 0;

      const gpsIcon = L.divIcon({
        className: 'gps-marker-container',
        html: `<div class="relative w-8 h-8 flex items-center justify-center transform -translate-x-1/2 -translate-y-1/2 cursor-pointer">
                ${hasHeading ? `
                  <div class="absolute -top-3.5 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[12px] border-b-cyan-400 transform origin-bottom" style="transform: rotate(${headingDeg}deg)"></div>
                ` : ''}
                <div class="w-4 h-4 rounded-full bg-cyan-400 border-2 border-white shadow-lg gps-glow-pulse flex items-center justify-center">
                  <div class="w-1.5 h-1.5 rounded-full bg-slate-950"></div>
                </div>
              </div>`,
        iconSize: [0, 0]
      });

      const gpsMarker = L.marker(gpsCoord, { icon: gpsIcon, zIndexOffset: 1000 });
      gpsMarker.bindTooltip(
        `<div class="tactical-tooltip text-center">
          <div class="text-[11px] font-bold text-cyan-300 font-mono">📍 Mi Ubicación</div>
          ${gpsState.accuracy ? `<div class="text-[10px] text-slate-300 font-mono">Precisión: ±${Math.round(gpsState.accuracy)}m</div>` : ''}
          ${gpsState.speed !== null && gpsState.speed > 0 ? `<div class="text-[10px] text-emerald-300 font-mono">Velocidad: ${(gpsState.speed * 3.6).toFixed(1)} km/h</div>` : ''}
        </div>`,
        { direction: 'top', offset: [0, -14] }
      );

      gpsMarker.on('click', () => {
        if (mapRef.current) {
          mapRef.current.flyTo(gpsCoord, 17, { animate: true, duration: 0.8 });
        }
      });

      layer.addLayer(gpsMarker);
    }
  }, [gpsState]);

  // Handle explicit centerGpsTrigger (single-shot center on button click)
  useEffect(() => {
    if (!centerGpsTrigger) return;
    if (gpsState.active && gpsState.latitude !== null && gpsState.longitude !== null && mapRef.current) {
      mapRef.current.flyTo([gpsState.latitude, gpsState.longitude], 17, { animate: true, duration: 1.0 });
      pendingCenterRef.current = false;
    } else {
      pendingCenterRef.current = true;
    }
  }, [centerGpsTrigger]);

  // When GPS coords arrive for a pending single-shot center request, center once and immediately disable pending
  useEffect(() => {
    if (pendingCenterRef.current && mapRef.current && gpsState.latitude !== null && gpsState.longitude !== null) {
      mapRef.current.flyTo([gpsState.latitude, gpsState.longitude], 17, { animate: true, duration: 1.0 });
      pendingCenterRef.current = false;
    }
  }, [gpsState.latitude, gpsState.longitude]);

  // 7. Render Active Pedestrian Navigation Route
  useEffect(() => {
    const layer = routeLayerRef.current;
    if (!layer) return;

    layer.clearLayers();

    if (activeRoute && activeRoute.polyline.length > 0) {
      // 1. High-contrast dual stroke line (outer border + bright core)
      const outerGlow = L.polyline(activeRoute.polyline, {
        color: '#3b0764',
        weight: 9,
        opacity: 0.8,
        lineCap: 'round',
        lineJoin: 'round'
      });
      layer.addLayer(outerGlow);

      const innerNeon = L.polyline(activeRoute.polyline, {
        color: '#c084fc',
        weight: 5,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round'
      });
      layer.addLayer(innerNeon);

      // 2. Destination access point marker
      const destIcon = L.divIcon({
        className: 'dest-marker',
        html: `<div class="flex items-center gap-1.5 transform -translate-x-1/2 -translate-y-1/2">
                <div class="p-2 rounded-full bg-fuchsia-600 text-white shadow-2xl border-2 border-white animate-bounce flex items-center justify-center">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                </div>
                <div class="hidden sm:flex bg-slate-950/95 text-fuchsia-300 border border-fuchsia-400/70 text-[11px] font-bold px-2 py-0.5 rounded-full shadow-lg whitespace-nowrap">
                  Acceso al Territorio
                </div>
              </div>`,
        iconSize: [0, 0]
      });

      const destMarker = L.marker(activeRoute.destination, { icon: destIcon, zIndexOffset: 800 });
      destMarker.bindTooltip(
        `<div class="tactical-tooltip text-center">
          <div class="text-xs font-bold text-fuchsia-300">Punto de Acceso Peatonal</div>
          <div class="text-[11px] text-slate-200">${activeRoute.targetName}</div>
        </div>`,
        { direction: 'top', offset: [0, -12] }
      );
      layer.addLayer(destMarker);

      // 3. Smoothly fit map view to show both starting point and entire walking route
      if (mapRef.current) {
        const bounds = L.latLngBounds(activeRoute.polyline);
        mapRef.current.fitBounds(bounds, {
          padding: [50, 50],
          maxZoom: 17,
          animate: true
        });
      }
    }
  }, [activeRoute]);

  // Handler to fit all territories bounds
  const handleFitTerritories = () => {
    if (!mapRef.current || territories.length === 0) return;
    const allCoords: [number, number][] = [];
    territories.forEach(t => t.coordinates.forEach(c => allCoords.push(c)));
    if (allCoords.length > 0) {
      const bounds = L.latLngBounds(allCoords);
      mapRef.current.fitBounds(bounds, { padding: [40, 40], animate: true });
    }
  };

  // Handler to center on GPS position
  const handleRecenterGps = () => {
    if (!gpsState.active) {
      if (onRequestActivateGps) {
        onRequestActivateGps();
      }
      pendingCenterRef.current = true;
      return;
    }
    if (gpsState.latitude !== null && gpsState.longitude !== null && mapRef.current) {
      mapRef.current.flyTo([gpsState.latitude, gpsState.longitude], 17, { animate: true, duration: 1.2 });
      pendingCenterRef.current = false;
    } else {
      pendingCenterRef.current = true;
    }
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-slate-950">
      {/* Leaflet Canvas Container */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Top Floating Control Bar */}
      <div className="absolute top-3 left-3 z-20 flex items-center gap-2">
        {/* Layer Switcher Button */}
        <div className="relative">
          <button
            id="btn-map-layers"
            onClick={() => setShowLayerMenu(!showLayerMenu)}
            className="flex items-center gap-1.5 bg-slate-900/90 hover:bg-slate-800 text-slate-100 px-3 py-2 rounded-xl text-xs font-semibold border border-slate-700 shadow-lg backdrop-blur transition active:scale-95"
            title="Cambiar capa de mapa base"
          >
            <Layers className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">{MAP_PROVIDERS[mapProvider]?.name || 'Capa'}</span>
          </button>

          {showLayerMenu && (
            <div className="absolute top-11 left-0 w-52 bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-xl shadow-2xl p-1.5 z-30 flex flex-col gap-1">
              <span className="text-[10px] uppercase font-mono text-slate-400 px-2 py-1">Proveedor de Mapa</span>
              {(Object.keys(MAP_PROVIDERS) as MapProviderId[]).map((pid) => (
                <button
                  key={pid}
                  onClick={() => {
                    onChangeProvider(pid);
                    setShowLayerMenu(false);
                  }}
                  className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs text-left transition ${
                    mapProvider === pid
                      ? 'bg-emerald-950 text-emerald-300 font-bold border border-emerald-500/40'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <span>{MAP_PROVIDERS[pid].name}</span>
                  {mapProvider === pid && <span className="w-2 h-2 rounded-full bg-emerald-400" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Quick Add Note at Map Center */}
        <button
          id="btn-add-note-at-crosshair"
          onClick={() => onAddNoteAtCenter(mapCenterCoord)}
          className="flex items-center gap-1.5 bg-slate-900/90 hover:bg-slate-800 text-slate-100 px-3 py-2 rounded-xl text-xs font-semibold border border-slate-700 shadow-lg backdrop-blur transition active:scale-95"
          title="Agregar nota en el centro de la pantalla"
        >
          <PlusCircle className="w-4 h-4 text-cyan-400" />
          <span className="hidden sm:inline">Nota Aquí</span>
        </button>

        {/* Quick Letter Tool Button in Top Bar */}
        {(onOpenLetterModal || onSetDrawingMode) && (
          <button
            id="btn-top-add-letter"
            onClick={onOpenLetterModal || (() => onSetDrawingMode && onSetDrawingMode(drawingMode === 'letter' ? 'none' : 'letter'))}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold shadow-lg backdrop-blur transition active:scale-95 ${
              drawingMode === 'letter'
                ? 'bg-amber-400 text-slate-950 ring-2 ring-amber-300'
                : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/50'
            }`}
            title="Agregar letra o etiqueta en el mapa"
          >
            <Type className="w-4 h-4 text-amber-400" />
            <span>+ Letra</span>
          </button>
        )}
      </div>

      {/* Right Floating Quick Tools */}
      <div className="absolute top-3 right-3 z-20 flex flex-col gap-2">
        {/* Recenter on GPS button */}
        <button
          id="btn-recenter-gps"
          onClick={handleRecenterGps}
          className={`p-2.5 rounded-xl border shadow-lg backdrop-blur transition active:scale-95 flex items-center justify-center ${
            gpsState.active && gpsState.latitude !== null
              ? 'bg-slate-900/90 text-cyan-400 border-slate-700 hover:bg-slate-800 hover:border-cyan-500'
              : 'bg-slate-900/90 text-slate-400 border-slate-700 hover:text-cyan-300 hover:bg-slate-800'
          }`}
          title={
            gpsState.active && gpsState.latitude !== null
              ? 'Centrar mapa en mi ubicación actual'
              : 'Activar GPS y centrar en mi ubicación'
          }
        >
          <Navigation className={`w-5 h-5 ${gpsState.active ? 'fill-cyan-400/30 text-cyan-400' : 'text-slate-400'}`} />
        </button>

        {/* Fit all territories button */}
        {territories.length > 0 && (
          <button
            id="btn-fit-territories"
            onClick={handleFitTerritories}
            className="p-2.5 bg-slate-900/90 hover:bg-slate-800 text-emerald-400 rounded-xl border border-slate-700 shadow-lg backdrop-blur transition active:scale-95"
            title="Ajustar vista a todos los territorios"
          >
            <Maximize2 className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
};
