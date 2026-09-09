/**
 * Master Database Configuration for Territory Synchronization
 * 
 * Central place to configure the GitHub repository URL where database.json is published.
 * You can change this URL whenever you create or update your GitHub repository.
 * 
 * No tokens, passwords, or personal credentials are required.
 */

// Default repository URL provided by the user
export const DEFAULT_DATABASE_JSON_URL = 'https://raw.githubusercontent.com/Renny0007/Base-de-datos-territorio/refs/heads/main/territorios.json';

// LocalStorage key used if the user customizes the URL from the app interface
export const DATABASE_SYNC_URL_STORAGE_KEY = 'territorios_master_database_url';

/**
 * Returns the currently active URL for database.json (empty if not yet provided by the user)
 */
export function getMasterDatabaseUrl(): string {
  if (typeof window === 'undefined') return DEFAULT_DATABASE_JSON_URL;
  try {
    const custom = localStorage.getItem(DATABASE_SYNC_URL_STORAGE_KEY);
    if (custom && custom.trim()) {
      return custom.trim();
    }
  } catch {
    // Ignore localStorage errors
  }
  return DEFAULT_DATABASE_JSON_URL;
}

/**
 * Checks if a valid URL has been provided for database.json
 */
export function hasMasterDatabaseUrl(): boolean {
  const url = getMasterDatabaseUrl();
  return Boolean(url && url.trim().length > 10 && /^https?:\/\//i.test(url.trim()));
}

/**
 * Updates the master database URL
 */
export function setMasterDatabaseUrl(newUrl: string): void {
  if (typeof window === 'undefined') return;
  try {
    if (!newUrl || !newUrl.trim() || newUrl.trim() === DEFAULT_DATABASE_JSON_URL) {
      localStorage.removeItem(DATABASE_SYNC_URL_STORAGE_KEY);
    } else {
      localStorage.setItem(DATABASE_SYNC_URL_STORAGE_KEY, newUrl.trim());
    }
  } catch {
    // Ignore localStorage errors
  }
}
