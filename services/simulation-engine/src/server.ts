import express from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import dotenv from 'dotenv';
import { CrowdState, Incident, TransitStatus } from '@stadiumpulse/shared-types';

dotenv.config({ path: '../../.env' });

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT_SIMULATION_ENGINE || 3002;
const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer });

// Initial State
let crowdState: CrowdState[] = [
  {
    zoneId: 'gate-a',
    zoneName: 'Gate A (East Entrance)',
    currentCount: 2800,
    maxCapacity: 15000,
    densityLevel: 'low',
    updatedAt: new Date().toISOString(),
  },
  {
    zoneId: 'gate-b',
    zoneName: 'Gate B (North Entrance)',
    currentCount: 4200,
    maxCapacity: 15000,
    densityLevel: 'medium',
    updatedAt: new Date().toISOString(),
  },
  {
    zoneId: 'gate-c',
    zoneName: 'Gate C (South Entrance)',
    currentCount: 4500,
    maxCapacity: 15000,
    densityLevel: 'medium',
    updatedAt: new Date().toISOString(),
  },
  {
    zoneId: 'gate-d',
    zoneName: 'Gate D (West Entrance - ADA Accessible)',
    currentCount: 1800,
    maxCapacity: 15000,
    densityLevel: 'low',
    updatedAt: new Date().toISOString(),
  },
  {
    zoneId: 'concourse-l1',
    zoneName: 'Concourse Level 1',
    currentCount: 11500,
    maxCapacity: 25000,
    densityLevel: 'medium',
    updatedAt: new Date().toISOString(),
  },
  {
    zoneId: 'concourse-l2',
    zoneName: 'Concourse Level 2',
    currentCount: 7800,
    maxCapacity: 25000,
    densityLevel: 'low',
    updatedAt: new Date().toISOString(),
  },
  {
    zoneId: 'seating-lower',
    zoneName: 'Seating Bowl Lower',
    currentCount: 14500,
    maxCapacity: 30000,
    densityLevel: 'medium',
    updatedAt: new Date().toISOString(),
  },
  {
    zoneId: 'seating-upper',
    zoneName: 'Seating Bowl Upper',
    currentCount: 11200,
    maxCapacity: 30000,
    densityLevel: 'low',
    updatedAt: new Date().toISOString(),
  },
];

let transitStatus: TransitStatus[] = [
  {
    routeId: 'shuttle-a',
    name: 'Shuttle Route A (Parking Lot A)',
    type: 'shuttle',
    status: 'on-time',
    nextDeparture: '3 mins',
    congestion: 'low',
  },
  {
    routeId: 'shuttle-b',
    name: 'Shuttle Route B (Parking Lot B)',
    type: 'shuttle',
    status: 'on-time',
    nextDeparture: '5 mins',
    congestion: 'low',
  },
  {
    routeId: 'train-njt',
    name: 'NJ Transit Train (Secaucus Junction)',
    type: 'train',
    status: 'on-time',
    nextDeparture: '8 mins',
    congestion: 'medium',
  },
  {
    routeId: 'bus-101',
    name: 'Express Bus Line 101 (Manhattan)',
    type: 'bus',
    status: 'on-time',
    nextDeparture: '12 mins',
    congestion: 'low',
  },
];

let incidents: Incident[] = [
  {
    id: 'inc-0',
    zoneId: 'concourse-l1',
    title: 'Clean-up required near Section 112',
    severity: 'low',
    status: 'resolved',
    description: 'Minor beverage spill. Custodial staff resolved the issue.',
    timestamp: new Date(Date.now() - 30 * 60000).toISOString(),
  },
];

// Helper to determine density level
function getDensityLevel(current: number, max: number): 'low' | 'medium' | 'high' | 'critical' {
  const ratio = current / max;
  if (ratio >= 0.85) return 'critical';
  if (ratio >= 0.65) return 'high';
  if (ratio >= 0.35) return 'medium';
  return 'low';
}

