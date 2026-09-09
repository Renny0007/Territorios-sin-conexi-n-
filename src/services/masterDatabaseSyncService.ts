/**
 * Master Database Sync Service for Territorios Offline
 * 
 * Synchronizes DATA (polygons, territories, labels/letters, and map notes)
 * from a master `database.json` file hosted in a GitHub repository without requiring
 * any API tokens or credentials.
 * 
 * Features:
 * 1. Checks and validates remote database.json
 * 2. Version & date comparison (prevents replacing newer data with older data)
 * 3. Automatic pre-update snapshot (Undo / Revert feature)
 * 4. Stored locally in IndexedDB for 100% offline access
 * 5. Preserves local offline tiles, routing graphs, and unrelated data
 * 6. Detailed status states (Checking, Available, Updating, Success, Error)
 */

import { dbService } from './db';
import { Territory, MapNote, MapLabel } from '../types';
import { getMasterDatabaseUrl, setMasterDatabaseUrl, DEFAULT_DATABASE_JSON_URL } from '../config/databaseConfig';

export interface MasterDatabaseSchema {
  version?: number | string;
  updatedAt?: string | number;
  date?: string;
  description?: string;
  author?: string;
  territories: Territory[];
  labels?: MapLabel[];
  letters?: MapLabel[];
  notes?: MapNote[];
  mapNotes?: MapNote[];
}

export interface LocalDatabaseVersionInfo {
  version: number | string;
  updatedAt: number;
  formattedDate: string;
  territoriesCount: number;
  labelsCount: number;
  notesCount: number;
  sourceUrl?: string;
}

export interface VersionCheckResult {
  hasNewVersion: boolean;
  remoteVersion: number | string;
  remoteDate: string;
  remoteTerritoriesCount: number;
  remoteLabelsCount: number;
  remoteNotesCount: number;
  localVersion: number | string;
  localDate: string;
  localTerritoriesCount: number;
  isDowngradeRisk?: boolean;
  message?: string;
  rawRemoteData: MasterDatabaseSchema;
}

const STORAGE_KEY_DB_VERSION_INFO = 'territorios_master_db_version_info';
const STORAGE_KEY_RESTORE_META = 'territorios_github_restore_point_meta';
const RESTORE_POINT_DB_ID = 'github_sync_restore_point';

class MasterDatabaseSyncService {
  /**
   * Retrieves the configured GitHub URL for database.json
   */
  getConfiguredUrl(): string {
    return getMasterDatabaseUrl();
  }

  /**
   * Saves or updates the URL for database.json
   */
  setConfiguredUrl(url: string): void {
    setMasterDatabaseUrl(url);
  }

  /**
   * Resets URL to default repository
   */
  resetDefaultUrl(): void {
    setMasterDatabaseUrl(DEFAULT_DATABASE_JSON_URL);
  }

