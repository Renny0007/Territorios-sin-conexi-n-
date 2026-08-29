import { Territory, MapNote } from '../types';

const EARTH_RADIUS = 6378137; // meters (WGS84)

/**
 * Converts degrees to radians
 */
export function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Converts radians to degrees
 */
export function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/**
 * Calculates geodesic distance between two points in meters using Haversine formula
 */
export function calculateDistance(
  coord1: [number, number],
  coord2: [number, number]
): number {
  const [lat1, lon1] = coord1;
  const [lat2, lon2] = coord2;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS * c;
}

/**
 * Calculates bearing from start to destination in degrees (0 - 360)
 */
export function calculateBearing(
  start: [number, number],
  dest: [number, number]
): number {
  const [lat1, lon1] = start;
  const [lat2, lon2] = dest;

  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δλ = toRad(lon2 - lon1);

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

  const θ = Math.atan2(y, x);
  return (toDeg(θ) + 360) % 360;
}

/**
 * Calculates geodesic area of a polygon in square meters
 * Uses spherical polygon area formula
 */
export function calculatePolygonArea(coords: [number, number][]): number {
  if (coords.length < 3) return 0;

  let total = 0;
  const len = coords.length;

  for (let i = 0; i < len; i++) {
    const p1 = coords[i];
    const p2 = coords[(i + 1) % len];

    const lat1 = toRad(p1[0]);
    const lat2 = toRad(p2[0]);
    const lon1 = toRad(p1[1]);
    const lon2 = toRad(p2[1]);

    total += (lon2 - lon1) * (2 + Math.sin(lat1) + Math.sin(lat2));
  }

  total = (Math.abs(total) * EARTH_RADIUS * EARTH_RADIUS) / 2;
  return total;
}

/**
 * Calculates perimeter of polygon in meters
 */
export function calculatePolygonPerimeter(coords: [number, number][]): number {
  if (coords.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < coords.length; i++) {
    const next = (i + 1) % coords.length;
    total += calculateDistance(coords[i], coords[next]);
  }
  return total;
}

/**
 * Calculates centroid of a polygon [lat, lng]
 */
export function calculateCentroid(coords: [number, number][]): [number, number] {
  if (coords.length === 0) return [0, 0];
  let latSum = 0;
  let lngSum = 0;
  for (const [lat, lng] of coords) {
    latSum += lat;
    lngSum += lng;
  }
  return [latSum / coords.length, lngSum / coords.length];
}

/**
 * Calculates Bounding Box for polygon or points [[south, west], [north, east]]
 */
export function calculateBounds(coords: [number, number][]): [[number, number], [number, number]] {
  if (coords.length === 0) {
    return [[0, 0], [0, 0]];
  }
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;

  for (const [lat, lng] of coords) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }

  return [[minLat, minLng], [maxLat, maxLng]];
}

/**
 * Check if point is inside polygon (Ray-casting)
 */
