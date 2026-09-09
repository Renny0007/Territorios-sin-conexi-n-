/**
 * GitHub / Cloud Remote Database Sync Service
 * Allows synchronizing the application's territories and map data directly from a public
 * GitHub repository (raw file), GitHub Gist, or direct JSON URL.
 * 
 * Features:
 * - Automatic Restore Point (Undo / Deshacer cambios) before every update
 * - Smart URL normalizer (converts standard GitHub & Gist web links to raw fetch endpoints)
 * - Cache-busting to ensure instant retrieval of the newest changes
 * - Full offline resilience: once downloaded, data is stored in IndexedDB for 100% offline use
 */

import { dbService } from './db';

export interface SyncMetadata {
  timestamp: number;
  url: string;
  territoriesCount: number;
  notesCount: number;
  labelsCount: number;
  status: 'success' | 'error';
  errorMessage?: string;
}

export interface RestorePointInfo {
  exists: boolean;
  timestamp?: number;
  formattedDate?: string;
  territoriesCount?: number;
  notesCount?: number;
  labelsCount?: number;
  sourceDescription?: string;
}

const STORAGE_KEY_URL = 'territorios_github_sync_url';
const STORAGE_KEY_LAST_SYNC = 'territorios_github_last_sync_info';
const STORAGE_KEY_RESTORE_META = 'territorios_github_restore_point_meta';
const RESTORE_POINT_DB_ID = 'github_sync_restore_point';

class GitHubSyncService {
  /**
   * Returns the stored GitHub / Gist URL configured by the user.
   */
  getStoredUrl(): string {
    if (typeof window === 'undefined') return '';
    try {
      return localStorage.getItem(STORAGE_KEY_URL) || '';
    } catch {
      return '';
    }
  }

