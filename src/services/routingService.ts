import { ActiveRoute, RouteStep, RouteStepType } from '../types';
import { calculateDistance, calculateBearing, formatDistance } from './geoUtils';
import { calculateOfflinePedestrianRoute } from './offlineRoutingEngine';

export async function calculatePedestrianRoute(
  start: [number, number],
  destination: [number, number],
  targetName: string,
  targetType: 'territory' | 'note' | 'custom' = 'territory'
): Promise<ActiveRoute> {
  const [startLat, startLng] = start;
  const [destLat, destLng] = destination;

  // 1. If online, try OSRM Foot Routing API first
  if (navigator.onLine) {
    try {
      const osrmUrl = `https://router.project-osrm.org/route/v1/foot/${startLng},${startLat};${destLng},${destLat}?overview=full&geometries=geojson&steps=true`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const response = await fetch(osrmUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        if (data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          const coordinates: [number, number][] = route.geometry.coordinates.map(
            (c: [number, number]) => [c[1], c[0]] // convert [lng, lat] to [lat, lng]
          );

          const steps: RouteStep[] = [];
          if (route.legs && route.legs[0] && route.legs[0].steps) {
            for (const s of route.legs[0].steps) {
              const maneuverType = s.maneuver?.type || 'straight';
              const modifier = s.maneuver?.modifier || '';
              const stepType = mapOsrmManeuver(maneuverType, modifier);
              const stepCoord: [number, number] = [
                s.maneuver?.location[1] || startLat,
                s.maneuver?.location[0] || startLng
              ];

              let instruction = s.name ? `Por ${s.name}` : 'Continúa recto';
              if (maneuverType === 'depart') {
                instruction = `Inicia marcha en dirección a ${targetName}`;
              } else if (maneuverType === 'arrive') {
                instruction = `Llegada a destino: ${targetName}`;
              } else if (modifier.includes('left')) {
                instruction = `Gira a la izquierda ${s.name ? 'hacia ' + s.name : ''}`;
              } else if (modifier.includes('right')) {
                instruction = `Gira a la derecha ${s.name ? 'hacia ' + s.name : ''}`;
              }

              steps.push({
                instruction,
                distanceM: s.distance || 0,
                durationSec: s.duration || 0,
                type: stepType,
                coordinates: stepCoord
              });
            }
          }

          return {
            targetName,
            targetType,
            destination,
            polyline: coordinates,
            distanceM: route.distance,
            durationSec: route.duration,
            steps: steps.length > 0 ? steps : createFallbackSteps(start, destination, targetName),
            isOfflineFallback: false
          };
        }
      }
    } catch {
      // Network or OSRM error, proceed to offline pedestrian routing
    }
  }

  // 2. Offline Pedestrian Street Routing from IndexedDB (A* on downloaded OSM street graph)
  try {
    const offlineRoute = await calculateOfflinePedestrianRoute(start, destination, targetName, targetType);
    if (offlineRoute) {
      return offlineRoute;
    }
  } catch (err) {
    console.warn('Error in offline graph routing:', err);
  }

  // 3. Fallback direct bearing if no offline street graph has been downloaded for this sector yet
  return createOfflineDirectRoute(start, destination, targetName, targetType);
}

function mapOsrmManeuver(type: string, modifier: string): RouteStepType {
  if (type === 'depart') return 'depart';
  if (type === 'arrive') return 'arrive';
  if (modifier === 'left' || modifier === 'sharp left') return 'turn-left';
  if (modifier === 'right' || modifier === 'sharp right') return 'turn-right';
  if (modifier === 'slight left') return 'slight-left';
  if (modifier === 'slight right') return 'slight-right';
  if (modifier === 'uturn') return 'u-turn';
  return 'straight';
}

function createOfflineDirectRoute(
  start: [number, number],
  destination: [number, number],
  targetName: string,
  targetType: 'territory' | 'note' | 'custom'
): ActiveRoute {
  const directDistance = calculateDistance(start, destination);
  const bearing = Math.round(calculateBearing(start, destination));
  const walkingSpeedMPerSec = 4.5 * (1000 / 3600); // 4.5 km/h = 1.25 m/s
  const durationSec = Math.round(directDistance / walkingSpeedMPerSec);

  // Generate intermediate waypoint line (10 points)
  const polyline: [number, number][] = [];
  const segments = 10;
  for (let i = 0; i <= segments; i++) {
    const fraction = i / segments;
    const lat = start[0] + (destination[0] - start[0]) * fraction;
    const lng = start[1] + (destination[1] - start[1]) * fraction;
    polyline.push([lat, lng]);
  }

  const steps: RouteStep[] = [
    {
      instruction: `Inicia rumbo directo ${bearing}° hacia ${targetName}`,
      distanceM: directDistance,
      durationSec,
      type: 'depart',
      coordinates: start
    },
    {
      instruction: `Continúa recto campo a través (${formatDistance(directDistance)})`,
      distanceM: directDistance,
      durationSec,
      type: 'straight',
      coordinates: polyline[Math.floor(segments / 2)]
    },
    {
      instruction: `Llegada a destino: ${targetName}`,
      distanceM: 0,
      durationSec: 0,
      type: 'arrive',
      coordinates: destination
    }
  ];

  return {
    targetName,
    targetType,
    destination,
    polyline,
    distanceM: directDistance,
    durationSec,
    steps,
    isOfflineFallback: true
  };
}

function createFallbackSteps(start: [number, number], destination: [number, number], targetName: string): RouteStep[] {
  const dist = calculateDistance(start, destination);
  return [
    {
      instruction: `Camina hacia ${targetName}`,
      distanceM: dist,
      durationSec: Math.round(dist / 1.25),
      type: 'straight',
      coordinates: start
    },
    {
      instruction: `Llegada a ${targetName}`,
      distanceM: 0,
      durationSec: 0,
      type: 'arrive',
      coordinates: destination
    }
  ];
}
