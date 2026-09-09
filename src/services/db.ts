import { Territory, MapNote, TilePackage, OfflineTile, OfflineRoutingGraph, AppSettings, MapLabel } from '../types';
import { calculatePolygonArea, calculatePolygonPerimeter, calculateCentroid, isPointInPolygon, parseGeoJSON } from './geoUtils';

const DB_NAME = 'territorios_offline_db';
const DB_VERSION = 3;

export const DEFAULT_SETTINGS: AppSettings = {
  mapProvider: 'carto_dark',
  tacticalMode: true,
  gpsAutoCenter: true,
  gpsAccuracyThresholdM: 20,
  measurementUnit: 'metric',
  defaultWalkSpeedKmH: 4.5
};

class DatabaseService {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Territories store
        if (!db.objectStoreNames.contains('territories')) {
          const terrStore = db.createObjectStore('territories', { keyPath: 'id' });
          terrStore.createIndex('code', 'code', { unique: false });
          terrStore.createIndex('status', 'status', { unique: false });
          terrStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        }

        // Map notes store
        if (!db.objectStoreNames.contains('map_notes')) {
          const notesStore = db.createObjectStore('map_notes', { keyPath: 'id' });
          notesStore.createIndex('territoryId', 'territoryId', { unique: false });
          notesStore.createIndex('category', 'category', { unique: false });
          notesStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // Map labels store (letter & text pins on map)
        if (!db.objectStoreNames.contains('map_labels')) {
          const labelsStore = db.createObjectStore('map_labels', { keyPath: 'id' });
          labelsStore.createIndex('territoryId', 'territoryId', { unique: false });
          labelsStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // Tile packages store
        if (!db.objectStoreNames.contains('tile_packages')) {
          db.createObjectStore('tile_packages', { keyPath: 'id' });
        }

        // Offline tiles store
        if (!db.objectStoreNames.contains('offline_tiles')) {
          const tileStore = db.createObjectStore('offline_tiles', { keyPath: 'key' });
          tileStore.createIndex('packageId', 'packageId', { unique: false });
        }

        // Offline pedestrian routing graphs store
        if (!db.objectStoreNames.contains('routing_graphs')) {
          db.createObjectStore('routing_graphs', { keyPath: 'id' });
        }

        // App settings store
        if (!db.objectStoreNames.contains('app_settings')) {
          db.createObjectStore('app_settings', { keyPath: 'id' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return this.dbPromise;
  }

  // --- Territories CRUD ---
  async getAllTerritories(): Promise<Territory[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('territories', 'readonly');
      const store = tx.objectStore('territories');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async getTerritoryById(id: string): Promise<Territory | undefined> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('territories', 'readonly');
      const store = tx.objectStore('territories');
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async saveTerritory(territory: Territory): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('territories', 'readwrite');
      const store = tx.objectStore('territories');
      const request = store.put(territory);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteTerritory(id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['territories', 'map_notes'], 'readwrite');
      tx.objectStore('territories').delete(id);
      
      // Also unbind or delete notes of this territory
      const notesStore = tx.objectStore('map_notes');
      const index = notesStore.index('territoryId');
      const request = index.getAll(id);
      request.onsuccess = () => {
        const notes: MapNote[] = request.result || [];
        notes.forEach(note => {
          notesStore.put({ ...note, territoryId: undefined });
        });
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // --- Map Notes CRUD ---
  async getAllNotes(): Promise<MapNote[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('map_notes', 'readonly');
      const store = tx.objectStore('map_notes');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async saveNote(note: MapNote): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('map_notes', 'readwrite');
      const store = tx.objectStore('map_notes');
      const request = store.put(note);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteNote(id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('map_notes', 'readwrite');
      const store = tx.objectStore('map_notes');
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // --- Map Labels (Letter & Text Annotations) CRUD ---
  async getAllMapLabels(): Promise<MapLabel[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      if (!db.objectStoreNames.contains('map_labels')) {
        return resolve([]);
      }
      const tx = db.transaction('map_labels', 'readonly');
      const store = tx.objectStore('map_labels');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async saveMapLabel(label: MapLabel): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      if (!db.objectStoreNames.contains('map_labels')) {
        return resolve();
      }
      const tx = db.transaction('map_labels', 'readwrite');
      const store = tx.objectStore('map_labels');
      const request = store.put(label);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteMapLabel(id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      if (!db.objectStoreNames.contains('map_labels')) {
        return resolve();
      }
      const tx = db.transaction('map_labels', 'readwrite');
      const store = tx.objectStore('map_labels');
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // --- Tile Packages & Offline Tiles ---
  async getAllTilePackages(): Promise<TilePackage[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('tile_packages', 'readonly');
      const store = tx.objectStore('tile_packages');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async saveTilePackage(pkg: TilePackage): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('tile_packages', 'readwrite');
      const store = tx.objectStore('tile_packages');
      const request = store.put(pkg);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteTilePackage(id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const stores = ['tile_packages', 'offline_tiles'];
      if (db.objectStoreNames.contains('routing_graphs')) {
        stores.push('routing_graphs');
      }
      const tx = db.transaction(stores, 'readwrite');
      tx.objectStore('tile_packages').delete(id);

      if (db.objectStoreNames.contains('routing_graphs')) {
        tx.objectStore('routing_graphs').delete(id);
      }

      const tileStore = tx.objectStore('offline_tiles');
      const index = tileStore.index('packageId');
      const req = index.getAllKeys(id);
      req.onsuccess = () => {
        const keys = req.result;
        keys.forEach(k => tileStore.delete(k));
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async saveRoutingGraph(graph: OfflineRoutingGraph): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('routing_graphs', 'readwrite');
      const store = tx.objectStore('routing_graphs');
      const request = store.put(graph);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getAllRoutingGraphs(): Promise<OfflineRoutingGraph[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      if (!db.objectStoreNames.contains('routing_graphs')) {
        return resolve([]);
      }
      const tx = db.transaction('routing_graphs', 'readonly');
      const store = tx.objectStore('routing_graphs');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async getRoutingGraphById(id: string): Promise<OfflineRoutingGraph | undefined> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      if (!db.objectStoreNames.contains('routing_graphs')) {
        return resolve(undefined);
      }
      const tx = db.transaction('routing_graphs', 'readonly');
      const store = tx.objectStore('routing_graphs');
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteRoutingGraph(id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      if (!db.objectStoreNames.contains('routing_graphs')) {
        return resolve();
      }
      const tx = db.transaction('routing_graphs', 'readwrite');
      const store = tx.objectStore('routing_graphs');
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async saveTile(tile: OfflineTile): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('offline_tiles', 'readwrite');
      const store = tx.objectStore('offline_tiles');
      const request = store.put(tile);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getTile(key: string): Promise<OfflineTile | undefined> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('offline_tiles', 'readonly');
      const store = tx.objectStore('offline_tiles');
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async countOfflineTiles(): Promise<number> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('offline_tiles', 'readonly');
      const store = tx.objectStore('offline_tiles');
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // --- Settings ---
  async getSettings(): Promise<AppSettings> {
    const db = await this.getDB();
    return new Promise((resolve) => {
      const tx = db.transaction('app_settings', 'readonly');
      const store = tx.objectStore('app_settings');
      const request = store.get('global_settings');
      request.onsuccess = () => {
        if (request.result && request.result.data) {
          resolve({ ...DEFAULT_SETTINGS, ...request.result.data });
        } else {
          resolve(DEFAULT_SETTINGS);
        }
      };
      request.onerror = () => resolve(DEFAULT_SETTINGS);
    });
  }

  async saveSettings(settings: AppSettings): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('app_settings', 'readwrite');
      const store = tx.objectStore('app_settings');
      const request = store.put({ id: 'global_settings', data: settings });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // --- Full Backup & Import ---
  async exportFullBackup(): Promise<string> {
    const [territories, notes, labels, packages, settings] = await Promise.all([
      this.getAllTerritories(),
      this.getAllNotes(),
      this.getAllMapLabels(),
      this.getAllTilePackages(),
      this.getSettings()
    ]);

    const backup = {
      app: 'Territorios Offline',
      version: 2,
      exportedAt: new Date().toISOString(),
      summary: {
        totalTerritories: territories.length,
        totalLabels: labels.length,
        totalNotes: notes.length,
        totalTilePackages: packages.length
      },
      territories,
      labels,
      notes,
      tilePackages: packages,
      settings
    };

    return JSON.stringify(backup, null, 2);
  }

  async saveRestorePoint(id: string, payload: any): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('app_settings', 'readwrite');
      const store = tx.objectStore('app_settings');
      const request = store.put({ id, payload, updatedAt: Date.now() });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getRestorePoint(id: string): Promise<any> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('app_settings', 'readonly');
      const store = tx.objectStore('app_settings');
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result?.payload || null);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteRestorePoint(id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('app_settings', 'readwrite');
      const store = tx.objectStore('app_settings');
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async importFullBackup(jsonString: string, replaceExisting: boolean = false): Promise<{ importedTerritories: number; importedNotes: number; importedLabels: number }> {
    const db = await this.getDB();
    let importedTerritories = 0;
    let importedNotes = 0;
    let importedLabels = 0;

    let data: any;
    try {
      data = JSON.parse(jsonString);
    } catch {
      throw new Error('El archivo no contiene un formato JSON válido.');
    }

    // Check if it's a GeoJSON format
    if (data && (data.type === 'FeatureCollection' || data.type === 'Feature')) {
      const parsed = parseGeoJSON(jsonString);
      data = {
        territories: parsed.territories,
        notes: parsed.notes,
        labels: parsed.labels
      };
    }

    const storeNames = ['territories', 'map_notes', 'app_settings'];
    if (db.objectStoreNames.contains('map_labels')) {
      storeNames.push('map_labels');
    }
    if (db.objectStoreNames.contains('tile_packages')) {
      storeNames.push('tile_packages');
    }

    const savedTerritoriesList: Territory[] = [];

    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeNames, 'readwrite');
      const terrStore = tx.objectStore('territories');
      const noteStore = tx.objectStore('map_notes');

      // If replaceExisting is true, clear old territories and notes first
      if (replaceExisting) {
        terrStore.clear();
        noteStore.clear();
        if (db.objectStoreNames.contains('map_labels')) {
          tx.objectStore('map_labels').clear();
        }
      }

      // 1. Territories / Polygons
      const rawTerritories = Array.isArray(data) ? data : (data.territories || []);
      if (Array.isArray(rawTerritories)) {
        for (const t of rawTerritories) {
          if (t && t.coordinates && Array.isArray(t.coordinates) && t.coordinates.length >= 3) {
            const coords = t.coordinates as [number, number][];
            const area = t.areaM2 || calculatePolygonArea(coords);
            const perim = t.perimeterM || calculatePolygonPerimeter(coords);
            const centroid = t.centroid || calculateCentroid(coords);

            const territory: Territory = {
              id: t.id || `t_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
              code: t.code || `T-${100 + importedTerritories}`,
              name: t.name || 'Territorio',
              assignedTo: t.assignedTo || '',
              status: t.status || 'activo',
              priority: t.priority || 'media',
              color: t.color || '#10b981',
              coordinates: coords,
              areaM2: area,
              perimeterM: perim,
              centroid: centroid,
              description: t.description || '',
              tags: t.tags || [],
              createdAt: t.createdAt || Date.now(),
              updatedAt: Date.now(),
              completedAt: t.completedAt
            };
            terrStore.put(territory);
            savedTerritoriesList.push(territory);
            importedTerritories++;
          }
        }
      }

      // 2. Map Notes
      const rawNotes = data.notes || data.mapNotes || [];
      if (Array.isArray(rawNotes)) {
        for (const n of rawNotes) {
          if (n && n.coordinate && Array.isArray(n.coordinate) && n.coordinate.length >= 2) {
            const coord = n.coordinate as [number, number];
            // If territoryId is not set, try to find enclosing territory
            let terrId = n.territoryId;
            if (!terrId && savedTerritoriesList.length > 0) {
              const matched = savedTerritoriesList.find(t => isPointInPolygon(coord, t.coordinates));
              if (matched) {
                terrId = matched.id;
              }
            }

            noteStore.put({
              id: n.id || `n_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
              territoryId: terrId,
              title: n.title || 'Nota',
              description: n.description || '',
              category: n.category || 'general',
              coordinate: coord,
              address: n.address,
              status: n.status || 'abierto',
              createdAt: n.createdAt || Date.now(),
              updatedAt: Date.now()
            });
            importedNotes++;
          }
        }
      }

      // 3. Map Labels / Letters (Pins & Letters on Map)
      const rawLabels = data.labels || data.mapLabels || data.letters || [];
      if (Array.isArray(rawLabels) && db.objectStoreNames.contains('map_labels')) {
        const labelStore = tx.objectStore('map_labels');
        for (const l of rawLabels) {
          if (l && typeof l.lat === 'number' && typeof l.lng === 'number') {
            const letterPos: [number, number] = [l.lat, l.lng];
            // Ensure territory association: if territoryId is missing, check which polygon encloses this letter
            let terrId = l.territoryId;
            if (!terrId && savedTerritoriesList.length > 0) {
              const matched = savedTerritoriesList.find(t => isPointInPolygon(letterPos, t.coordinates));
              if (matched) {
                terrId = matched.id;
              }
            }

            labelStore.put({
              id: l.id || `lbl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
              text: l.text || 'A',
              lat: l.lat,
              lng: l.lng,
              territoryId: terrId,
              fontSize: l.fontSize || 'md',
              color: l.color || '#fbbf24',
              createdAt: l.createdAt || Date.now(),
              updatedAt: Date.now()
            });
            importedLabels++;
          }
        }
      }

      // 4. Tile Packages if included
      if (Array.isArray(data.tilePackages) && db.objectStoreNames.contains('tile_packages')) {
        const pkgStore = tx.objectStore('tile_packages');
        for (const p of data.tilePackages) {
          if (p && p.id && p.name) {
            pkgStore.put(p);
          }
        }
      }

      // 5. Settings if included
      if (data.settings && typeof data.settings === 'object') {
        tx.objectStore('app_settings').put({ id: 'global_settings', data: data.settings });
      }

      tx.oncomplete = () => resolve({ importedTerritories, importedNotes, importedLabels });
      tx.onerror = () => reject(tx.error);
    });
  }

  // Clear all data
  async clearAllData(): Promise<void> {
    const db = await this.getDB();
    const storeNames = ['territories', 'map_notes', 'tile_packages', 'offline_tiles'];
    if (db.objectStoreNames.contains('map_labels')) {
      storeNames.push('map_labels');
    }
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeNames, 'readwrite');
      tx.objectStore('territories').clear();
      tx.objectStore('map_notes').clear();
      tx.objectStore('tile_packages').clear();
      tx.objectStore('offline_tiles').clear();
      if (db.objectStoreNames.contains('map_labels')) {
        tx.objectStore('map_labels').clear();
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

export const dbService = new DatabaseService();