export function isPointInPolygon(point: [number, number], vs: [number, number][]): boolean {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i][0], yi = vs[i][1];
    const xj = vs[j][0], yj = vs[j][1];

    const intersect = ((yi > y) !== (yj > y)) &&
      (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Calculates the optimal pedestrian access point on a polygon's perimeter
 * closest to the user's starting coordinates [lat, lng].
 */
export function calculateOptimalAccessPoint(
  start: [number, number],
  polygonCoords: [number, number][]
): [number, number] {
  if (polygonCoords.length === 0) return start;
  if (polygonCoords.length === 1) return polygonCoords[0];
  if (polygonCoords.length === 2) {
    return calculateClosestPointOnSegment(start, polygonCoords[0], polygonCoords[1]);
  }

  let minDistance = Infinity;
  let bestPoint: [number, number] = polygonCoords[0];

  const len = polygonCoords.length;
  for (let i = 0; i < len; i++) {
    const p1 = polygonCoords[i];
    const p2 = polygonCoords[(i + 1) % len];

    const closestOnSegment = calculateClosestPointOnSegment(start, p1, p2);
    const dist = calculateDistance(start, closestOnSegment);

    if (dist < minDistance) {
      minDistance = dist;
      bestPoint = closestOnSegment;
    }
  }

  return bestPoint;
}

/**
 * Calculates the closest point on segment AB from point P
 */
export function calculateClosestPointOnSegment(
  p: [number, number],
  a: [number, number],
  b: [number, number]
): [number, number] {
  const [pLat, pLng] = p;
  const [aLat, aLng] = a;
  const [bLat, bLng] = b;

  const dLng = bLng - aLng;
  const dLat = bLat - aLat;

  if (dLng === 0 && dLat === 0) {
    return a;
  }

  // Calculate projection ratio t
  const t = ((pLng - aLng) * dLng + (pLat - aLat) * dLat) / (dLng * dLng + dLat * dLat);

  // Clamp to segment bounds [0, 1]
  const clampedT = Math.max(0, Math.min(1, t));

  return [
    aLat + clampedT * dLat,
    aLng + clampedT * dLng
  ];
}

/**
 * Formats area nicely (m², ha, km²)
 */
export function formatArea(areaM2: number): string {
  if (areaM2 < 10000) {
    return `${Math.round(areaM2).toLocaleString()} m²`;
  }
  if (areaM2 < 1000000) {
    return `${(areaM2 / 10000).toFixed(2)} ha`;
  }
  return `${(areaM2 / 1000000).toFixed(3)} km²`;
}

/**
 * Formats distance (m, km)
 */
export function formatDistance(distM: number): string {
  if (distM < 1000) {
    return `${Math.round(distM)} m`;
  }
  return `${(distM / 1000).toFixed(2)} km`;
}

/**
 * Formats coordinates for tactical display
 */
export function formatCoordinate(lat: number, lng: number): string {
  return `${lat.toFixed(5)}°, ${lng.toFixed(5)}°`;
}

// --- GeoJSON Export / Import ---

export function exportToGeoJSON(territories: Territory[], notes: MapNote[] = []): string {
  const features = [];

  for (const t of territories) {
    // GeoJSON uses [lng, lat]
    const ring = t.coordinates.map(([lat, lng]) => [lng, lat]);
    // Close ring if not closed
    if (ring.length > 0 && (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1])) {
      ring.push(ring[0]);
    }

    features.push({
      type: 'Feature',
      id: t.id,
      properties: {
        code: t.code,
        name: t.name,
        assignedTo: t.assignedTo || '',
        status: t.status,
        priority: t.priority,
        color: t.color,
        areaM2: t.areaM2,
        perimeterM: t.perimeterM,
        description: t.description || '',
        updatedAt: t.updatedAt
      },
      geometry: {
        type: 'Polygon',
        coordinates: [ring]
      }
    });
  }

  for (const n of notes) {
    features.push({
      type: 'Feature',
      id: n.id,
      properties: {
        type: 'map_note',
        title: n.title,
        description: n.description,
        category: n.category,
        address: n.address || '',
        status: n.status || 'abierto',
        territoryId: n.territoryId || ''
      },
      geometry: {
        type: 'Point',
        coordinates: [n.coordinate[1], n.coordinate[0]]
      }
    });
  }

  const geoJson = {
    type: 'FeatureCollection',
    name: 'Territorios Offline',
    features
  };

  return JSON.stringify(geoJson, null, 2);
}

