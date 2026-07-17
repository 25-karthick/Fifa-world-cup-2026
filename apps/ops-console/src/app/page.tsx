'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  AlertTriangle,
  Bus,
  HelpCircle,
  RefreshCw,
  Radio,
  Terminal,
  ShieldAlert,
  CheckCircle,
  Zap,
  Shield,
  Play,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  CrowdState,
  Incident,
  TransitStatus,
  ShiftBriefing,
  AgentTrace,
} from '@stadiumpulse/shared-types';

export default function OpsConsole() {
  // Real-time State
  const [crowdData, setCrowdData] = useState<CrowdState[]>([]);
  const [transitData, setTransitData] = useState<TransitStatus[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);

  // AI Shift Briefing State
  const [briefing, setBriefing] = useState<ShiftBriefing | null>({
    id: 'initial',
    summary:
      'Gathering initial telemetry briefings. Click Refresh to generate the first live briefing.',
    risks: ['Awaiting telemetry anomalies.'],
    recommendations: ['Monitor Gates and transport links.'],
    timestamp: new Date().toISOString(),
  });
  const [isBriefingLoading, setIsBriefingLoading] = useState(false);

  // Gemini Tool Reasoning State
  const [traces, setTraces] = useState<AgentTrace[]>([]);

  // Collapsible panel status
  const [isTracePanelExpanded, setIsTracePanelExpanded] = useState(false);

  // UI connection state
  const [wsConnected, setWsConnected] = useState(false);
  const [simulationStatus, setSimulationStatus] = useState('Standby');
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // URLs from .env
  const AGENT_URL = process.env.NEXT_PUBLIC_AGENT_CORE_URL || 'http://localhost:3001';
  const SIMULATION_URL = process.env.NEXT_PUBLIC_SIMULATION_URL || 'http://localhost:3002';
  const SIMULATION_WS = process.env.NEXT_PUBLIC_SIMULATION_WS || 'ws://localhost:3002';

  // 1. Connect to Simulation WebSockets
  useEffect(() => {
    let ws: WebSocket;
    const connectWS = () => {
      console.log('[Ops Console] Connecting to simulation WebSocket...');
      ws = new WebSocket(SIMULATION_WS);

      ws.onopen = () => {
        setWsConnected(true);
        setSimulationStatus('Active Telemetry');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'INIT_STATE' || data.type === 'TELEMETRY_UPDATE') {
            setCrowdData(data.payload.crowdState || []);
            setTransitData(data.payload.transitStatus || []);
            setIncidents(data.payload.incidents || []);
          }
        } catch (err) {
          console.error('[Ops Console] Error parsing websocket message:', err);
        }
      };

      ws.onerror = (err) => {
        console.error('[Ops Console] Connection error:', err);
        setWsConnected(false);
        setSimulationStatus('Offline');
      };

      ws.onclose = () => {
        setWsConnected(false);
        setSimulationStatus('Reconnecting...');
        setTimeout(connectWS, 5000);
      };
    };

    connectWS();
    return () => ws?.close();
  }, [SIMULATION_WS]);

  // 2. Poll Agent Traces and Incidents
  const fetchTracesAndIncidents = async () => {
    try {
      // Fetch traces
      const tracesRes = await fetch(`${AGENT_URL}/api/traces`);
      const tracesData = await tracesRes.json();
      setTraces(tracesData);

      // Fetch incidents
      const incRes = await fetch(`${SIMULATION_URL}/api/incidents`);
      const incData = await incRes.json();
      setIncidents(incData);
    } catch (err) {
      console.error('[Ops Console] Failed to poll traces/incidents:', err);
    }
  };

  useEffect(() => {
    fetchTracesAndIncidents();
    const interval = setInterval(fetchTracesAndIncidents, 4000);
    return () => clearInterval(interval);
  }, [AGENT_URL, SIMULATION_URL]);

  // 3. Generate AI Shift Briefing
  const triggerBriefingGeneration = async () => {
    setIsBriefingLoading(true);
    try {
      const res = await fetch(`${AGENT_URL}/api/briefing`);
      const data = await res.json();
      setBriefing({
        id: `brief-${Date.now()}`,
        summary: data.summary,
        risks: data.risks || [],
        recommendations: data.recommendations || [],
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.error('[Ops Console] Briefing compilation failed:', err);
    } finally {
      setIsBriefingLoading(false);
    }
  };

  // Generate briefing on load once crowdData lands
  useEffect(() => {
    if (crowdData.length > 0 && briefing?.id === 'initial') {
      triggerBriefingGeneration();
    }
  }, [crowdData]);

  // 4. Simulation Actions (Triggers for Demo)
  const triggerSimulation = async (type: string) => {
    try {
      if (type === 'gate-c-spike') {
        setSimulationStatus('Gate C Congestion Spike');
        await fetch(`${SIMULATION_URL}/api/simulate/crowd`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ zoneId: 'gate-c', count: 14200, density: 'critical' }),
        });
        await fetch(`${SIMULATION_URL}/api/simulate/incident`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create',
            id: 'inc-gate-c',
            zoneId: 'gate-c',
            title: 'Gate C Access Scanning Failure',
            severity: 'high',
            description:
              'Barcode scanners failing near Gate C due to local network glitch, causing critical crowd congestion.',
          }),
        });
      } else if (type === 'transit-delay') {
        setSimulationStatus('NJ Transit Rail Delays');
        await fetch(`${SIMULATION_URL}/api/simulate/transit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            routeId: 'train-njt',
            status: 'delayed',
            congestion: 'high',
            nextDeparture: '28 mins',
          }),
        });
      } else if (type === 'reset') {
        setSimulationStatus('Active Telemetry');
        await fetch(`${SIMULATION_URL}/api/simulate/reset`, { method: 'POST' });
        await fetch(`${AGENT_URL}/api/traces/clear`, { method: 'POST' });
        setTraces([]);
      }
      await fetchTracesAndIncidents();
      setTimeout(triggerBriefingGeneration, 500);
    } catch (err) {
      console.error('[Ops Console] Failed to trigger simulation:', err);
    }
  };

  // Resolve incidents manually
  const resolveIncident = async (id: string) => {
    try {
      await fetch(`${SIMULATION_URL}/api/simulate/incident`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resolve', id }),
      });
      fetchTracesAndIncidents();
      setTimeout(triggerBriefingGeneration, 500);
    } catch (err) {
      console.error('[Ops Console] Resolution failed:', err);
    }
  };

  const clearAllTraces = async () => {
    try {
      await fetch(`${AGENT_URL}/api/traces/clear`, { method: 'POST' });
      setTraces([]);
    } catch (e) {
      console.error('[Ops Console] Failed to clear traces:', e);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-cyan-500/30">
      {/* Top Operations Header */}
      <header className="sticky top-0 z-50 p-4 bg-slate-900/90 border-b border-slate-800 backdrop-blur-md flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-tr from-cyan-600 to-cyan-800 rounded-lg shadow-md">
            <Radio className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div>
            <h1 className="font-extrabold text-sm text-white tracking-wider uppercase flex items-center gap-2">
              StadiumPulse AI{' '}
              <span className="text-[9px] bg-cyan-950/40 text-cyan-400 border border-cyan-800/40 font-black py-0.5 px-2 rounded-full uppercase tracking-widest">
                Ops Command Center
              </span>
            </h1>
            <p className="text-[10px] text-slate-400 font-semibold tracking-wider">
              FIFA World Cup 2026 Operations & Crowd Intelligence
            </p>
          </div>
        </div>

        {/* Status Badges */}
        <div className="flex flex-wrap items-center gap-3 text-xs select-none">
          <div className="flex items-center gap-2 bg-slate-900/50 border border-slate-800 rounded-lg px-3 py-1.5 font-bold text-slate-300">
            <span className="text-slate-500 text-[10px] uppercase">Telemetry:</span>
            <span className="flex items-center gap-1.5 text-xs text-slate-200">
              <span
                className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-emerald-500' : 'bg-rose-500'}`}
              />
              {simulationStatus}
            </span>
          </div>

          <div className="flex items-center gap-2 bg-slate-900/50 border border-slate-800 rounded-lg px-3 py-1.5 font-bold text-slate-300">
            <span className="text-slate-500 text-[10px] uppercase">AI Model:</span>
            <span className="text-cyan-400 flex items-center gap-1.5 text-xs">
              <Zap className="w-3.5 h-3.5 fill-cyan-500/20" /> Gemini Flash
            </span>
          </div>
        </div>
      </header>

      {/* Main Command Grid */}
      <main className="flex-1 p-6 grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* LEFT COLUMN: Controls & Incidents */}
        <div className="flex flex-col gap-6">
          {/* SIMULATION TRIGGER CONTROLS */}
          <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800">
            <h2 className="text-xs font-black text-cyan-400 uppercase tracking-widest flex items-center gap-2 mb-3 select-none">
              <Play className="w-4 h-4 text-cyan-400" /> Simulation Triggers
            </h2>
            <p className="text-xs text-slate-400 font-semibold leading-relaxed mb-4">
              Simulate crowd spikes and transport Link failures to trigger real-time AI warnings.
            </p>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => triggerSimulation('gate-c-spike')}
                className="w-full h-11 flex items-center justify-between px-4 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold border border-rose-500/20 hover:border-rose-500/40 text-xs transition-all focus-ring text-left"
                aria-label="Trigger Gate C Congestion Spike"
              >
                <span>🚨 Trigger Gate C Spill Spike</span>
                <Zap className="w-4 h-4" />
              </button>

              <button
                onClick={() => triggerSimulation('transit-delay')}
                className="w-full h-11 flex items-center justify-between px-4 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 font-bold border border-amber-500/20 hover:border-amber-500/40 text-xs transition-all focus-ring text-left"
                aria-label="Trigger Transit Delay (NJ Transit)"
              >
                <span>🚆 Trigger Transit Rail Delay</span>
                <Bus className="w-4 h-4" />
              </button>

              <button
                onClick={() => triggerSimulation('reset')}
                className="w-full h-11 flex items-center justify-between px-4 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 hover:bg-slate-850 font-bold text-xs transition-all focus-ring text-left"
                aria-label="Reset All Telemetry to Normal"
              >
                <span>🔄 Reset All Telemetry</span>
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* INCIDENT FEED PANEL */}
          <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 flex-1 flex flex-col min-h-[300px]">
            <h2 className="text-xs font-black text-slate-200 uppercase tracking-widest flex items-center gap-2 mb-3 select-none">
              <ShieldAlert className="w-4 h-4 text-rose-500" /> Incident Command Log
            </h2>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[380px]">
              {incidents.length === 0 ? (
                <div className="h-full flex flex-col justify-center items-center text-center text-slate-500 text-xs py-12">
                  <CheckCircle className="w-8 h-8 mb-2 text-emerald-500/35" />
                  <p className="font-semibold">All systems nominal.</p>
                </div>
              ) : (
                incidents.map((incident) => {
                  const isResolved = incident.status === 'resolved';
                  return (
                    <div
                      key={incident.id}
                      className={`p-4 rounded-xl border text-xs relative transition-all ${
                        isResolved
                          ? 'bg-emerald-950/10 border-emerald-900/30 text-emerald-400'
                          : 'bg-rose-950/20 border-rose-900/30 text-rose-400'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-1.5">
                        <span className="font-extrabold uppercase tracking-widest text-[9px] flex items-center gap-1">
                          {isResolved ? '✅ RESOLVED' : '🚨 CRITICAL'} •{' '}
                          {incident.zoneId.replace('-', ' ')}
                        </span>
                        {!isResolved && (
                          <button
                            onClick={() => resolveIncident(incident.id)}
                            className="bg-rose-500/20 hover:bg-rose-500/35 text-rose-400 hover:text-white px-2.5 py-1 rounded text-[9px] font-extrabold uppercase border border-rose-500/30 transition focus-ring"
                            aria-label={`Resolve incident: ${incident.title}`}
                          >
                            Resolve
                          </button>
                        )}
                      </div>
                      <h3 className="font-bold text-white text-sm mb-1">{incident.title}</h3>
                      <p className="text-slate-300 leading-relaxed mb-2 text-xs">
                        {incident.description}
                      </p>
                      <span className="text-[9px] text-slate-500 block font-semibold select-none">
                        Logged: {isMounted ? new Date(incident.timestamp).toLocaleTimeString() : ''}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* MIDDLE COLUMN: Crowd Density Heatmap & Telemetry */}
        <div className="flex flex-col gap-6">
          <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 flex-1 flex flex-col">
            <h2 className="text-xs font-black text-slate-200 uppercase tracking-widest flex items-center gap-2 mb-4 select-none">
              <Users className="w-4 h-4 text-cyan-400" /> Crowd Zone Density Status
            </h2>

            <div className="space-y-4 overflow-y-auto pr-1">
              {crowdData.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-slate-500 text-xs">
                  <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Connecting crowd telemetry...
                </div>
              ) : (
                crowdData.map((zone) => {
                  const ratio = zone.currentCount / zone.maxCapacity;
                  const pct = Math.min(100, Math.round(ratio * 100));
                  return (
                    <div
                      key={zone.zoneId}
                      className="text-xs p-3 rounded-lg bg-slate-950/40 border border-slate-850"
                    >
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-bold text-slate-200">{zone.zoneName}</span>
                        <div className="flex items-center gap-2 font-mono tabular-nums">
                          <span className="text-slate-400 font-semibold">
                            {zone.currentCount.toLocaleString()} /{' '}
                            {zone.maxCapacity.toLocaleString()}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider select-none ${
                              zone.densityLevel === 'critical'
                                ? 'bg-rose-500 text-white animate-pulse'
                                : zone.densityLevel === 'high'
                                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/20'
                                  : zone.densityLevel === 'medium'
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/20'
                                    : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20'
                            }`}
                          >
                            {zone.densityLevel === 'critical'
                              ? '🚨 CRITICAL'
                              : zone.densityLevel === 'medium'
                                ? '⚠️ CAUTION'
                                : '🟢 NORMAL'}
                          </span>
                        </div>
                      </div>

                      {/* Bar */}
                      <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            zone.densityLevel === 'critical' || zone.densityLevel === 'high'
                              ? 'bg-rose-500'
                              : zone.densityLevel === 'medium'
                                ? 'bg-amber-500'
                                : 'bg-emerald-500'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Gemini Operations Briefing */}
        <div className="flex flex-col gap-6">
          <div className="p-5 rounded-xl bg-gradient-to-br from-cyan-950/20 to-slate-900 border border-cyan-900/30 flex-1 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xs font-black text-cyan-400 uppercase tracking-widest flex items-center gap-2 select-none">
                  <Shield className="w-4 h-4 text-cyan-400" /> Gemini Shift Briefing
                </h2>
                <button
                  onClick={triggerBriefingGeneration}
                  disabled={isBriefingLoading}
                  className="h-10 px-3 rounded-lg bg-slate-900 hover:bg-slate-850 text-white border border-slate-800 transition-all flex items-center gap-1.5 text-[10px] font-bold uppercase focus-ring"
                  aria-label="Refresh Shift Briefing"
                >
                  <RefreshCw className={`w-3 h-3 ${isBriefingLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>

              {/* Status summary */}
              <div className="bg-slate-950/60 border border-slate-850 p-4 rounded-xl mb-4 text-xs">
                <span className="text-[9px] font-extrabold text-cyan-400 uppercase tracking-wider block mb-1.5 select-none">
                  Briefing Summary
                </span>
                <p className="text-slate-300 leading-relaxed font-medium">{briefing?.summary}</p>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <span className="text-[9px] font-extrabold text-rose-400 uppercase tracking-wider block mb-2 flex items-center gap-1 select-none">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-500" /> Detected Risks
                  </span>
                  <ul className="space-y-1.5 text-xs text-slate-300 list-disc list-inside font-medium leading-relaxed pl-1">
                    {briefing?.risks.map((risk, idx) => (
                      <li key={idx}>{risk}</li>
                    ))}
                  </ul>
                </div>

                <hr className="border-slate-850" />

                <div>
                  <span className="text-[9px] font-extrabold text-emerald-400 uppercase tracking-wider block mb-2 flex items-center gap-1 select-none">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> Action recommendations
                  </span>
                  <ul className="space-y-1.5 text-xs text-slate-300 list-disc list-inside font-medium leading-relaxed pl-1">
                    {briefing?.recommendations.map((rec, idx) => (
                      <li key={idx}>{rec}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div className="mt-6 border-t border-slate-850 pt-3 flex justify-between items-center text-[9px] text-slate-500 font-bold select-none">
              <span>Dynamic Telemetry compilation</span>
              <span>
                Updated:{' '}
                {briefing && isMounted
                  ? new Date(briefing.timestamp).toLocaleTimeString()
                  : 'Never'}
              </span>
            </div>
          </div>
        </div>
      </main>

      {/* COLLAPSIBLE DEVELOPER TRACE DRAWER (Visual Hierarchy adjustment) */}
      <footer className="p-6 bg-slate-950 border-t border-slate-850">
        {!isTracePanelExpanded ? (
          <div className="bg-slate-900 border border-slate-850 rounded-xl p-4 flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-cyan-400" />
              <span className="font-semibold text-xs text-slate-300">
                Gemini Agent Multi-Tool Trace Log ({traces.length} tool events traced)
              </span>
            </div>
            <button
              onClick={() => setIsTracePanelExpanded(true)}
              className="h-10 px-4 bg-slate-850 hover:bg-slate-800 text-xs font-bold rounded-lg border border-slate-800 text-slate-200 transition focus-ring uppercase"
              aria-label="Expand Agent Trace Logs Drawer"
            >
              Open Traces Drawer
            </button>
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-850 rounded-xl p-5 flex flex-col gap-4 shadow-xl">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-cyan-400" />
                <span className="font-bold text-xs uppercase tracking-wider text-slate-200">
                  Gemini Agent Multi-Tool Trace Log
                </span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={clearAllTraces}
                  className="h-10 px-4 text-[10px] bg-slate-850 hover:bg-slate-800 rounded-lg border border-slate-800 text-slate-400 font-bold uppercase transition focus-ring"
                >
                  Clear Logs
                </button>
                <button
                  onClick={() => setIsTracePanelExpanded(false)}
                  className="h-10 px-4 bg-slate-800 hover:bg-slate-750 text-xs font-bold rounded-lg border border-slate-800 text-slate-200 transition focus-ring uppercase"
                  aria-label="Collapse Agent Trace Logs Drawer"
                >
                  Close Drawer
                </button>
              </div>
            </div>

            <div className="overflow-y-auto space-y-2.5 font-mono text-[10px] leading-relaxed pr-1 max-h-[250px]">
              {traces.length === 0 ? (
                <div className="py-8 flex flex-col justify-center items-center text-slate-500 text-xs">
                  <Terminal className="w-6 h-6 mb-2 text-slate-650" />
                  <p>Awaiting fan interactions to trace tool queries...</p>
                </div>
              ) : (
                traces.map((trace) => (
                  <div
                    key={trace.id}
                    className="p-3.5 bg-slate-950 border border-slate-850 rounded-lg flex flex-col gap-2"
                  >
                    <div className="flex justify-between items-center text-slate-500 text-[9px] border-b border-slate-850 pb-1.5 font-bold">
                      <span className="text-cyan-400 font-extrabold flex items-center gap-1 uppercase tracking-wider">
                        🔧 Tool Executed: {trace.toolName}
                      </span>
                      <span>{isMounted ? new Date(trace.timestamp).toLocaleTimeString() : ''}</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                      <div>
                        <span className="text-slate-500 text-[8px] block uppercase font-black tracking-wider">
                          Input Arguments
                        </span>
                        <pre className="text-slate-300 whitespace-pre-wrap overflow-x-auto mt-1 max-h-20 bg-slate-900/60 p-2 rounded border border-slate-850">
                          {trace.input}
                        </pre>
                      </div>
                      <div>
                        <span className="text-slate-500 text-[8px] block uppercase font-black tracking-wider">
                          Output/Returned Context
                        </span>
                        <pre className="text-cyan-400/90 whitespace-pre-wrap overflow-x-auto mt-1 max-h-20 bg-slate-900/60 p-2 rounded border border-slate-850">
                          {trace.output}
                        </pre>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </footer>
    </div>
  );
}
