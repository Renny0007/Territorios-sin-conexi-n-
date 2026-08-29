import { MapProviderConfig, MapProviderId, TilePackage, OfflineTile } from '../types';
import { dbService } from './db';
import { downloadOsmPedestrianGraph } from './offlineRoutingEngine';

export const MAP_PROVIDERS: Record<MapProviderId, MapProviderConfig> = {
  carto_dark: {
    id: 'carto_dark',
    name: 'Carto Dark Táctico',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    subdomains: ['a', 'b', 'c', 'd'],
    maxZoom: 19,
    attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; OpenStreetMap'
  },
  osm_standard: {
    id: 'osm_standard',
    name: 'OpenStreetMap Estándar',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    subdomains: ['a', 'b', 'c'],
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  },
  esri_satellite: {
    id: 'esri_satellite',
    name: 'Satélite Esri Alta Res',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    maxZoom: 19,
    attribution: '&copy; Esri, Maxar, Earthstar Geographics'
  },
  opentopo: {
    id: 'opentopo',
    name: 'Topográfico Relieve',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    subdomains: ['a', 'b', 'c'],
    maxZoom: 17,
    attribution: '&copy; OpenTopoMap &copy; OpenStreetMap'
  }
};

/**
 * Converts lat/lng and zoom to slippy tile coordinate [x, y]
 */
export function latLngToTile(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const n = Math.pow(2, zoom);
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  );
  return { x: Math.max(0, Math.min(n - 1, x)), y: Math.max(0, Math.min(n - 1, y)) };
}

/**
 * Calculates list of all tiles in a bounding box [[south, west], [north, east]]
 */
export function getTilesInBounds(
  bounds: [[number, number], [number, number]],
  minZoom: number,
  maxZoom: number
): { x: number; y: number; z: number }[] {
  const [[south, west], [north, east]] = bounds;
  const tiles: { x: number; y: number; z: number }[] = [];

  for (let z = minZoom; z <= maxZoom; z++) {
    const swTile = latLngToTile(south, west, z);
    const neTile = latLngToTile(north, east, z);

    const minX = Math.min(swTile.x, neTile.x);
    const maxX = Math.max(swTile.x, neTile.x);
    const minY = Math.min(swTile.y, neTile.y);
    const maxY = Math.max(swTile.y, neTile.y);

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        tiles.push({ x, y, z });
      }
    }
  }

  return tiles;
}

export function buildTileUrl(providerId: MapProviderId, x: number, y: number, z: number): string {
  const config = MAP_PROVIDERS[providerId] || MAP_PROVIDERS.carto_dark;
  const sub = config.subdomains ? config.subdomains[(x + y) % config.subdomains.length] : 'a';
  return config.url
    .replace('{s}', sub)
    .replace('{z}', String(z))
    .replace('{x}', String(x))
    .replace('{y}', String(y))
    .replace('{r}', '');
}

export function getTileStorageKey(providerId: string, x: number, y: number, z: number): string {
  return `${providerId}_${z}_${x}_${y}`;
}

export class TileManager {
  private activeAbortControllers: Map<string, AbortController> = new Map();

  async getStorageUsage(): Promise<{ usedBytes: number; quotaBytes: number; percentage: number }> {
    if (navigator.storage && navigator.storage.estimate) {
      try {
        const est = await navigator.storage.estimate();
        const used = est.usage || 0;
        const quota = est.quota || 1024 * 1024 * 1024;
        return {
          usedBytes: used,
          quotaBytes: quota,
          percentage: Math.min(100, Math.round((used / quota) * 100))
        };
      } catch {
        // ignore
      }
    }
    return { usedBytes: 0, quotaBytes: 1024 * 1024 * 1024, percentage: 0 };
  }

  async downloadPackage(
    name: string,
    bounds: [[number, number], [number, number]],
    minZoom: number,
    maxZoom: number,
    providerId: MapProviderId,
    onProgress?: (downloaded: number, total: number) => void
  ): Promise<TilePackage> {
    const tiles = getTilesInBounds(bounds, minZoom, maxZoom);
    const packageId = `pkg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const abortController = new AbortController();
    this.activeAbortControllers.set(packageId, abortController);

    const tilePackage: TilePackage = {
      id: packageId,
      name,
      bounds,
      minZoom,
      maxZoom,
      totalTiles: tiles.length,
      downloadedTiles: 0,
      sizeBytes: 0,
      provider: providerId,
      createdAt: Date.now(),
      status: 'downloading'
    };

    await dbService.saveTilePackage(tilePackage);

    let downloadedCount = 0;
    let totalSizeBytes = 0;
    const concurrency = 4;
    let index = 0;

    const worker = async () => {
      while (index < tiles.length && !abortController.signal.aborted) {
        const currentIndex = index++;
        const t = tiles[currentIndex];
        const key = getTileStorageKey(providerId, t.x, t.y, t.z);
        const url = buildTileUrl(providerId, t.x, t.y, t.z);

        try {
          // Check if already in DB
          const existing = await dbService.getTile(key);
          if (existing) {
            downloadedCount++;
            if (onProgress) onProgress(downloadedCount, tiles.length);
            continue;
          }

          const response = await fetch(url, { signal: abortController.signal });
          if (response.ok) {
            const blob = await response.blob();
            const dataUrl = await this.blobToDataUrl(blob);
            totalSizeBytes += blob.size;

            const offlineTile: OfflineTile = {
              key,
              packageId,
              dataUrl,
              timestamp: Date.now()
            };

            await dbService.saveTile(offlineTile);
          }
        } catch {
          // Network error on tile download, keep proceeding
        }

        downloadedCount++;
        if (onProgress) onProgress(downloadedCount, tiles.length);
      }
    };

    const pool = Array.from({ length: concurrency }, () => worker());
    await Promise.all(pool);

    // Download real OpenStreetMap pedestrian street network for offline routing
    if (!abortController.signal.aborted) {
      try {
        const routingGraph = await downloadOsmPedestrianGraph(
          packageId,
          name,
          bounds,
          abortController.signal
        );
        if (routingGraph) {
          await dbService.saveRoutingGraph(routingGraph);
        }
      } catch (err) {
        console.warn('Could not download pedestrian routing graph for zone:', err);
      }
    }

    this.activeAbortControllers.delete(packageId);

    const isAborted = abortController.signal.aborted;
    tilePackage.downloadedTiles = downloadedCount;
    tilePackage.sizeBytes = totalSizeBytes;
    tilePackage.status = isAborted ? 'error' : 'completed';

    await dbService.saveTilePackage(tilePackage);
    return tilePackage;
  }

  cancelDownload(packageId: string): void {
    const controller = this.activeAbortControllers.get(packageId);
    if (controller) {
      controller.abort();
      this.activeAbortControllers.delete(packageId);
    }
  }

  private blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}

export const tileManager = new TileManager();