export function parseGeoJSON(geoJsonStr: string): { territories: Partial<Territory>[]; notes: Partial<MapNote>[] } {
  const data = JSON.parse(geoJsonStr);
  const territories: Partial<Territory>[] = [];
  const notes: Partial<MapNote>[] = [];

  const features = data.features || (data.type === 'Feature' ? [data] : []);

  for (const feature of features) {
    const geom = feature.geometry;
    const props = feature.properties || {};

    if (!geom) continue;

    if (geom.type === 'Polygon' || geom.type === 'MultiPolygon') {
      let rawRing: number[][] = [];
      if (geom.type === 'Polygon' && geom.coordinates && geom.coordinates[0]) {
        rawRing = geom.coordinates[0];
      } else if (geom.type === 'MultiPolygon' && geom.coordinates && geom.coordinates[0] && geom.coordinates[0][0]) {
        rawRing = geom.coordinates[0][0];
      }

      if (rawRing.length >= 3) {
        // Convert [lng, lat] -> [lat, lng]
        const coords: [number, number][] = rawRing.map(pt => [pt[1], pt[0]]);
        
        // Remove trailing identical point if closed
        if (coords.length > 3 && coords[0][0] === coords[coords.length - 1][0] && coords[0][1] === coords[coords.length - 1][1]) {
          coords.pop();
        }

        const area = calculatePolygonArea(coords);
        const perim = calculatePolygonPerimeter(coords);
        const cent = calculateCentroid(coords);

        territories.push({
          id: feature.id ? String(feature.id) : `t_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          code: props.code || props.number || props.codigo || `T-${Math.floor(100 + Math.random() * 900)}`,
          name: props.name || props.nombre || 'Territorio Importado',
          assignedTo: props.assignedTo || props.asignado || props.assigned || '',
          status: props.status || 'activo',
          priority: props.priority || 'media',
          color: props.color || '#10b981',
          coordinates: coords,
          areaM2: area,
          perimeterM: perim,
          centroid: cent,
          description: props.description || '',
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
      }
    } else if (geom.type === 'Point') {
      const [lng, lat] = geom.coordinates;
      notes.push({
        id: feature.id ? String(feature.id) : `n_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        title: props.title || props.name || 'Nota Importada',
        description: props.description || '',
        category: props.category || 'general',
        coordinate: [lat, lng],
        address: props.address || '',
        status: props.status || 'abierto',
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
    }
  }

  return { territories, notes };
}

// --- KML Export / Import ---

export function exportToKML(territories: Territory[], notes: MapNote[] = []): string {
  let placemarks = '';

  for (const t of territories) {
    const coordsStr = t.coordinates
      .map(([lat, lng]) => `${lng},${lat},0`)
      .concat(`${t.coordinates[0][1]},${t.coordinates[0][0]},0`)
      .join(' ');

    const hexColor = t.color.replace('#', '');
    // KML uses aabbggrr format, we can use standard 8-char hex
    const kmlColor = `99${hexColor.substring(4, 6)}${hexColor.substring(2, 4)}${hexColor.substring(0, 2)}`;

    placemarks += `
    <Placemark>
      <name>${escapeXml(t.code)} - ${escapeXml(t.name)}</name>
      <description><![CDATA[
        <b>Código:</b> ${t.code}<br/>
        <b>Nombre:</b> ${t.name}<br/>
        <b>Asignado a:</b> ${t.assignedTo || 'Sin asignar'}<br/>
        <b>Estado:</b> ${t.status}<br/>
        <b>Área:</b> ${formatArea(t.areaM2)}<br/>
        <b>Perímetro:</b> ${formatDistance(t.perimeterM)}<br/>
        <b>Notas:</b> ${t.description || ''}
      ]]></description>
      <Style>
        <LineStyle>
          <color>ff${hexColor.substring(4, 6)}${hexColor.substring(2, 4)}${hexColor.substring(0, 2)}</color>
          <width>3</width>
        </LineStyle>
        <PolyStyle>
          <color>${kmlColor}</color>
          <fill>1</fill>
          <outline>1</outline>
        </PolyStyle>
      </Style>
      <ExtendedData>
        <Data name="code"><value>${escapeXml(t.code)}</value></Data>
        <Data name="assignedTo"><value>${escapeXml(t.assignedTo || '')}</value></Data>
        <Data name="status"><value>${t.status}</value></Data>
        <Data name="color"><value>${t.color}</value></Data>
      </ExtendedData>
      <Polygon>
        <extrude>1</extrude>
        <altitudeMode>clampToGround</altitudeMode>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>${coordsStr}</coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>`;
  }

  for (const n of notes) {
    placemarks += `
    <Placemark>
      <name>${escapeXml(n.title)}</name>
      <description><![CDATA[
        <b>Categoría:</b> ${n.category}<br/>
        <b>Dirección:</b> ${n.address || 'N/A'}<br/>
        <b>Detalles:</b> ${n.description}
      ]]></description>
      <Point>
        <coordinates>${n.coordinate[1]},${n.coordinate[0]},0</coordinates>
      </Point>
    </Placemark>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Territorios Offline - Exportación</name>
    <description>Polígonos y puntos generados por Territorios Offline</description>
    ${placemarks}
  </Document>
</kml>`;
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

export function parseKML(kmlStr: string): { territories: Partial<Territory>[]; notes: Partial<MapNote>[] } {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(kmlStr, 'text/xml');
  const placemarks = xmlDoc.getElementsByTagName('Placemark');

  const territories: Partial<Territory>[] = [];
  const notes: Partial<MapNote>[] = [];

  for (let i = 0; i < placemarks.length; i++) {
    const pm = placemarks[i];
    const name = pm.getElementsByTagName('name')[0]?.textContent || `Elemento ${i + 1}`;
    const desc = pm.getElementsByTagName('description')[0]?.textContent || '';

    // Check for Polygon
    const polygonElem = pm.getElementsByTagName('Polygon')[0];
    if (polygonElem) {
      const coordElem = polygonElem.getElementsByTagName('coordinates')[0];
      if (coordElem && coordElem.textContent) {
        const rawCoords = coordElem.textContent.trim().split(/\s+/);
        const points: [number, number][] = [];

        for (const raw of rawCoords) {
          const parts = raw.split(',').map(s => parseFloat(s.trim()));
          if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
            // KML is [lng, lat, alt] -> convert to [lat, lng]
            points.push([parts[1], parts[0]]);
          }
        }

        if (points.length >= 3) {
          // Remove duplicate closed end
          if (points.length > 3 && points[0][0] === points[points.length - 1][0] && points[0][1] === points[points.length - 1][1]) {
            points.pop();
          }

          const area = calculatePolygonArea(points);
          const perim = calculatePolygonPerimeter(points);
          const cent = calculateCentroid(points);

          // Extract code and clean name from Placemark (e.g. "18 (#2) - Norte" or "18 (#2)" or "T-102 - Norte")
          let code = `T-${100 + i}`;
          let cleanName = name;
          if (name.includes(' - ')) {
            const parts = name.split(' - ');
            code = parts[0].trim();
            cleanName = parts.slice(1).join(' - ').trim() || name;
          } else if (name.includes('-') && !name.includes('(')) {
            const parts = name.split('-');
            code = parts[0].trim();
            cleanName = parts.slice(1).join('-').trim() || name;
          } else if (/^\d+/.test(name)) {
            // e.g. "18 (#2)" or "17 (03)"
            code = name.trim();
            cleanName = name.trim();
          }

          territories.push({
            id: `t_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            code,
            name: cleanName,
            status: 'activo',
            priority: 'media',
            color: '#10b981',
            coordinates: points,
            areaM2: area,
            perimeterM: perim,
            centroid: cent,
            description: desc,
            createdAt: Date.now(),
            updatedAt: Date.now()
          });
        }
      }
    }

    // Check for Point
    const pointElem = pm.getElementsByTagName('Point')[0];
    if (pointElem) {
      const coordElem = pointElem.getElementsByTagName('coordinates')[0];
      if (coordElem && coordElem.textContent) {
        const parts = coordElem.textContent.trim().split(',').map(s => parseFloat(s.trim()));
        if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
          notes.push({
            id: `n_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            title: name,
            description: desc,
            category: 'general',
            coordinate: [parts[1], parts[0]],
            status: 'abierto',
            createdAt: Date.now(),
            updatedAt: Date.now()
          });
        }
      }
    }
  }

  return { territories, notes };
}

/**
 * Resolves the full display identifier/number for a territory,
 * ensuring that multi-digit numbers, parentheses, hashtags, or sub-identifiers
 * (e.g. "18 (#2)", "17 (03)", "18 (# 2)", "T-18 (#2)") are fully encompassed
 * and not truncated to a single digit like "1".
 */
export function getTerritoryDisplayCode(territory: { code?: string; name?: string }): string {
  const code = (territory.code || '').trim();
  const name = (territory.name || '').trim();

  // If code is already complete and contains details/parentheses
  if (code && (code.includes('(') || code.includes('#') || code.length > 2)) {
    // If name has a parenthesized sub-number not in code
    const parenMatchInName = name.match(/\([^\)]+\)/);
    if (!code.includes('(') && parenMatchInName) {
      return `${code} ${parenMatchInName[0]}`;
    }
    return code;
  }

  // Check if name begins with a full number + parentheses pattern e.g. "18 (#2)" or "17 (03)"
  const fullNumWithParenMatch = name.match(/^(\d+[\w\-]*\s*\([^\)]+\))/);
  if (fullNumWithParenMatch) {
    return fullNumWithParenMatch[1];
  }

  // Check if name has parentheses e.g. "(#2)" or "(03)" while code has a number e.g. "18" or "17"
  const parenOnlyMatch = name.match(/\([^\)]+\)/);
  if (code && parenOnlyMatch) {
    if (!code.includes(parenOnlyMatch[0])) {
      return `${code} ${parenOnlyMatch[0]}`;
    }
  }

  // If code is short (like "1") and name starts with digits + parentheses e.g. "18 (#2)" or "17 (03)"
  const startsWithNumAndParen = name.match(/^(\d+[\s\S]*?\))/);
  if (startsWithNumAndParen) {
    return startsWithNumAndParen[1];
  }

  // If name itself is short and formatted like an identifier (e.g. "18 (#2)" or "17 (03)")
  if (name && (name.includes('(') || name.includes('#')) && name.length <= 25) {
    return name;
  }

  return code || name || 'T-1';
}

