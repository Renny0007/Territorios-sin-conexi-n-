import { OfflineRoutingGraph, ActiveRoute, RouteStep, RouteStepType } from '../types';
import { calculateDistance, calculateBearing, formatDistance } from './geoUtils';
import { dbService } from './db';

/**
 * Fetches OpenStreetMap highway data for a bounding box and compiles
 * an optimized spatial pedestrian adjacency graph.
 */
export async function downloadOsmPedestrianGraph(
  packageId: string,
  packageName: string,
  bounds: [[number, number], [number, number]],
  abortSignal?: AbortSignal
): Promise<OfflineRoutingGraph | null> {
  const [[south, west], [north, east]] = bounds;

  // Overpass QL query filtering for walkable road types, excluding foot=no and access=no
  const query = `[out:json][timeout:25];(way["highway"~"^(footway|pedestrian|path|residential|service|living_street|track|steps|unclassified|tertiary|secondary|primary|cycleway)$"]["foot"!="no"]["access"!="no"](${south},${west},${north},${east}););out body;>;out skel qt;`;

  const endpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://lz4.overpass-api.de/api/interpreter',
    'https://z.overpass-api.de/api/interpreter'
  ];

  let rawData: any = null;

  for (const url of endpoints) {
    if (abortSignal?.aborted) return null;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: abortSignal
      });

      if (response.ok) {
        rawData = await response.json();
        if (rawData && rawData.elements) {
          break;
        }
      }
    } catch {
      // Try next mirror
    }
  }

  if (!rawData || !Array.isArray(rawData.elements) || rawData.elements.length === 0) {
    return null;
  }

  const nodes: Record<string, [number, number]> = {};
  const adjacency: Record<string, Array<{ to: string; dist: number; name?: string }>> = {};

  // First pass: index all nodes
  for (const elem of rawData.elements) {
    if (elem.type === 'node' && elem.id !== undefined && elem.lat !== undefined && elem.lon !== undefined) {
      nodes[String(elem.id)] = [elem.lat, elem.lon];
    }
  }

  let edgeCount = 0;

  // Second pass: parse ways and create bidirectional graph edges
  for (const elem of rawData.elements) {
    if (elem.type === 'way' && Array.isArray(elem.nodes) && elem.nodes.length >= 2) {
      const wayName = elem.tags?.name || elem.tags?.ref || undefined;
      const wayNodes: number[] = elem.nodes;

      for (let i = 0; i < wayNodes.length - 1; i++) {
        const uStr = String(wayNodes[i]);
        const vStr = String(wayNodes[i + 1]);

        const uCoord = nodes[uStr];
        const vCoord = nodes[vStr];

        if (uCoord && vCoord) {
          const dist = calculateDistance(uCoord, vCoord);

          if (!adjacency[uStr]) adjacency[uStr] = [];
          if (!adjacency[vStr]) adjacency[vStr] = [];

          adjacency[uStr].push({ to: vStr, dist, name: wayName });
          adjacency[vStr].push({ to: uStr, dist, name: wayName });
          edgeCount += 2;
        }
      }
    }
  }

  const nodeCount = Object.keys(nodes).length;

  const graph: OfflineRoutingGraph = {
    id: packageId,
    name: packageName,
    bounds,
    createdAt: Date.now(),
    nodeCount,
    edgeCount,
    nodes,
    adjacency
  };

  return graph;
}

/**
 * Finds the closest node in the graph to a given coordinate [lat, lng]
 */
function findClosestNode(
  coord: [number, number],
  nodes: Record<string, [number, number]>
): { nodeId: string; coord: [number, number]; distanceM: number } | null {
  let minDistance = Infinity;
  let closestId: string | null = null;

  for (const [id, nodeCoord] of Object.entries(nodes)) {
    const dist = calculateDistance(coord, nodeCoord);
    if (dist < minDistance) {
      minDistance = dist;
      closestId = id;
    }
  }

  if (!closestId) return null;
  return { nodeId: closestId, coord: nodes[closestId], distanceM: minDistance };
}

/**
 * A* (A-Star) Pathfinding Algorithm on the offline pedestrian street graph
 */
