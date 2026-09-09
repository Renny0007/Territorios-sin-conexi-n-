import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Territory, 
  MapNote, 
  TilePackage, 
  GPSState, 
  ActiveRoute, 
  DrawingToolMode, 
  ActiveTab, 
  AppSettings,
  MapProviderId,
  MapLabel,
  LabelFontSize
} from './types';
import { dbService, DEFAULT_SETTINGS } from './services/db';
import { gpsService } from './services/gpsService';
import { calculatePedestrianRoute } from './services/routingService';
import { tileManager } from './services/tileManager';
import { swUpdateManager } from './services/swUpdateManager';
import { 
  calculatePolygonArea, 
  calculatePolygonPerimeter, 
  calculateCentroid, 
  calculateDistance,
  calculateOptimalAccessPoint
} from './services/geoUtils';

// UI Components
import { AndroidHeader } from './components/AndroidHeader';
import { BottomNavBar } from './components/BottomNavBar';
import { MapComponent } from './components/MapComponent';
import { DrawingControls } from './components/DrawingControls';
import { TerritoryEditModal } from './components/TerritoryEditModal';
import { TerritoriesListView } from './components/TerritoriesListView';
import { NoteEditModal } from './components/NoteEditModal';
import { NotesListView } from './components/NotesListView';
import { OfflineMapsView } from './components/OfflineMapsView';
import { SettingsModal } from './components/SettingsModal';
import { HelpApiGuideModal } from './components/HelpApiGuideModal';
import { LocationPermissionModal } from './components/LocationPermissionModal';
import { UpdateNotificationBanner } from './components/UpdateNotificationBanner';
import { LetterModal } from './components/LetterModal';
import { BiometricPromptModal } from './components/BiometricPromptModal';
import { InstallPwaModal } from './components/InstallPwaModal';
import { DatabaseSyncModal } from './components/DatabaseSyncModal';
import { biometricAuthService } from './services/biometricAuth';