  /**
   * Saves the GitHub / Gist URL.
   */
  saveStoredUrl(url: string): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY_URL, url.trim());
    } catch (err) {
      console.warn('Could not save sync URL to localStorage:', err);
    }
  }

  /**
   * Intelligently normalizes GitHub and Gist web URLs to raw download URLs.
   * Examples:
   * - https://github.com/user/repo/blob/main/territorios.json -> https://raw.githubusercontent.com/user/repo/main/territorios.json
   * - https://gist.github.com/user/abc12345 -> https://gist.githubusercontent.com/user/abc12345/raw/
   * - https://www.dropbox.com/s/xyz/file.json?dl=0 -> https://www.dropbox.com/s/xyz/file.json?raw=1
   */
  normalizeUrl(rawUrl: string): string {
    if (!rawUrl) return '';
    let url = rawUrl.trim();

    // 1. GitHub Blob URL: https://github.com/:owner/:repo/blob/:branch/:path
    const githubBlobRegex = /^https?:\/\/github\.com\/([^\/]+)\/([^\/]+)\/blob\/([^\/]+)\/(.+)$/i;
    if (githubBlobRegex.test(url)) {
      url = url.replace(githubBlobRegex, 'https://raw.githubusercontent.com/$1/$2/$3/$4');
      return url;
    }

    // 2. GitHub Raw shortcut via github.com: https://github.com/:owner/:repo/raw/:branch/:path
    const githubRawRegex = /^https?:\/\/github\.com\/([^\/]+)\/([^\/]+)\/raw\/([^\/]+)\/(.+)$/i;
    if (githubRawRegex.test(url)) {
      url = url.replace(githubRawRegex, 'https://raw.githubusercontent.com/$1/$2/$3/$4');
      return url;
    }

    // 3. GitHub Gist URL: https://gist.github.com/:owner/:gistId or https://gist.github.com/:gistId
    const gistRegex = /^https?:\/\/gist\.github\.com\/([^\/]+)\/([a-f0-9]+)(?:#.*)?$/i;
    const matchGist = url.match(gistRegex);
    if (matchGist) {
      const owner = matchGist[1];
      const gistId = matchGist[2];
      return `https://gist.githubusercontent.com/${owner}/${gistId}/raw/`;
    }

    // 4. Dropbox link
    if (url.includes('dropbox.com')) {
      return url.replace('dl=0', 'raw=1').replace('?dl=1', '?raw=1');
    }

    return url;
  }

  /**
   * Retrieves info about the last synchronization attempt.
   */
  getLastSyncInfo(): SyncMetadata | null {
    if (typeof window === 'undefined') return null;
    try {
      const saved = localStorage.getItem(STORAGE_KEY_LAST_SYNC);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  }

  /**
   * Checks if an undo restore point is currently available.
   */
  async getRestorePointInfo(): Promise<RestorePointInfo> {
    if (typeof window === 'undefined') return { exists: false };

    try {
      // Check metadata in localStorage first for quick UI response
      const metaJson = localStorage.getItem(STORAGE_KEY_RESTORE_META);
      if (!metaJson) {
        return { exists: false };
      }

      const meta = JSON.parse(metaJson);
      if (!meta || !meta.timestamp) {
        return { exists: false };
      }

      // Format date in human-readable Spanish
      const date = new Date(meta.timestamp);
      const formattedDate = date.toLocaleString('es-ES', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });

      return {
        exists: true,
        timestamp: meta.timestamp,
        formattedDate,
        territoriesCount: meta.territoriesCount || 0,
        notesCount: meta.notesCount || 0,
        labelsCount: meta.labelsCount || 0,
        sourceDescription: meta.sourceDescription || 'Versión previa local'
      };
    } catch {
      return { exists: false };
    }
  }

  /**
   * Creates a snapshot of current data before making any changes.
   */
  private async createRestorePoint(description: string = 'Versión anterior a la sincronización'): Promise<void> {
    try {
      const backupJson = await dbService.exportFullBackup();
      const [territories, notes, labels] = await Promise.all([
        dbService.getAllTerritories(),
        dbService.getAllNotes(),
        dbService.getAllMapLabels()
      ]);

      const metadata = {
        timestamp: Date.now(),
        territoriesCount: territories.length,
        notesCount: notes.length,
        labelsCount: labels.length,
        sourceDescription: description
      };

      // Save large backup in IndexedDB app_settings to prevent localStorage size issues
      await dbService.saveRestorePoint(RESTORE_POINT_DB_ID, {
        backupJson,
        metadata
      });

      // Save lightweight metadata in localStorage
      localStorage.setItem(STORAGE_KEY_RESTORE_META, JSON.stringify(metadata));
    } catch (err) {
      console.warn('Could not create restore point:', err);
    }
  }

  /**
   * Synchronizes data from GitHub or remote URL.
   * Automatically takes a restore point snapshot first so changes can be undone at any time.
   */
  async syncFromRemote(customUrl?: string, replaceMode: boolean = true): Promise<{
    success: boolean;
    importedTerritories: number;
    importedNotes: number;
    importedLabels: number;
    hasRestorePoint: boolean;
  }> {
    const rawUrl = customUrl || this.getStoredUrl();
    if (!rawUrl) {
      throw new Error('No se ha especificado la URL de GitHub o Gist.');
    }

    const normalizedUrl = this.normalizeUrl(rawUrl);
    this.saveStoredUrl(rawUrl);

    // Append cache-buster param to bypass proxy and browser caching
    const cacheBuster = `_t=${Date.now()}`;
    const fetchUrl = normalizedUrl.includes('?') 
      ? `${normalizedUrl}&${cacheBuster}` 
      : `${normalizedUrl}?${cacheBuster}`;

    let responseText: string;
    try {
      const res = await fetch(fetchUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json, text/plain, */*'
        },
        cache: 'no-cache'
      });

      if (!res.ok) {
        if (res.status === 404) {
          throw new Error('Archivo no encontrado en GitHub (Error 404). Verifica que el enlace sea correcto y público.');
        }
        throw new Error(`Error al conectar con GitHub (Código HTTP ${res.status}: ${res.statusText})`);
      }

      responseText = await res.text();
    } catch (netErr: any) {
      const errorMsg = netErr?.message?.includes('Failed to fetch')
        ? 'Error de red o CORS. Asegúrate de que el enlace provenga de raw.githubusercontent.com o un Gist público.'
        : netErr.message || 'No se pudo descargar el archivo desde GitHub.';
      
      this.recordSyncFailure(rawUrl, errorMsg);
      throw new Error(errorMsg);
    }

    // Validate that content is JSON
    let parsedData: any;
    try {
      parsedData = JSON.parse(responseText);
    } catch {
      const errorMsg = 'El contenido descargado desde el enlace no es un JSON válido. Asegúrate de usar el enlace directo (Raw).';
      this.recordSyncFailure(rawUrl, errorMsg);
      throw new Error(errorMsg);
    }

    // Validate minimum required structure
    const isGeoJson = parsedData && (parsedData.type === 'FeatureCollection' || parsedData.type === 'Feature');
    const isTerritoriesArray = Array.isArray(parsedData);
    const hasTerritoriesProp = parsedData && (Array.isArray(parsedData.territories) || Array.isArray(parsedData.notes));

    if (!isGeoJson && !isTerritoriesArray && !hasTerritoriesProp) {
      const errorMsg = 'El archivo descargado no contiene una estructura válida de territorios o notas.';
      this.recordSyncFailure(rawUrl, errorMsg);
      throw new Error(errorMsg);
    }

    // 1. Take a safe restore point of current database before touching anything!
    await this.createRestorePoint('Versión local previa a la sincronización');

    // 2. Import into database (with optional clean replace of previous state)
    const result = await dbService.importFullBackup(responseText, replaceMode);

    // 3. Save sync success log
    const syncMeta: SyncMetadata = {
      timestamp: Date.now(),
      url: rawUrl,
      territoriesCount: result.importedTerritories,
      notesCount: result.importedNotes,
      labelsCount: result.importedLabels,
      status: 'success'
    };
    try {
      localStorage.setItem(STORAGE_KEY_LAST_SYNC, JSON.stringify(syncMeta));
    } catch {
      // Ignore
    }

    return {
      success: true,
      importedTerritories: result.importedTerritories,
      importedNotes: result.importedNotes,
      importedLabels: result.importedLabels,
      hasRestorePoint: true
    };
  }

  /**
   * Reverts changes and restores the exact database state saved before the last sync.
   */
  async undoLastSync(): Promise<{
    success: boolean;
    restoredTerritories: number;
    restoredNotes: number;
    restoredLabels: number;
    restoredDate: string;
  }> {
    const restoreData = await dbService.getRestorePoint(RESTORE_POINT_DB_ID);
    if (!restoreData || !restoreData.backupJson) {
      throw new Error('No hay ninguna versión anterior disponible para restaurar.');
    }

    // Re-import the exact backup snapshot with clean replace
    const result = await dbService.importFullBackup(restoreData.backupJson, true);

    const formattedDate = restoreData.metadata?.timestamp
      ? new Date(restoreData.metadata.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
      : 'anterior';

    // Clear the restore point now that it has been used, or keep it as desired
    try {
      localStorage.removeItem(STORAGE_KEY_RESTORE_META);
      await dbService.deleteRestorePoint(RESTORE_POINT_DB_ID);
    } catch {
      // Ignore
    }

    return {
      success: true,
      restoredTerritories: result.importedTerritories,
      restoredNotes: result.importedNotes,
      restoredLabels: result.importedLabels,
      restoredDate: formattedDate
    };
  }

  /**
   * Removes current restore point (if user is completely satisfied and doesn't want to see the button anymore).
   */
  async dismissRestorePoint(): Promise<void> {
    try {
      localStorage.removeItem(STORAGE_KEY_RESTORE_META);
      await dbService.deleteRestorePoint(RESTORE_POINT_DB_ID);
    } catch {
      // Ignore
    }
  }

  private recordSyncFailure(url: string, error: string): void {
    try {
      const syncMeta: SyncMetadata = {
        timestamp: Date.now(),
        url,
        territoriesCount: 0,
        notesCount: 0,
        labelsCount: 0,
        status: 'error',
        errorMessage: error
      };
      localStorage.setItem(STORAGE_KEY_LAST_SYNC, JSON.stringify(syncMeta));
    } catch {
      // Ignore
    }
  }
}

export const githubSyncService = new GitHubSyncService();