// Broadcast helper
function broadcast(data: any) {
  const message = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Periodically broadcast state to all clients
setInterval(() => {
  // Add minor random fluctuation to crowd state (simulate people moving)
  crowdState = crowdState.map((zone) => {
    // If it's in a critical/high state due to manual trigger, don't fluctuate it down too fast
    const change = Math.floor((Math.random() - 0.5) * 80);
    const newCount = Math.max(100, Math.min(zone.maxCapacity, zone.currentCount + change));
    return {
      ...zone,
      currentCount: newCount,
      densityLevel: getDensityLevel(newCount, zone.maxCapacity),
      updatedAt: new Date().toISOString(),
    };
  });

  broadcast({
    type: 'TELEMETRY_UPDATE',
    payload: {
      crowdState,
      transitStatus,
      incidents: incidents.filter((i) => i.status === 'active'), // Send only active incidents or all?
    },
  });
}, 3000);

// REST API Endpoints
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'simulation-engine' });
});

app.get('/api/crowd', (req, res) => {
  res.json(crowdState);
});

app.get('/api/transit', (req, res) => {
  res.json(transitStatus);
});

app.get('/api/incidents', (req, res) => {
  res.json(incidents);
});

// Trigger Congestion Spikes for Demo Script
app.post('/api/simulate/crowd', (req, res) => {
  const { zoneId, count, density } = req.body;
  const zone = crowdState.find((z) => z.zoneId === zoneId);
  if (!zone) {
    return res.status(404).json({ error: 'Zone not found' });
  }

  zone.currentCount = count ?? zone.currentCount;
  if (density) {
    zone.densityLevel = density;
  } else {
    zone.densityLevel = getDensityLevel(zone.currentCount, zone.maxCapacity);
  }
  zone.updatedAt = new Date().toISOString();

  broadcast({
    type: 'TELEMETRY_UPDATE',
    payload: { crowdState, transitStatus, incidents },
  });

  console.log(
    `[Simulator] Manual crowd spike in ${zoneId}: Count ${zone.currentCount}, Density ${zone.densityLevel}`,
  );
  res.json({ message: 'Crowd simulation updated', zone });
});

// Trigger Transit Status Changes
app.post('/api/simulate/transit', (req, res) => {
  const { routeId, status, congestion, nextDeparture } = req.body;
  const route = transitStatus.find((r) => r.routeId === routeId);
  if (!route) {
    return res.status(404).json({ error: 'Transit route not found' });
  }

  route.status = status ?? route.status;
  route.congestion = congestion ?? route.congestion;
  route.nextDeparture = nextDeparture ?? route.nextDeparture;

  broadcast({
    type: 'TELEMETRY_UPDATE',
    payload: { crowdState, transitStatus, incidents },
  });

  console.log(
    `[Simulator] Manual transit update for ${routeId}: Status ${route.status}, Congestion ${route.congestion}`,
  );
  res.json({ message: 'Transit status updated', route });
});

// Trigger/Resolve Incidents
app.post('/api/simulate/incident', (req, res) => {
  const { action, id, zoneId, title, severity, description } = req.body;

  if (action === 'create') {
    const newIncident: Incident = {
      id: id ?? `inc-${incidents.length + 1}`,
      zoneId: zoneId ?? 'gate-c',
      title: title ?? 'Gate C Access Point Congestion',
      severity: severity ?? 'high',
      status: 'active',
      description: description ?? 'High density crowd flow slowing down barcode scans.',
      timestamp: new Date().toISOString(),
    };
    incidents.unshift(newIncident);

    // Also automatically update matching crowd zone to critical
    const matchingZone = crowdState.find((z) => z.zoneId === zoneId);
    if (matchingZone) {
      matchingZone.currentCount = Math.floor(matchingZone.maxCapacity * 0.92);
      matchingZone.densityLevel = 'critical';
    }

    broadcast({
      type: 'TELEMETRY_UPDATE',
      payload: { crowdState, transitStatus, incidents },
    });

    console.log(`[Simulator] Incident created: ${newIncident.title} in zone ${newIncident.zoneId}`);
    return res.json({ message: 'Incident created', incident: newIncident });
  } else if (action === 'resolve') {
    const incident = incidents.find((i) => i.id === id);
    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }
    incident.status = 'resolved';

    // Bring crowd density back to medium/low
    const matchingZone = crowdState.find((z) => z.zoneId === incident.zoneId);
    if (matchingZone) {
      matchingZone.currentCount = Math.floor(matchingZone.maxCapacity * 0.4);
      matchingZone.densityLevel = 'medium';
    }

    broadcast({
      type: 'TELEMETRY_UPDATE',
      payload: { crowdState, transitStatus, incidents },
    });

    console.log(`[Simulator] Incident resolved: ${id}`);
    return res.json({ message: 'Incident resolved', incident });
  }

  res.status(400).json({ error: 'Invalid action. Use create or resolve.' });
});