export default function App() {
  // Navigation & View State
  const [activeTab, setActiveTab] = useState<ActiveTab>('map');
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  // Biometric / Admin Protection State (Always locked on fresh startup)
  const [isAdminUnlocked, setIsAdminUnlocked] = useState<boolean>(false);
  const [isBiometricSupported, setIsBiometricSupported] = useState<boolean>(true);
  const [showBiometricModal, setShowBiometricModal] = useState<boolean>(false);

  // PWA Installation state
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallModal, setShowInstallModal] = useState<boolean>(false);
  const [isStandalone, setIsStandalone] = useState<boolean>(false);

  // Core Data State
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [notes, setNotes] = useState<MapNote[]>([]);
  const [labels, setLabels] = useState<MapLabel[]>([]);
  const [tilePackages, setTilePackages] = useState<TilePackage[]>([]);
  const [selectedTerritoryId, setSelectedTerritoryId] = useState<string | null>(null);

  // Letter placement mode state
  const [activeLetterText, setActiveLetterText] = useState<string>('A');
  const [activeLetterSize, setActiveLetterSize] = useState<LabelFontSize>('md');
  const [showLetterModal, setShowLetterModal] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((current) => (current === msg ? null : current));
    }, 3500);
  };

  // GPS State
  const [gpsState, setGpsState] = useState<GPSState>(gpsService.getState());
  const [centerGpsTrigger, setCenterGpsTrigger] = useState<number>(0);

  // Pedestrian Navigation Route
  const [activeRoute, setActiveRoute] = useState<ActiveRoute | null>(null);

  // Drawing Toolbar State
  const [drawingMode, setDrawingMode] = useState<DrawingToolMode>('none');
  const [drawingVertices, setDrawingVertices] = useState<[number, number][]>([]);

  // Modals & Banners State
  const [editingTerritory, setEditingTerritory] = useState<Partial<Territory> | null>(null);
  const [editingNote, setEditingNote] = useState<Partial<MapNote> | null>(null);
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);
  const [showPermissionModal, setShowPermissionModal] = useState<boolean>(false);
  const [showUpdateBanner, setShowUpdateBanner] = useState<boolean>(false);
  const [showDatabaseSyncModal, setShowDatabaseSyncModal] = useState<boolean>(false);
  const [isUpdatingDatabase, setIsUpdatingDatabase] = useState<boolean>(false);

  // Active Tile Download state
  const [activeDownload, setActiveDownload] = useState<{
    packageId: string;
    downloaded: number;
    total: number;
  } | null>(null);

  // 1. Initialize PWA & Load Data from IndexedDB
  useEffect(() => {
    swUpdateManager.init();
    const unsubUpdate = swUpdateManager.onUpdate((hasUpdate) => {
      if (hasUpdate) setShowUpdateBanner(true);
    });

    const unsubGps = gpsService.subscribe((state) => {
      setGpsState(state);
    });

    // Load initial data
    const loadData = async () => {
      try {
        const [savedSettings, savedTerritories, savedNotes, savedPackages, savedLabels] = await Promise.all([
          dbService.getSettings(),
          dbService.getAllTerritories(),
          dbService.getAllNotes(),
          dbService.getAllTilePackages(),
          dbService.getAllMapLabels()
        ]);

        setSettings(savedSettings);
        setTilePackages(savedPackages);
        setLabels(savedLabels || []);

        // Clean out any legacy demo/sample data (t_sample_1..4, n_sample_1..4) without touching user data
        const sampleTerritoryIds = new Set(['t_sample_1', 't_sample_2', 't_sample_3', 't_sample_4']);
        const sampleNoteIds = new Set(['n_sample_1', 'n_sample_2', 'n_sample_3', 'n_sample_4']);

        const userTerritories = savedTerritories.filter(
          (t) => !sampleTerritoryIds.has(t.id) && !t.id.startsWith('t_sample_')
        );
        const userNotes = savedNotes.filter(
          (n) => !sampleNoteIds.has(n.id) && !n.id.startsWith('n_sample_')
        );

        // Clean up only demo records from IndexedDB if they existed
        for (const t of savedTerritories) {
          if (sampleTerritoryIds.has(t.id) || t.id.startsWith('t_sample_')) {
            await dbService.deleteTerritory(t.id);
          }
        }
        for (const n of savedNotes) {
          if (sampleNoteIds.has(n.id) || n.id.startsWith('n_sample_')) {
            await dbService.deleteNote(n.id);
          }
        }

        setTerritories(userTerritories);
        setNotes(userNotes);
      } catch (err) {
        console.error('Error loading IndexedDB data:', err);
      }
    };

    loadData();

    // Check biometric platform availability
    biometricAuthService.checkBiometricSupport().then((status) => {
      setIsBiometricSupported(status.isSupported && status.platformAuthenticatorAvailable);
    });

    // PWA Install Prompt Listener
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
      showToast('🎉 ¡Aplicación instalada exitosamente!');
    };

    const checkStandalone = 
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(checkStandalone);

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      unsubUpdate();
      unsubGps();
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Biometric Unlock / Lock Handlers
  const handleUnlockWithBiometrics = async () => {
    setShowBiometricModal(true);
  };

  const handleLockAdmin = () => {
    setIsAdminUnlocked(false);
    setDrawingMode('none');
    setDrawingVertices([]);
    setShowLetterModal(false);
    setEditingTerritory(null);
    showToast('🔒 Modo usuario activado: Edición bloqueada');
  };

  // Drawing Live Metrics
  const currentAreaM2 = React.useMemo(() => {
    return calculatePolygonArea(drawingVertices);
  }, [drawingVertices]);

  const currentPerimeterM = React.useMemo(() => {
    return calculatePolygonPerimeter(drawingVertices);
  }, [drawingVertices]);

  // Drawing Handlers
  const handleAddDrawingVertex = useCallback((coord: [number, number]) => {
    setDrawingVertices((prev) => [...prev, coord]);
  }, []);

  const handleUndoVertex = useCallback(() => {
    setDrawingVertices((prev) => prev.slice(0, -1));
  }, []);

  const handleClearVertices = useCallback(() => {
    setDrawingVertices([]);
  }, []);

  const handleFinishDrawing = useCallback(() => {
    if (drawingVertices.length < 3) return;

    const area = calculatePolygonArea(drawingVertices);
    const perimeter = calculatePolygonPerimeter(drawingVertices);
    const centroid = calculateCentroid(drawingVertices);
    const codeNum = territories.length + 101;

    setEditingTerritory({
      code: `T-${codeNum}`,
      name: `Territorio Sector ${codeNum}`,
      status: 'activo',
      priority: 'media',
      color: '#10b981',
      coordinates: drawingVertices,
      areaM2: area,
      perimeterM: perimeter,
      centroid
    });

    setDrawingMode('none');
    setDrawingVertices([]);
  }, [drawingVertices, territories]);

  const handleCancelDrawing = useCallback(() => {
    setDrawingMode('none');
    setDrawingVertices([]);
  }, []);

  // Territory CRUD
  const handleSaveTerritory = async (territory: Territory) => {
    if (!isAdminUnlocked) {
      alert('🔒 Función protegida: Debes desbloquear la edición con biometría en Configuración.');
      return;
    }
    await dbService.saveTerritory(territory);
    setTerritories((prev) => {
      const idx = prev.findIndex((t) => t.id === territory.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = territory;
        return copy;
      }
      return [territory, ...prev];
    });
    setEditingTerritory(null);
    setSelectedTerritoryId(territory.id);
    setActiveTab('map');
  };

  const handleDeleteTerritory = async (id: string) => {
    if (!isAdminUnlocked) {
      alert('🔒 Función protegida: Debes desbloquear la edición con biometría en Configuración.');
      return;
    }
    await dbService.deleteTerritory(id);
    setTerritories((prev) => prev.filter((t) => t.id !== id));
    if (selectedTerritoryId === id) setSelectedTerritoryId(null);
    if (activeRoute && activeRoute.targetType === 'territory') setActiveRoute(null);
    setEditingTerritory(null);
  };

  // Field Notes CRUD
  const handleSaveNote = async (note: MapNote) => {
    await dbService.saveNote(note);
    setNotes((prev) => {
      const idx = prev.findIndex((n) => n.id === note.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = note;
        return copy;
      }
      return [note, ...prev];
    });
    setEditingNote(null);
  };

  const handleDeleteNote = async (id: string) => {
    await dbService.deleteNote(id);
    setNotes((prev) => prev.filter((n) => n.id !== id));
    if (activeRoute && activeRoute.targetType === 'note') setActiveRoute(null);
    setEditingNote(null);
  };

  // Map Labels CRUD
  const handleAddLabelAtCoord = async (coord: [number, number]) => {
    if (!isAdminUnlocked) {
      alert('🔒 Función protegida: Debes desbloquear la edición con biometría en Configuración.');
      return;
    }
    const text = activeLetterText.trim().toUpperCase() || 'A';
    const newLabel: MapLabel = {
      id: `lbl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      text,
      lat: coord[0],
      lng: coord[1],
      fontSize: activeLetterSize,
      color: '#fbbf24',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await dbService.saveMapLabel(newLabel);
    setLabels((prev) => [...prev, newLabel]);
    showToast(`✅ Letra "${newLabel.text}" colocada en el mapa`);

    // Automatically cycle letter if single char (A->B, B->C, 1->2) for fast sequential labeling of blocks!
    if (text.length === 1 && text >= 'A' && text < 'Z') {
      setActiveLetterText(String.fromCharCode(text.charCodeAt(0) + 1));
    } else if (text.length === 1 && text >= '1' && text < '9') {
      setActiveLetterText(String.fromCharCode(text.charCodeAt(0) + 1));
    }
  };

  const handleUpdateLabel = async (label: MapLabel) => {
    if (!isAdminUnlocked) {
      alert('🔒 Función protegida: Debes desbloquear la edición con biometría en Configuración.');
      return;
    }
    await dbService.saveMapLabel(label);
    setLabels((prev) => prev.map((l) => (l.id === label.id ? label : l)));
  };

  const handleDeleteLabel = async (id: string) => {
    if (!isAdminUnlocked) {
      alert('🔒 Función protegida: Debes desbloquear la edición con biometría en Configuración.');
      return;
    }
    await dbService.deleteMapLabel(id);
    setLabels((prev) => prev.filter((l) => l.id !== id));
  };

  // Navigation handlers
  const handleWalkPerimeter = async () => {
    let startLat = gpsState.latitude;
    let startLng = gpsState.longitude;

    if (!gpsState.active || startLat === null || startLng === null) {
      gpsService.startTracking(() => setShowPermissionModal(true));

      // Attempt rapid position retrieval if available
      if ('geolocation' in navigator) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 5000,
              maximumAge: 20000
            });
          });
          startLat = pos.coords.latitude;
          startLng = pos.coords.longitude;
        } catch {
          // Geolocation fetch wait
        }
      }
    }

    if (startLat === null || startLng === null) {
      alert('Activa tu ubicación GPS para trazar la ruta hacia el territorio.');
      return;
    }

    const startPoint: [number, number] = [startLat, startLng];

    if (territories.length === 0) {
      alert('No hay territorios guardados. Dibuja o importa primero un territorio en el mapa.');
      return;
    }

    let targetTerritory: Territory | undefined;

    // 1. Prioritize the territory that was touched / selected on the map
    if (selectedTerritoryId) {
      targetTerritory = territories.find((t) => t.id === selectedTerritoryId);
    }

    // 2. If none explicitly touched yet, pick the only one or closest territory
    if (!targetTerritory) {
      if (territories.length === 1) {
        targetTerritory = territories[0];
      } else {
        let minDistance = Infinity;
        for (const t of territories) {
          if (!t.coordinates || t.coordinates.length < 3) continue;
          const accessPoint = calculateOptimalAccessPoint(startPoint, t.coordinates);
          const dist = calculateDistance(startPoint, accessPoint);
          if (dist < minDistance) {
            minDistance = dist;
            targetTerritory = t;
          }
        }
      }
    }

    if (!targetTerritory || !targetTerritory.coordinates || targetTerritory.coordinates.length < 3) {
      alert('No se pudo identificar el territorio para calcular la ruta.');
      return;
    }

    // Determine the optimal access point on the perimeter of the touched territory
    const accessPoint = calculateOptimalAccessPoint(startPoint, targetTerritory.coordinates);

    try {
      const route = await calculatePedestrianRoute(
        startPoint,
        accessPoint,
        `${targetTerritory.code} - ${targetTerritory.name}`,
        'territory'
      );

      setActiveRoute(route);
      setSelectedTerritoryId(targetTerritory.id);
      setActiveTab('map');
    } catch (err) {
      console.error('Error calculando ruta peatonal:', err);
    }
  };

  const handleNavigateToTerritory = async (territory: Territory) => {
    const startLat = gpsState.latitude;
    const startLng = gpsState.longitude;

    if (!gpsState.active || startLat === null || startLng === null) {
      gpsService.startTracking(() => setShowPermissionModal(true));
      alert('Activa tu ubicación para calcular la ruta.');
      return;
    }

    const startPoint: [number, number] = [startLat, startLng];
    const accessPoint = calculateOptimalAccessPoint(startPoint, territory.coordinates);

    const route = await calculatePedestrianRoute(
      startPoint,
      accessPoint,
      `${territory.code} - ${territory.name}`,
      'territory'
    );

    setActiveRoute(route);
    setSelectedTerritoryId(territory.id);
    setActiveTab('map');
  };

  const handleNavigateToNote = async (note: MapNote) => {
    const startLat = gpsState.latitude;
    const startLng = gpsState.longitude;

    if (!gpsState.active || startLat === null || startLng === null) {
      gpsService.startTracking(() => setShowPermissionModal(true));
      alert('Activa tu ubicación para calcular la ruta.');
      return;
    }

    const startPoint: [number, number] = [startLat, startLng];

    const route = await calculatePedestrianRoute(
      startPoint,
      note.coordinate,
      note.title,
      'note'
    );

    setActiveRoute(route);
    setActiveTab('map');
  };

  // Tile Package Download
  const handleDownloadPackage = async (
    name: string,
    bounds: [[number, number], [number, number]],
    minZoom: number,
    maxZoom: number,
    provider: MapProviderId
  ) => {
    const tempPkgId = `pkg_downloading_${Date.now()}`;
    setActiveDownload({ packageId: tempPkgId, downloaded: 0, total: 100 });

    try {
      const pkg = await tileManager.downloadPackage(
        name,
        bounds,
        minZoom,
        maxZoom,
        provider,
        (downloaded, total) => {
          setActiveDownload({ packageId: tempPkgId, downloaded, total });
        }
      );

      setTilePackages((prev) => [pkg, ...prev]);
    } catch (err) {
      console.error('Error downloading tile package:', err);
    } finally {
      setActiveDownload(null);
    }
  };

  const handleDeletePackage = async (id: string) => {
    await dbService.deleteTilePackage(id);
    setTilePackages((prev) => prev.filter((p) => p.id !== id));
  };

  const handleCancelDownload = (id: string) => {
    tileManager.cancelDownload(id);
    setActiveDownload(null);
  };

  // Settings & Data Management
  const handleSaveSettings = async (newSettings: AppSettings) => {
    await dbService.saveSettings(newSettings);
    setSettings(newSettings);
  };

  const handleClearAllData = async () => {
    await dbService.clearAllData();
    setTerritories([]);
    setNotes([]);
    setLabels([]);
    setTilePackages([]);
    setActiveRoute(null);
    setSelectedTerritoryId(null);
    alert('Todos los datos locales han sido eliminados.');
  };

  const reloadAllDataFromDB = useCallback(async () => {
    try {
      const [savedSettings, savedTerritories, savedNotes, savedPackages, savedLabels] = await Promise.all([
        dbService.getSettings(),
        dbService.getAllTerritories(),
        dbService.getAllNotes(),
        dbService.getAllTilePackages(),
        dbService.getAllMapLabels()
      ]);
      setSettings(savedSettings);
      setTerritories(savedTerritories);
      setNotes(savedNotes);
      setTilePackages(savedPackages);
      setLabels(savedLabels || []);
    } catch (err) {
      console.error('Error reloading all data from DB:', err);
    }
  }, []);

  // Actualizar base de datos de territorios desde la URL de GitHub
  const handleUpdateTerritoriesDatabase = useCallback(async () => {
    if (isUpdatingDatabase) return;
    setIsUpdatingDatabase(true);

    const TARGET_URL = 'https://raw.githubusercontent.com/Renny0007/Base-de-datos-territorio/refs/heads/main/territorios.json';

    try {
      // 1. Descargar el archivo JSON desde la URL
      const fetchUrl = `${TARGET_URL}?_t=${Date.now()}`;
      const response = await fetch(fetchUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const text = await response.text();

      // 2. Validar que el JSON sea correcto
      let parsed: any;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error('JSON inválido');
      }

      const rawTerritories = Array.isArray(parsed) ? parsed : (parsed.territories || []);
      if (!Array.isArray(rawTerritories) || rawTerritories.length === 0) {
        throw new Error('Estructura de territorios vacía o no válida');
      }

      const validTerritories = rawTerritories.filter(
        (t: any) => t && Array.isArray(t.coordinates) && t.coordinates.length >= 3
      );
      if (validTerritories.length === 0) {
        throw new Error('No contiene polígonos válidos');
      }

      // 3. Reemplazar los datos locales de territorios con los nuevos datos
      // 4. Guardarlos para que funcionen sin conexión (IndexedDB)
      await dbService.importFullBackup(text, true);

      // Recargar datos en memoria para actualizar la interfaz
      await reloadAllDataFromDB();

      // Guardar metadata de sincronización
      try {
        const timestamp = Date.now();
        const formattedDate = new Date(timestamp).toLocaleString('es-ES', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        const metaObj = {
          version: parsed.version || 2,
          updatedAt: timestamp,
          formattedDate,
          territoriesCount: validTerritories.length,
          labelsCount: Array.isArray(parsed.labels) ? parsed.labels.length : 0,
          notesCount: Array.isArray(parsed.notes) ? parsed.notes.length : 0,
          sourceUrl: TARGET_URL
        };
        localStorage.setItem('territorios_master_db_version_info', JSON.stringify(metaObj));
        localStorage.setItem('territorios_master_db_meta', JSON.stringify(metaObj));
      } catch {
        // Ignorar fallo de almacenamiento local secundario
      }

      // 5. Mostrar "Actualización completada" al terminar
      showToast('Actualización completada');
    } catch (err) {
      console.error('Error al actualizar base de datos:', err);
      // 6. Si falla la descarga o el JSON es inválido, conservar los datos actuales y mostrar "No se pudo actualizar"
      showToast('No se pudo actualizar');
    } finally {
      setIsUpdatingDatabase(false);
    }
  }, [isUpdatingDatabase, reloadAllDataFromDB]);

  const handleImportTerritories = async (imported: Partial<Territory>[]) => {
    const savedList: Territory[] = [];
    for (const item of imported) {
      if (item.coordinates && item.coordinates.length >= 3) {
        const coords = item.coordinates as [number, number][];
        const full: Territory = {
          id: item.id || `t_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          code: item.code || `T-${100 + savedList.length}`,
          name: item.name || 'Territorio Importado',
          assignedTo: item.assignedTo || '',
          status: item.status || 'activo',
          priority: item.priority || 'media',
          color: item.color || '#10b981',
          coordinates: coords,
          areaM2: item.areaM2 || calculatePolygonArea(coords),
          perimeterM: item.perimeterM || calculatePolygonPerimeter(coords),
          centroid: item.centroid || calculateCentroid(coords),
          description: item.description || '',
          tags: item.tags || [],
          createdAt: item.createdAt || Date.now(),
          updatedAt: Date.now()
        };
        await dbService.saveTerritory(full);
        savedList.push(full);
      }
    }
    await reloadAllDataFromDB();
  };

  const handleCenterOnGps = () => {
    setActiveTab('map');
    setCenterGpsTrigger(Date.now());
  };

  return (
    <div className="flex flex-col h-full h-[100dvh] w-full max-w-full overflow-hidden bg-slate-950 text-slate-100 select-none">
      {/* 1. Android Tactical Top Bar */}
      <AndroidHeader
        gpsState={gpsState}
        isAdminUnlocked={isAdminUnlocked}
        onOpenPermissionHelp={() => setShowPermissionModal(true)}
        onCenterLocation={handleCenterOnGps}
        onOpenBiometricPrompt={() => setShowBiometricModal(true)}
        onOpenSettings={() => setActiveTab('settings')}
        onOpenInstallModal={() => setShowInstallModal(true)}
        onOpenDatabaseSyncModal={() => setShowDatabaseSyncModal(true)}
        isInstallable={!isStandalone}
      />

      {/* 2. PWA Update Notification Banner */}
      {showUpdateBanner && (
        <UpdateNotificationBanner onDismiss={() => setShowUpdateBanner(false)} />
      )}

      {/* 3. Main Body View (Tab Controlled) */}
      <main className="flex-1 relative overflow-hidden">
        {/* Map View */}
        <div className={`w-full h-full ${activeTab === 'map' ? 'block' : 'hidden'}`}>
          <MapComponent
            territories={territories}
            notes={notes}
            labels={labels}
            selectedTerritoryId={selectedTerritoryId}
            isAdminUnlocked={isAdminUnlocked}
            onSelectTerritory={(t) => {
              setSelectedTerritoryId(t.id);
            }}
            onSelectNote={(n) => setEditingNote(n)}
            onAddLabel={handleAddLabelAtCoord}
            onUpdateLabel={handleUpdateLabel}
            onDeleteLabel={handleDeleteLabel}
            gpsState={gpsState}
            activeRoute={activeRoute}
            drawingMode={drawingMode}
            onSetDrawingMode={(m) => setDrawingMode(m)}
            onOpenLetterModal={() => setShowLetterModal(true)}
            drawingVertices={drawingVertices}
            onAddDrawingVertex={handleAddDrawingVertex}
            onAddNoteAtCenter={(coord) => {
              setEditingNote({
                coordinate: coord,
                category: 'visita'
              });
            }}
            mapProvider={settings.mapProvider}
            onChangeProvider={(p) => handleSaveSettings({ ...settings, mapProvider: p })}
            autoCenterGps={settings.gpsAutoCenter}
            onToggleAutoCenter={() => handleSaveSettings({ ...settings, gpsAutoCenter: !settings.gpsAutoCenter })}
            centerGpsTrigger={centerGpsTrigger}
            onRequestActivateGps={() => {
              gpsService.startTracking(() => setShowPermissionModal(true));
              handleCenterOnGps();
            }}
          />

          {/* Floating Drawing Toolbar on Map */}
          <DrawingControls
            mode={drawingMode}
            isAdminUnlocked={isAdminUnlocked}
            onRequestUnlock={() => setShowBiometricModal(true)}
            onSetMode={(m) => setDrawingMode(m)}
            onWalkPerimeter={handleWalkPerimeter}
            activeRoute={activeRoute}
            onClearRoute={() => setActiveRoute(null)}
            vertices={drawingVertices}
            currentAreaM2={currentAreaM2}
            currentPerimeterM={currentPerimeterM}
            gpsState={gpsState}
            onUndoVertex={handleUndoVertex}
            onClearVertices={handleClearVertices}
            onFinishDrawing={handleFinishDrawing}
            onCancelDrawing={handleCancelDrawing}
            letterText={activeLetterText}
            onChangeLetterText={setActiveLetterText}
            letterFontSize={activeLetterSize}
            onChangeLetterFontSize={setActiveLetterSize}
            onCancelLetterMode={() => setDrawingMode('none')}
            onOpenLetterModal={() => setShowLetterModal(true)}
            onUpdateDatabase={handleUpdateTerritoriesDatabase}
            isUpdatingDatabase={isUpdatingDatabase}
          />
        </div>

        {/* Territories List & Search View */}
        {activeTab === 'territories' && (
          <TerritoriesListView
            territories={territories}
            isAdminUnlocked={isAdminUnlocked}
            onRequestUnlock={() => setShowBiometricModal(true)}
            onSelectTerritoryOnMap={(t) => {
              setSelectedTerritoryId(t.id);
              setActiveTab('map');
            }}
            onNavigateToTerritory={handleNavigateToTerritory}
            onEditTerritory={(t) => setEditingTerritory(t)}
            onDeleteTerritory={handleDeleteTerritory}
            onStartDrawing={() => {
              setActiveTab('map');
              setDrawingMode('polygon');
            }}
            onImportTerritories={handleImportTerritories}
            onReloadAllData={reloadAllDataFromDB}
            onOpenDatabaseSyncModal={() => setShowDatabaseSyncModal(true)}
          />
        )}

        {/* Offline Maps View */}
        {activeTab === 'offline' && (
          <OfflineMapsView
            tilePackages={tilePackages}
            territories={territories}
            mapProvider={settings.mapProvider}
            onDownloadPackage={handleDownloadPackage}
            onDeletePackage={handleDeletePackage}
            onCancelDownload={handleCancelDownload}
            activeDownload={activeDownload}
          />
        )}

        {/* Field Notes List View */}
        {activeTab === 'notes' && (
          <NotesListView
            notes={notes}
            territories={territories}
            onSelectNoteOnMap={(n) => {
              setActiveTab('map');
            }}
            onNavigateToNote={handleNavigateToNote}
            onEditNote={(n) => setEditingNote(n)}
            onDeleteNote={handleDeleteNote}
            onNewNote={() => {
              setEditingNote({
                coordinate: [gpsState.latitude || 18.48517, gpsState.longitude || -69.30083],
                category: 'visita'
              });
            }}
          />
        )}

        {/* Settings View */}
        {activeTab === 'settings' && (
          <SettingsModal
            settings={settings}
            onSaveSettings={handleSaveSettings}
            onClearAllData={handleClearAllData}
            onOpenHelpGuide={() => setShowHelpModal(true)}
            onReloadAllData={reloadAllDataFromDB}
            onOpenInstallModal={() => setShowInstallModal(true)}
            onOpenDatabaseSyncModal={() => setShowDatabaseSyncModal(true)}
            isAdminUnlocked={isAdminUnlocked}
            isBiometricSupported={isBiometricSupported}
            onUnlockWithBiometrics={handleUnlockWithBiometrics}
            onLockAdmin={handleLockAdmin}
          />
        )}
      </main>

      {/* 4. Android Touch Bottom Navigation Bar */}
      <BottomNavBar
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab)}
        territoriesCount={territories.length}
        notesCount={notes.length}
        offlinePackagesCount={tilePackages.length}
      />

      {/* 5. Modals & Dialogs */}
      {editingTerritory && (
        <TerritoryEditModal
          initialTerritory={editingTerritory}
          onSave={handleSaveTerritory}
          onDelete={editingTerritory.id ? handleDeleteTerritory : undefined}
          onClose={() => setEditingTerritory(null)}
        />
      )}

      {editingNote && (
        <NoteEditModal
          initialNote={editingNote}
          territories={territories}
          gpsState={gpsState}
          onSave={handleSaveNote}
          onDelete={editingNote.id ? handleDeleteNote : undefined}
          onClose={() => setEditingNote(null)}
        />
      )}

      {showHelpModal && (
        <HelpApiGuideModal onClose={() => setShowHelpModal(false)} />
      )}

      {showPermissionModal && (
        <LocationPermissionModal
          onClose={() => setShowPermissionModal(false)}
          onRetry={() => {
            gpsService.startTracking(() => setShowPermissionModal(true));
          }}
        />
      )}

      {/* Letter Modal (Add Letter dialog with 'Colocar en el mapa' and 'Salir') */}
      <LetterModal
        isOpen={showLetterModal}
        initialText={activeLetterText}
        initialSize={activeLetterSize}
        onStartPlacing={(text, size) => {
          setShowLetterModal(false);
          setActiveLetterText(text);
          setActiveLetterSize(size);
          setDrawingMode('letter');
          setActiveTab('map');
          showToast(`🎯 Toca en el mapa para colocar la letra "${text}"`);
        }}
        onClose={() => setShowLetterModal(false)}
      />

      {/* Biometric Prompt & Authentication Modal */}
      <BiometricPromptModal
        isOpen={showBiometricModal}
        isAdminUnlocked={isAdminUnlocked}
        isBiometricSupported={isBiometricSupported}
        onClose={() => setShowBiometricModal(false)}
        onUnlockSuccess={() => {
          setIsAdminUnlocked(true);
          showToast('🔓 Modo Administrador activado: Edición habilitada');
        }}
        onLock={handleLockAdmin}
      />

      {/* Database Sync from GitHub Modal */}
      <DatabaseSyncModal
        isOpen={showDatabaseSyncModal}
        onClose={() => setShowDatabaseSyncModal(false)}
        localTerritoriesCount={territories.length}
        onReloadAllData={reloadAllDataFromDB}
        onShowToast={showToast}
      />

      {/* PWA Install Modal */}
      <InstallPwaModal
        isOpen={showInstallModal}
        onClose={() => setShowInstallModal(false)}
        deferredPrompt={deferredPrompt}
        onInstallSuccess={() => {
          setShowInstallModal(false);
          showToast('🎉 ¡Aplicación instalada exitosamente!');
        }}
      />

      {/* Instant Feedback Toast */}
      {toastMessage && (
        <div 
          id="app-toast-banner"
          className="fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 border border-amber-500/80 text-amber-300 px-4 py-2.5 rounded-2xl shadow-2xl backdrop-blur-md text-xs sm:text-sm font-bold flex items-center gap-2 animate-fadeIn pointer-events-none max-w-[90vw] text-center"
        >
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