export function findOfflinePathAStar(
  start: [number, number],
  destination: [number, number],
  graph: OfflineRoutingGraph
): { pathCoordinates: [number, number][]; totalDistanceM: number; wayNames: string[] } | null {
  const startSnap = findClosestNode(start, graph.nodes);
  const destSnap = findClosestNode(destination, graph.nodes);

  if (!startSnap || !destSnap) return null;

  const startId = startSnap.nodeId;
  const destId = destSnap.nodeId;

  if (startId === destId) {
    return {
      pathCoordinates: [start, startSnap.coord, destination],
      totalDistanceM: calculateDistance(start, startSnap.coord) + calculateDistance(startSnap.coord, destination),
      wayNames: []
    };
  }

  // Priority Queue / Open Set for A*
  const openSet = new Set<string>([startId]);
  const cameFrom: Record<string, { from: string; name?: string; dist: number }> = {};

  const gScore: Record<string, number> = {};
  gScore[startId] = 0;

  const fScore: Record<string, number> = {};
  fScore[startId] = calculateDistance(startSnap.coord, destSnap.coord);

  while (openSet.size > 0) {
    // Find node in openSet with lowest fScore
    let currentId: string | null = null;
    let lowestF = Infinity;

    for (const nodeId of openSet) {
      const score = fScore[nodeId] ?? Infinity;
      if (score < lowestF) {
        lowestF = score;
        currentId = nodeId;
      }
    }

    if (!currentId) break;

    // Destination reached
    if (currentId === destId) {
      // Reconstruct path
      const pathIds: string[] = [destId];
      const wayNames: string[] = [];
      let curr = destId;

      while (cameFrom[curr]) {
        const step = cameFrom[curr];
        if (step.name && !wayNames.includes(step.name)) {
          wayNames.push(step.name);
        }
        curr = step.from;
        pathIds.unshift(curr);
      }

      const pathCoordinates: [number, number][] = [start];
      for (const id of pathIds) {
        pathCoordinates.push(graph.nodes[id]);
      }
      pathCoordinates.push(destination);

      const totalDistanceM =
        calculateDistance(start, startSnap.coord) +
        gScore[destId] +
        calculateDistance(destSnap.coord, destination);

      return {
        pathCoordinates,
        totalDistanceM,
        wayNames
      };
    }

    openSet.delete(currentId);

    const neighbors = graph.adjacency[currentId] || [];
    const currentG = gScore[currentId] ?? Infinity;

    for (const neighbor of neighbors) {
      const tentativeG = currentG + neighbor.dist;
      const neighborG = gScore[neighbor.to] ?? Infinity;

      if (tentativeG < neighborG) {
        cameFrom[neighbor.to] = { from: currentId, name: neighbor.name, dist: neighbor.dist };
        gScore[neighbor.to] = tentativeG;

        const neighborCoord = graph.nodes[neighbor.to];
        const h = neighborCoord ? calculateDistance(neighborCoord, destSnap.coord) : 0;
        fScore[neighbor.to] = tentativeG + h;

        openSet.add(neighbor.to);
      }
    }
  }

  return null;
}

/**
 * Calculates a pedestrian route using offline graph data from IndexedDB
 */
export async function calculateOfflinePedestrianRoute(
  start: [number, number],
  destination: [number, number],
  targetName: string,
  targetType: 'territory' | 'note' | 'custom' = 'territory'
): Promise<ActiveRoute | null> {
  const graphs = await dbService.getAllRoutingGraphs();
  if (!graphs || graphs.length === 0) {
    return null;
  }

  // Find a graph whose bounds encompass the start/dest coordinates or has closest coverage
  let bestGraph: OfflineRoutingGraph | null = null;
  let minPaddingDistance = Infinity;

  for (const graph of graphs) {
    const [[south, west], [north, east]] = graph.bounds;
    // Add a 1km safety margin to the bounding box
    const latMargin = 0.01;
    const lngMargin = 0.01;

    const inBoundsStart =
      start[0] >= south - latMargin &&
      start[0] <= north + latMargin &&
      start[1] >= west - lngMargin &&
      start[1] <= east + lngMargin;

    const inBoundsDest =
      destination[0] >= south - latMargin &&
      destination[0] <= north + latMargin &&
      destination[1] >= west - lngMargin &&
      destination[1] <= east + lngMargin;

    if (inBoundsStart || inBoundsDest) {
      bestGraph = graph;
      break;
    }
  }

  if (!bestGraph) {
    // Pick the most recently created graph as fallback
    bestGraph = graphs[0];
  }

  if (!bestGraph || Object.keys(bestGraph.nodes).length === 0) {
    return null;
  }

  const aStarResult = findOfflinePathAStar(start, destination, bestGraph);
  if (!aStarResult || aStarResult.pathCoordinates.length < 2) {
    return null;
  }

  const walkingSpeedMPerSec = 4.5 * (1000 / 3600); // 4.5 km/h
  const durationSec = Math.round(aStarResult.totalDistanceM / walkingSpeedMPerSec);

  const steps: RouteStep[] = [
    {
      instruction: `Inicia ruta peatonal sin conexión hacia ${targetName}`,
      distanceM: aStarResult.totalDistanceM,
      durationSec,
      type: 'depart',
      coordinates: start
    },
    {
      instruction: aStarResult.wayNames.length > 0 
        ? `Sigue por ${aStarResult.wayNames.slice(0, 3).join(', ')}` 
        : `Camina por la red de calles peatonales guardada`,
      distanceM: aStarResult.totalDistanceM,
      durationSec,
      type: 'straight',
      coordinates: aStarResult.pathCoordinates[Math.floor(aStarResult.pathCoordinates.length / 2)]
    },
    {
      instruction: `Llegada al punto de acceso de ${targetName}`,
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
    polyline: aStarResult.pathCoordinates,
    distanceM: aStarResult.totalDistanceM,
    durationSec,
    steps,
    isOfflineFallback: false
  };
}
