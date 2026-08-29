export type TerritoryStatus = 'activo' | 'en_progreso' | 'completado' | 'pendiente' | 'archivado';
export type TerritoryPriority = 'baja' | 'media' | 'alta' | 'urgente';

export interface Territory {
  id: string;
  code: string;
  name: string;
  assignedTo?: string;
  status: TerritoryStatus;
  priority: TerritoryPriority;
  color: string;
  coordinates: [number, number][]; // [lat, lng] array
  areaM2: number;
  perimeterM: number;
  centroid: [number, number];
  description?: string;
  tags?: string[];
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
}

export type NoteCategory = 
  | 'visita' 
  | 'no_en_casa' 
  | 'impedimento' 
  | 'revisitar' 
  | 'general' 
  | 'peligro';

export interface MapNote {
  id: string;
  territoryId?: string;
  title: string;
  description: string;
  category: NoteCategory;
  coordinate: [number, number]; // [lat, lng]
  address?: string;
  status?: 'abierto' | 'resuelto';
  createdAt: number;
  updatedAt: number;
}

export interface TilePackage {
  id: string;
  name: string;
  bounds: [[number, number], [number, number]]; // [[south, west], [north, east]]
  minZoom: number;
  maxZoom: number;
  totalTiles: number;
  downloadedTiles: number;
  sizeBytes: number;
  provider: string;
  createdAt: number;
  status: 'downloading' | 'completed' | 'error' | 'paused';
}

export interface OfflineTile {
  key: string; // provider_z_x_y
  packageId?: string;
  dataUrl: string;
  timestamp: number;
}

export interface OfflineRoutingGraph {
  id: string; // packageId or custom zone id
  name: string;
  bounds: [[number, number], [number, number]]; // [[south, west], [north, east]]
  createdAt: number;
  nodeCount: number;
  edgeCount: number;
  nodes: Record<string, [number, number]>; // nodeId -> [lat, lng]
  adjacency: Record<string, Array<{ to: string; dist: number; name?: string }>>; // nodeId -> array of edges
}

export interface GPSState {
  active: boolean;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  altitude: number | null;
  heading: number | null;
  speed: number | null;
  timestamp: number | null;
  error: string | null;
  simulated?: boolean;
}

export type RouteStepType = 
  | 'depart' 
  | 'straight' 
  | 'turn-left' 
  | 'turn-right' 
  | 'slight-left' 
  | 'slight-right' 
  | 'u-turn' 
  | 'arrive';

export interface RouteStep {
  instruction: string;
  distanceM: number;
  durationSec: number;
  type: RouteStepType;
  coordinates: [number, number];
}

export interface ActiveRoute {
  targetName: string;
  targetType: 'territory' | 'note' | 'custom';
  destination: [number, number];
  polyline: [number, number][];
  distanceM: number;
  durationSec: number;
  steps: RouteStep[];
  isOfflineFallback: boolean;
}

export type MapProviderId = 'carto_dark' | 'osm_standard' | 'esri_satellite' | 'opentopo';

export interface MapProviderConfig {
  id: MapProviderId;
  name: string;
  url: string;
  subdomains?: string[];
  maxZoom: number;
  attribution: string;
}

export interface AppSettings {
  mapProvider: MapProviderId;
  tacticalMode: boolean;
  gpsAutoCenter: boolean;
  gpsAccuracyThresholdM: number;
  measurementUnit: 'metric' | 'imperial';
  defaultWalkSpeedKmH: number;
  customTileUrl?: string;
}

export type LabelFontSize = 'sm' | 'md' | 'lg' | 'xl';

export interface MapLabel {
  id: string;
  text: string;
  lat: number;
  lng: number;
  territoryId?: string;
  fontSize?: LabelFontSize;
  color?: string; // Optional custom color highlight
  createdAt: number;
  updatedAt: number;
}

export type DrawingToolMode = 'none' | 'polygon' | 'rectangle' | 'letter';

export type ActiveTab = 'map' | 'territories' | 'offline' | 'notes' | 'settings';
