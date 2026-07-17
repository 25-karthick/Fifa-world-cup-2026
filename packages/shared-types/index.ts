export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  audioUrl?: string; // for TTS voice response
  timestamp: string;
}

export interface AgentTrace {
  id: string;
  toolName: string;
  input: string;
  output: string;
  timestamp: string;
}

export interface CrowdState {
  zoneId: string;
  zoneName: string;
  currentCount: number;
  maxCapacity: number;
  densityLevel: 'low' | 'medium' | 'high' | 'critical';
  updatedAt: string;
}

export interface Incident {
  id: string;
  zoneId: string;
  title: string;
  severity: 'low' | 'medium' | 'high';
  status: 'active' | 'resolved';
  description: string;
  timestamp: string;
}

export interface TransitStatus {
  routeId: string;
  name: string;
  type: 'shuttle' | 'train' | 'bus';
  status: 'on-time' | 'delayed' | 'suspended';
  nextDeparture: string;
  congestion: 'low' | 'medium' | 'high';
}

export interface ShiftBriefing {
  id: string;
  summary: string;
  risks: string[];
  recommendations: string[];
  timestamp: string;
}

export interface WayfindingResult {
  textResponse: string;
  routeCoordinates?: { x: number; y: number }[]; // For SVG map pathing
  routeSteps?: string[];
  audioResponseUrl?: string;
  accessibleOnly?: boolean;
}