  /**
   * Normalizes URLs (e.g. converting github.com/user/repo/blob/main/database.json
   * to raw.githubusercontent.com/user/repo/main/database.json)
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

    // 2. GitHub Raw shortcut: https://github.com/:owner/:repo/raw/:branch/:path
    const githubRawRegex = /^https?:\/\/github\.com\/([^\/]+)\/([^\/]+)\/raw\/([^\/]+)\/(.+)$/i;
    if (githubRawRegex.test(url)) {
      url = url.replace(githubRawRegex, 'https://raw.githubusercontent.com/$1/$2/$3/$4');
      return url;
    }

    // 3. GitHub Gist URL
    const gistRegex = /^https?:\/\/gist\.github\.com\/([^\/]+)\/([a-f0-9]+)(?:#.*)?$/i;
    const matchGist = url.match(gistRegex);
    if (matchGist) {
      return `https://gist.githubusercontent.com/${matchGist[1]}/${matchGist[2]}/raw/`;
    }

    return url;
  }

  /**
   * Retrieves info about the current local database version and last update date
   */
  async getLocalVersionInfo(): Promise<LocalDatabaseVersionInfo> {
    const [territories, labels, notes] = await Promise.all([
      dbService.getAllTerritories(),
      dbService.getAllMapLabels(),
      dbService.getAllNotes()
    ]);

    let savedMeta: any = null;
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(STORAGE_KEY_DB_VERSION_INFO);
        if (raw) savedMeta = JSON.parse(raw);
      } catch {
        // Ignore
      }
    }

    const timestamp = savedMeta?.updatedAt || 0;
    const formattedDate = savedMeta?.formattedDate 
      ? savedMeta.formattedDate 
      : timestamp > 0 
        ? new Date(timestamp).toLocaleString('es-ES', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })
        : 'Sin registro aún';

    return {
      version: savedMeta?.version || 1,
      updatedAt: timestamp,
      formattedDate,
      territoriesCount: territories.length,
      labelsCount: labels.length,
      notesCount: notes.length,
      sourceUrl: savedMeta?.sourceUrl || this.getConfiguredUrl()
    };
  }

  /**
   * Fetches remote database.json from GitHub and validates its structure.
   */
  async fetchRemoteDatabase(urlOverride?: string): Promise<MasterDatabaseSchema> {
    const targetUrl = this.normalizeUrl(urlOverride || this.getConfiguredUrl());
    if (!targetUrl) {
      throw new Error('No se ha configurado la URL del archivo database.json. Necesitas proporcionarla.');
    }

    // Add cache buster to prevent stale GitHub cache
    const cacheBuster = `_t=${Date.now()}`;
    const fetchUrl = targetUrl.includes('?') 
      ? `${targetUrl}&${cacheBuster}` 
      : `${targetUrl}?${cacheBuster}`;

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
          throw new Error('El archivo database.json no fue encontrado en GitHub (Error 404). Verifica que el repositorio sea público y el archivo esté en la rama principal.');
        }
        throw new Error(`No se pudo acceder a GitHub (Código HTTP ${res.status}: ${res.statusText})`);
      }

      responseText = await res.text();
    } catch (netErr: any) {
      const msg = netErr?.message?.includes('Failed to fetch')
        ? 'Error de conexión a internet o bloqueo CORS al descargar database.json.'
        : netErr.message || 'No se pudo descargar database.json desde GitHub.';
      throw new Error(msg);
    }

    // Parse JSON
    let parsed: any;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      throw new Error('El archivo database.json descargado no tiene formato JSON válido o está dañado.');
    }

    // Validate structure
    const isTerritoriesArray = Array.isArray(parsed);
    const hasTerritoriesProp = parsed && Array.isArray(parsed.territories);

    if (!isTerritoriesArray && !hasTerritoriesProp) {
      throw new Error('El archivo database.json no tiene una estructura compatible (debe contener una lista de "territories" o un arreglo de polígonos). No se modificó la base de datos local.');
    }

    // Standardize into MasterDatabaseSchema
    let finalData: MasterDatabaseSchema;
    if (isTerritoriesArray) {
      finalData = {
        version: 1,
        updatedAt: Date.now(),
        territories: parsed
      };
    } else {
      finalData = {
        version: parsed.version || 1,
        updatedAt: parsed.updatedAt || parsed.date || Date.now(),
        description: parsed.description,
        author: parsed.author,
        territories: parsed.territories || [],
        labels: parsed.labels || parsed.letters || [],
        notes: parsed.notes || parsed.mapNotes || []
      };
    }

    // Verify coordinates validity for polygons
    const validPolygons = finalData.territories.filter(
      (t) => t && Array.isArray(t.coordinates) && t.coordinates.length >= 3
    );

    if (finalData.territories.length > 0 && validPolygons.length === 0) {
      throw new Error('El archivo database.json contiene territorios pero ninguno tiene coordenadas de polígono válidas.');
    }

    return finalData;
  }

  /**
   * Compares the remote database.json version and date against the local database
   */
  async checkForUpdates(urlOverride?: string): Promise<VersionCheckResult> {
    const localInfo = await this.getLocalVersionInfo();
    const remoteData = await this.fetchRemoteDatabase(urlOverride);

    const remoteVersionNum = typeof remoteData.version === 'number' 
      ? remoteData.version 
      : parseFloat(String(remoteData.version)) || 1;

    const localVersionNum = typeof localInfo.version === 'number'
      ? localInfo.version
      : parseFloat(String(localInfo.version)) || 1;

    // Compare date / timestamp
    let remoteTimestamp: number;
    if (typeof remoteData.updatedAt === 'number') {
      remoteTimestamp = remoteData.updatedAt;
    } else if (typeof remoteData.updatedAt === 'string') {
      const parsedTime = Date.parse(remoteData.updatedAt);
      remoteTimestamp = isNaN(parsedTime) ? Date.now() : parsedTime;
    } else {
      remoteTimestamp = Date.now();
    }

    const formattedRemoteDate = new Date(remoteTimestamp).toLocaleString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const territoriesCount = remoteData.territories?.length || 0;
    const labelsCount = (remoteData.labels?.length || remoteData.letters?.length) || 0;
    const notesCount = (remoteData.notes?.length || remoteData.mapNotes?.length) || 0;

    // Decide if there is a new version:
    // 1. Version number is higher
    // 2. Or timestamp is newer (by at least 60 seconds)
    // 3. Or local is empty (0 territories) and remote has data
    const isVersionHigher = remoteVersionNum > localVersionNum;
    const isTimeNewer = remoteTimestamp > localInfo.updatedAt + 60000;
    const isLocalEmpty = localInfo.territoriesCount === 0 && territoriesCount > 0;
    const isDowngradeRisk = remoteVersionNum < localVersionNum;

    const hasNewVersion = (isVersionHigher || isTimeNewer || isLocalEmpty) && !isDowngradeRisk;

    return {
      hasNewVersion,
      remoteVersion: remoteData.version || 1,
      remoteDate: formattedRemoteDate,
      remoteTerritoriesCount: territoriesCount,
      remoteLabelsCount: labelsCount,
      remoteNotesCount: notesCount,
      localVersion: localInfo.version,
      localDate: localInfo.formattedDate,
      localTerritoriesCount: localInfo.territoriesCount,
      isDowngradeRisk,
      message: isDowngradeRisk 
        ? 'La versión en GitHub es más antigua que la versión local actual.' 
        : hasNewVersion 
          ? 'Hay una nueva base de datos disponible.' 
          : 'Tu base de datos ya está en la versión más reciente.',
      rawRemoteData: remoteData
    };
  }

  /**
   * Creates an automatic restore point before applying the update
   */
  private async createRestorePointSnapshot(): Promise<void> {
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
        sourceDescription: 'Copia de seguridad previa a la actualización'
      };

      await dbService.saveRestorePoint(RESTORE_POINT_DB_ID, {
        backupJson,
        metadata
      });

      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_RESTORE_META, JSON.stringify(metadata));
      }
    } catch (err) {
      console.warn('Could not create pre-update restore point:', err);
    }
  }

  /**
   * Applies the master database.json to IndexedDB
   */
  async applyDatabaseUpdate(databaseData: MasterDatabaseSchema): Promise<{
    importedTerritories: number;
    importedLabels: number;
    importedNotes: number;
    version: number | string;
    updatedAt: number;
    formattedDate: string;
  }> {
    // 1. Take a safe restore point of the current database before touching anything!
    await this.createRestorePointSnapshot();

    // 2. Import into local database (replaceExisting: true replaces master entities cleanly)
    const jsonString = JSON.stringify(databaseData);
    const result = await dbService.importFullBackup(jsonString, true);

    // 3. Save new version and timestamp info
    const timestamp = typeof databaseData.updatedAt === 'number'
      ? databaseData.updatedAt
      : typeof databaseData.updatedAt === 'string' && !isNaN(Date.parse(databaseData.updatedAt))
        ? Date.parse(databaseData.updatedAt)
        : Date.now();

    const formattedDate = new Date(timestamp).toLocaleString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const versionMeta: LocalDatabaseVersionInfo = {
      version: databaseData.version || 1,
      updatedAt: timestamp,
      formattedDate,
      territoriesCount: result.importedTerritories,
      labelsCount: result.importedLabels,
      notesCount: result.importedNotes,
      sourceUrl: this.getConfiguredUrl()
    };

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_DB_VERSION_INFO, JSON.stringify(versionMeta));
      } catch {
        // Ignore
      }
    }

    return {
      importedTerritories: result.importedTerritories,
      importedLabels: result.importedLabels,
      importedNotes: result.importedNotes,
      version: versionMeta.version,
      updatedAt: timestamp,
      formattedDate
    };
  }

  /**
   * Full one-step update: checks, confirms, and downloads database.json
   */
  async downloadAndApplyUpdate(preloadedData?: MasterDatabaseSchema): Promise<{
    importedTerritories: number;
    importedLabels: number;
    importedNotes: number;
    version: number | string;
    formattedDate: string;
  }> {
    const dataToApply = preloadedData || await this.fetchRemoteDatabase();
    return await this.applyDatabaseUpdate(dataToApply);
  }
}

export const masterDatabaseSyncService = new MasterDatabaseSyncService();