// Reset simulation to default
app.post('/api/simulate/reset', (req, res) => {
  crowdState = [
    {
      zoneId: 'gate-a',
      zoneName: 'Gate A (East Entrance)',
      currentCount: 2800,
      maxCapacity: 15000,
      densityLevel: 'low',
      updatedAt: new Date().toISOString(),
    },
    {
      zoneId: 'gate-b',
      zoneName: 'Gate B (North Entrance)',
      currentCount: 4200,
      maxCapacity: 15000,
      densityLevel: 'medium',
      updatedAt: new Date().toISOString(),
    },
    {
      zoneId: 'gate-c',
      zoneName: 'Gate C (South Entrance)',
      currentCount: 4500,
      maxCapacity: 15000,
      densityLevel: 'medium',
      updatedAt: new Date().toISOString(),
    },
    {
      zoneId: 'gate-d',
      zoneName: 'Gate D (West Entrance - ADA Accessible)',
      currentCount: 1800,
      maxCapacity: 15000,
      densityLevel: 'low',
      updatedAt: new Date().toISOString(),
    },
    {
      zoneId: 'concourse-l1',
      zoneName: 'Concourse Level 1',
      currentCount: 11500,
      maxCapacity: 25000,
      densityLevel: 'medium',
      updatedAt: new Date().toISOString(),
    },
    {
      zoneId: 'concourse-l2',
      zoneName: 'Concourse Level 2',
      currentCount: 7800,
      maxCapacity: 25000,
      densityLevel: 'low',
      updatedAt: new Date().toISOString(),
    },
    {
      zoneId: 'seating-lower',
      zoneName: 'Seating Bowl Lower',
      currentCount: 14500,
      maxCapacity: 30000,
      densityLevel: 'medium',
      updatedAt: new Date().toISOString(),
    },
    {
      zoneId: 'seating-upper',
      zoneName: 'Seating Bowl Upper',
      currentCount: 11200,
      maxCapacity: 30000,
      densityLevel: 'low',
      updatedAt: new Date().toISOString(),
    },
  ];

  transitStatus = [
    {
      routeId: 'shuttle-a',
      name: 'Shuttle Route A (Parking Lot A)',
      type: 'shuttle',
      status: 'on-time',
      nextDeparture: '3 mins',
      congestion: 'low',
    },
    {
      routeId: 'shuttle-b',
      name: 'Shuttle Route B (Parking Lot B)',
      type: 'shuttle',
      status: 'on-time',
      nextDeparture: '5 mins',
      congestion: 'low',
    },
    {
      routeId: 'train-njt',
      name: 'NJ Transit Train (Secaucus Junction)',
      type: 'train',
      status: 'on-time',
      nextDeparture: '8 mins',
      congestion: 'medium',
    },
    {
      routeId: 'bus-101',
      name: 'Express Bus Line 101 (Manhattan)',
      type: 'bus',
      status: 'on-time',
      nextDeparture: '12 mins',
      congestion: 'low',
    },
  ];

  incidents = [
    {
      id: 'inc-0',
      zoneId: 'concourse-l1',
      title: 'Clean-up required near Section 112',
      severity: 'low',
      status: 'resolved',
      description: 'Minor beverage spill. Custodial staff resolved the issue.',
      timestamp: new Date(Date.now() - 30 * 60000).toISOString(),
    },
  ];

  broadcast({
    type: 'TELEMETRY_UPDATE',
    payload: { crowdState, transitStatus, incidents },
  });

  console.log(`[Simulator] Simulation reset to defaults.`);
  res.json({ message: 'Simulation reset successfully' });
});

// WebSocket Server Handler
wss.on('connection', (ws) => {
  console.log('[Simulator] Client connected via WebSockets');

  // Send current state immediately on connect
  ws.send(
    JSON.stringify({
      type: 'INIT_STATE',
      payload: { crowdState, transitStatus, incidents },
    }),
  );

  ws.on('close', () => {
    console.log('[Simulator] Client disconnected');
  });
});

httpServer.listen(PORT, () => {
  console.log(`[Simulator] Running on http://localhost:${PORT}`);
});
