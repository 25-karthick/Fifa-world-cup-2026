'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Send,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  MapPin,
  Settings,
  ShieldAlert,
  Navigation,
  RefreshCw,
  Accessibility,
  Globe,
  Award,
  Sparkles,
  Volume1,
} from 'lucide-react';
import {
  ChatMessage,
  CrowdState,
  TransitStatus,
  WayfindingResult,
} from '@stadiumpulse/shared-types';

export default function FanCompanion() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'model',
      content:
        'Welcome to MetLife Stadium! 🏟️ I am your StadiumPulse AI Assistant. Ask me about routes, bag policies, stroller check-in, or current gate queue status in any language!',
      timestamp: new Date().toISOString(),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Settings & Status
  const [language, setLanguage] = useState('en');
  const [accessibleOnly, setAccessibleOnly] = useState(false);
  const [isAccessibilityMode, setIsAccessibilityMode] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isTtsEnabled, setIsTtsEnabled] = useState(true);
  const [crowdData, setCrowdData] = useState<CrowdState[]>([]);
  const [transitData, setTransitData] = useState<TransitStatus[]>([]);
  const [routeData, setRouteData] = useState<WayfindingResult | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // URLs from .env
  const AGENT_URL = process.env.NEXT_PUBLIC_AGENT_CORE_URL || 'http://localhost:3001';
  const SIMULATION_WS = process.env.NEXT_PUBLIC_SIMULATION_WS || 'ws://localhost:3002';

  // Autoscroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Connect to Simulation Telemetry (WebSockets)
  useEffect(() => {
    let ws: WebSocket;
    const connectWS = () => {
      console.log('[Fan App] Connecting to telemetry WebSocket...');
      ws = new WebSocket(SIMULATION_WS);

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'INIT_STATE' || data.type === 'TELEMETRY_UPDATE') {
            setCrowdData(data.payload.crowdState || []);
            setTransitData(data.payload.transitStatus || []);
          }
        } catch (err) {
          console.error('[Fan App] Error parsing telemetry data:', err);
        }
      };

      ws.onerror = (err) => {
        console.error('[Fan App] Telemetry connection error, retrying...');
      };

      ws.onclose = () => {
        setTimeout(connectWS, 5000);
      };
    };

    connectWS();
    return () => ws?.close();
  }, [SIMULATION_WS]);

  // Setup Web Speech API for voice command transcription (STT)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.continuous = false;
        rec.interimResults = false;
        rec.lang = language === 'es' ? 'es-ES' : language === 'fr' ? 'fr-FR' : 'en-US';

        rec.onstart = () => setIsListening(true);
        rec.onend = () => setIsListening(false);
        rec.onresult = (event: any) => {
          const text = event.results[0][0].transcript;
          setInputValue(text);
          sendMessage(text);
        };
        rec.onerror = (err: any) => {
          console.error('[STT] Speech recognition error:', err);
          setIsListening(false);
        };

        recognitionRef.current = rec;
      }
    }
  }, [language]);

  // Text-To-Speech (TTS) responder
  const speakText = (text: string) => {
    if (!isTtsEnabled || typeof window === 'undefined') return;
    window.speechSynthesis.cancel(); // Stop active speaking

    // Remove emojis/markdown for cleaner TTS
    const cleanText = text.replace(/[*#_`\uD800-\uDFFF\u2600-\u27BF]/g, '').trim();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = language === 'es' ? 'es-ES' : language === 'fr' ? 'fr-FR' : 'en-US';
    window.speechSynthesis.speak(utterance);
  };

  // Toggle voice listening
  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert('Speech-to-Text is not supported in this browser. Try Chrome or Safari.');
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
    }
  };

  // Chat message sender
  const sendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputValue).trim();
    if (!text || isLoading) return;

    if (!textToSend) setInputValue('');

    const reqId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}-user`;

    const userMsg: ChatMessage = {
      id: reqId,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      // Append context parameters if user selects accessible paths
      let processedQuery = text;
      if (
        accessibleOnly &&
        !text.toLowerCase().includes('accessible') &&
        !text.toLowerCase().includes('ada')
      ) {
        processedQuery += ' (I need wheelchair accessibility routing)';
      }

      const res = await fetch(`${AGENT_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: processedQuery,
          messageId: reqId,
          history: messages.slice(-5),
        }),
      });

      const data = await res.json();

      const botMsg: ChatMessage = {
        id: `bot-${data.messageId || reqId}`,
        role: 'model',
        content: data.response,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, botMsg]);

      // Speak response if voice TTS is active
      speakText(data.response);

      // Render routes on the SVG if returned
      if (data.routeData) {
        setRouteData(data.routeData);
      }
    } catch (err) {
      console.error('[Fan App] Chat API failed:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now()}-error`,
          role: 'model',
          content: '⚠️ Connection issue. Reconnecting to Agent Core. Please try again.',
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Clear routes overlay
  const resetRoute = () => {
    setRouteData(null);
  };

  // Render density colors
  const getDensityColor = (zoneId: string) => {
    const zone = crowdData.find((z) => z.zoneId === zoneId);
    if (!zone) return 'fill-slate-800 stroke-slate-700';
    switch (zone.densityLevel) {
      case 'critical':
        return 'fill-rose-950/60 stroke-rose-500 stroke-2 animate-pulse-slow';
      case 'high':
        return 'fill-rose-950/40 stroke-rose-400 stroke-2';
      case 'medium':
        return 'fill-amber-950/40 stroke-amber-400 stroke-2';
      case 'low':
        return 'fill-emerald-950/40 stroke-emerald-400 stroke-2';
      default:
        return 'fill-slate-800 stroke-slate-700';
    }
  };

  // Quick prompt templates
  const quickPrompts = [
    { label: '🎒 Bag Policy', text: 'What is the bag policy for the match?' },
    { label: '♿ Accessible Entrance', text: 'Where is the ADA handicap entrance?' },
    { label: '👶 Strollers', text: 'Can I bring my child stroller to the seat?' },
    {
      label: '🗺️ Route from Gate C',
      text: 'Get route directions from Gate C to Seating Lower Section 112',
    },
  ];

  // Font sizing scale for accessibility mode
  const fontClass = isAccessibilityMode ? 'text-base lg:text-lg' : 'text-xs lg:text-sm';
  const headingClass = isAccessibilityMode
    ? 'text-lg lg:text-xl font-bold'
    : 'text-sm lg:text-base font-bold';

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-cyan-500/30">
      {/* Sticky High-Trust Header containing key accessibility options */}
      <header className="sticky top-0 z-50 w-full bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 py-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-tr from-cyan-600 to-cyan-800 shadow-md">
            <Award className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-extrabold text-sm text-white tracking-tight leading-tight uppercase">
              StadiumPulse
            </h1>
            <p className="text-[10px] text-slate-400 font-semibold tracking-wider">
              FIFA World Cup 2026 • Fan Companion
            </p>
          </div>
        </div>

        {/* Accessibility & Voice controllers placed on sticky header */}
        <div className="flex flex-wrap items-center gap-3">
          {/* ADA Paths Switch */}
          <button
            onClick={() => setAccessibleOnly(!accessibleOnly)}
            className={`h-11 px-4 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-all focus-ring ${
              accessibleOnly
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:bg-slate-850'
            }`}
            title="Toggle ADA Accessible Routes Only"
            aria-label="ADA Accessible Paths Only"
          >
            <Accessibility className="w-4 h-4 text-amber-400" />
            <span>ADA Path</span>
            <span
              className={`w-2 h-2 rounded-full ${accessibleOnly ? 'bg-amber-400 animate-pulse' : 'bg-slate-600'}`}
            />
          </button>

          {/* Accessibility Zoom Mode */}
          <button
            onClick={() => setIsAccessibilityMode(!isAccessibilityMode)}
            className={`h-11 px-4 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-all focus-ring ${
              isAccessibilityMode
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:bg-slate-850'
            }`}
            title="Toggle Assistive Large Text Mode"
            aria-label="Toggle Assistive Text and Layout Zoom Mode"
          >
            <Settings className="w-4 h-4 text-cyan-400" />
            <span>Assist Mode</span>
            <span
              className={`w-2 h-2 rounded-full ${isAccessibilityMode ? 'bg-cyan-400 animate-pulse' : 'bg-slate-600'}`}
            />
          </button>

          {/* Language selection dropdown */}
          <div className="flex items-center gap-1.5 bg-slate-900/60 border border-slate-850 px-2 rounded-xl h-11">
            <Globe className="w-4 h-4 text-slate-400 ml-1" />
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="bg-transparent text-slate-300 text-xs focus:outline-none pr-2 font-semibold cursor-pointer h-full"
              aria-label="Select Assistant Language"
            >
              <option value="en">English</option>
              <option value="es">Español</option>
              <option value="fr">Français</option>
            </select>
          </div>
        </div>
      </header>

      {/* Main Page Skeleton */}
      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Left Side Info Panel */}
        <aside className="w-full lg:w-96 flex flex-col border-b lg:border-b-0 lg:border-r border-slate-850 bg-slate-900/30 backdrop-blur-sm shrink-0">
          {/* Telemetry Alert box */}
          <div className="p-5 border-b border-slate-850/80 bg-slate-900/40">
            <h3 className="text-xs font-black uppercase tracking-wider text-cyan-400 flex items-center gap-1.5 mb-3 select-none">
              <ShieldAlert className="w-4 h-4" /> Live Crowd Telemetry
            </h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {crowdData.length === 0 ? (
                <span className="col-span-2 text-slate-500 animate-pulse font-medium">
                  Awaiting crowd feeds...
                </span>
              ) : (
                crowdData
                  .filter((z) => z.zoneId.startsWith('gate'))
                  .map((gate) => (
                    <div
                      key={gate.zoneId}
                      className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80 flex items-center justify-between"
                    >
                      <span className="font-semibold text-slate-300">
                        {gate.zoneName.replace('Gate ', '')}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded font-black text-[10px] uppercase select-none ${
                          gate.densityLevel === 'critical' || gate.densityLevel === 'high'
                            ? 'bg-rose-500/20 text-rose-400'
                            : gate.densityLevel === 'medium'
                              ? 'bg-amber-500/20 text-amber-300'
                              : 'bg-emerald-500/20 text-emerald-400'
                        }`}
                      >
                        {gate.densityLevel}
                      </span>
                    </div>
                  ))
              )}
            </div>
          </div>

          {/* Accessibility Info hint if mode is enabled */}
          {isAccessibilityMode && (
            <div className="p-5 border-b border-slate-850 bg-cyan-950/20 text-cyan-300">
              <span className="text-xs font-bold block mb-1.5 flex items-center gap-1">
                <Accessibility className="w-4 h-4" /> Assist Mode Active
              </span>
              <p className="text-xs leading-relaxed text-cyan-200">
                Screen-reader optimized typography loaded. Touch actions are optimized. Voice
                triggers listen in your chosen language.
              </p>
            </div>
          )}

          {/* Quick Help Prompts (Sidebar Desktop only) */}
          <div className="p-5 hidden lg:flex flex-col gap-3 flex-1">
            <span className="text-xs font-black text-slate-400 uppercase tracking-wider block select-none">
              Suggested Questions
            </span>
            <div className="flex flex-col gap-2">
              {quickPrompts.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setInputValue(p.text);
                    sendMessage(p.text);
                  }}
                  disabled={isLoading}
                  className="text-left p-3.5 rounded-xl bg-slate-900/50 hover:bg-slate-900 text-xs text-slate-300 transition-all border border-slate-850 hover:border-slate-800 disabled:opacity-40 disabled:pointer-events-none focus-ring h-12 flex items-center"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Right Main content Panel */}
        <main className="flex-1 flex flex-col bg-gradient-to-b from-slate-950 to-slate-900/60 min-h-0">
          {/* SVG Map Section */}
          <section className="flex-1 p-6 relative flex flex-col justify-center items-center min-h-[300px] border-b border-slate-850">
            <div className="absolute top-4 left-4 z-10 select-none">
              <h2 className="text-xs font-bold tracking-wider text-slate-200 flex items-center gap-2 bg-slate-900/90 px-3.5 py-2 rounded-full border border-slate-800">
                <MapPin className="w-3.5 h-3.5 text-cyan-400 animate-bounce" /> MetLife Stadium Live
                Map
              </h2>
            </div>

            {routeData && (
              <div className="absolute top-4 right-4 z-10">
                <button
                  onClick={resetRoute}
                  className="h-11 px-4 text-xs bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 rounded-xl border border-rose-500/20 font-semibold transition focus-ring"
                >
                  Clear Route
                </button>
              </div>
            )}

            {/* High-Trust Interactive Map */}
            <div className="w-full max-w-xl h-full flex justify-center items-center pt-8">
              <svg
                viewBox="0 0 500 400"
                className="w-full max-h-[280px]"
                role="img"
                aria-label="MetLife Stadium map showing gates A, B, C, D, seating zones, and active navigation routes."
              >
                {/* Ground Base */}
                <ellipse
                  cx="250"
                  cy="200"
                  rx="195"
                  ry="145"
                  className="fill-slate-900/40 stroke-slate-800/80 stroke-2"
                />
                <ellipse
                  cx="250"
                  cy="200"
                  rx="155"
                  ry="105"
                  className="fill-none stroke-slate-850"
                />

                {/* Seating Bowl */}
                <ellipse
                  cx="250"
                  cy="200"
                  rx="135"
                  ry="85"
                  className="fill-slate-950/80 stroke-slate-800 stroke-2"
                />
                <text
                  x="250"
                  y="150"
                  textAnchor="middle"
                  className="fill-slate-500 text-[9px] font-black uppercase tracking-wider select-none"
                >
                  Seating Bowl Lower
                </text>
                <text
                  x="250"
                  y="260"
                  textAnchor="middle"
                  className="fill-slate-500 text-[9px] font-black uppercase tracking-wider select-none"
                >
                  Seating Bowl Upper
                </text>

                {/* Pitch Area */}
                <rect
                  x="205"
                  y="180"
                  width="90"
                  height="40"
                  rx="2"
                  className="fill-slate-900 stroke-cyan-500/30 stroke-2"
                />
                <line x1="250" y1="180" x2="250" y2="220" className="stroke-slate-800 stroke-1" />
                <circle cx="250" cy="200" r="8" className="fill-none stroke-slate-800" />

                {/* Gate Points */}
                {/* Gate B: North */}
                <circle
                  cx="250"
                  cy="55"
                  r="13"
                  className={`${getDensityColor('gate-b')} transition-all`}
                />
                <text
                  x="250"
                  y="58"
                  textAnchor="middle"
                  className="fill-slate-100 font-bold text-[9px] font-display select-none"
                >
                  B
                </text>
                <text
                  x="250"
                  y="38"
                  textAnchor="middle"
                  className="fill-slate-500 text-[8px] font-semibold uppercase tracking-wider select-none"
                >
                  North Gate
                </text>

                {/* Gate A: East */}
                <circle
                  cx="445"
                  cy="200"
                  r="13"
                  className={`${getDensityColor('gate-a')} transition-all`}
                />
                <text
                  x="445"
                  y="203"
                  textAnchor="middle"
                  className="fill-slate-100 font-bold text-[9px] font-display select-none"
                >
                  A
                </text>
                <text
                  x="445"
                  y="183"
                  textAnchor="middle"
                  className="fill-slate-500 text-[8px] font-semibold uppercase tracking-wider select-none"
                >
                  East Gate
                </text>

                {/* Gate C: South */}
                <circle
                  cx="55"
                  cy="150"
                  r="13"
                  className={`${getDensityColor('gate-c')} transition-all`}
                />
                <text
                  x="55"
                  y="153"
                  textAnchor="middle"
                  className="fill-slate-100 font-bold text-[9px] font-display select-none"
                >
                  C
                </text>
                <text
                  x="55"
                  y="133"
                  textAnchor="middle"
                  className="fill-slate-500 text-[8px] font-semibold uppercase tracking-wider select-none"
                >
                  South Gate
                </text>

                {/* Gate D: West Accessible */}
                <circle
                  cx="55"
                  cy="250"
                  r="13"
                  className={`${getDensityColor('gate-d')} transition-all`}
                />
                <text
                  x="55"
                  y="253"
                  textAnchor="middle"
                  className="fill-slate-100 font-bold text-[9px] font-display select-none"
                >
                  D
                </text>
                <text
                  x="55"
                  y="275"
                  textAnchor="middle"
                  className="fill-amber-400 font-black text-[8px] uppercase tracking-wider select-none"
                >
                  ♿ Gate D
                </text>

                {/* Render wayfinding coordinates pathway */}
                {routeData?.routeCoordinates && routeData.routeCoordinates.length > 1 && (
                  <>
                    <path
                      d={`M ${routeData.routeCoordinates.map((c) => `${c.x} ${c.y}`).join(' L ')}`}
                      fill="none"
                      stroke={routeData.accessibleOnly ? '#f59e0b' : '#22d3ee'}
                      strokeWidth="4"
                      strokeDasharray="6 4"
                      className="animate-[dash_2s_linear_infinite]"
                      style={{ strokeLinecap: 'round' }}
                    />
                    {routeData.routeCoordinates.map((coord, idx) => (
                      <circle
                        key={idx}
                        cx={coord.x}
                        cy={coord.y}
                        r="5"
                        fill={routeData.accessibleOnly ? '#f59e0b' : '#22d3ee'}
                        className="animate-pulse"
                      />
                    ))}
                  </>
                )}
              </svg>
            </div>

            {/* Layout colors legend containing status labels for accessibility */}
            <div className="w-full max-w-lg mt-4 flex justify-center gap-4 text-[10px] text-slate-400 font-semibold select-none">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> Low (Clear)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500" /> Medium (Caution)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500" /> High (Congested)
              </span>
            </div>

            {/* Turn-by-Turn Wayfinding display */}
            {routeData && (
              <div className="w-full max-w-lg mt-4 p-4 rounded-xl bg-slate-900/60 border border-slate-800 backdrop-blur text-xs">
                <span className="font-extrabold text-cyan-400 block mb-2.5 flex items-center gap-1.5 uppercase tracking-wider">
                  <Navigation className="w-4 h-4" /> Turn-by-Turn Wayfinding
                </span>
                <ul className="space-y-2 text-slate-200">
                  {routeData.routeSteps?.map((step, idx) => (
                    <li key={idx} className="flex gap-2 items-start">
                      <span className="text-cyan-400 font-bold shrink-0">{idx + 1}.</span>
                      <span className={isAccessibilityMode ? 'text-sm font-semibold' : 'text-xs'}>
                        {step}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {/* Premium Chat bubble section */}
          <section className="h-[380px] lg:h-[400px] flex flex-col bg-slate-950/40 border-t border-slate-850">
            {/* Scrollable messages container */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {messages.map((msg) => {
                const isUser = msg.role === 'user';
                return (
                  <div
                    key={msg.id}
                    className={`flex gap-3 max-w-[80%] ${isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
                  >
                    {/* Avatar */}
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border select-none ${
                        isUser
                          ? 'bg-slate-900 border-slate-800 text-slate-400'
                          : 'bg-cyan-950/20 border-cyan-800/30 text-cyan-400'
                      }`}
                    >
                      {isUser ? (
                        <span className="text-xs font-bold font-display">ME</span>
                      ) : (
                        <Award className="w-4 h-4" />
                      )}
                    </div>

                    {/* Chat Bubble container */}
                    <div
                      className={`p-4 rounded-2xl border ${fontClass} transition-all ${
                        isUser
                          ? 'bg-slate-900 border-slate-800 text-slate-200 rounded-tr-none'
                          : 'bg-slate-900/60 border-slate-850 text-slate-100 rounded-tl-none border-l-4 border-l-cyan-500'
                      }`}
                    >
                      <p className="leading-relaxed whitespace-pre-line">{msg.content}</p>
                      <span className="text-[9px] text-slate-500 block mt-1.5 text-right font-bold tracking-wider">
                        {isMounted
                          ? new Date(msg.timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : ''}
                      </span>
                    </div>
                  </div>
                );
              })}

              {/* Loader response state */}
              {isLoading && (
                <div className="flex gap-3 max-w-[80%]">
                  <div className="w-9 h-9 rounded-xl bg-cyan-950/20 border border-cyan-800/30 flex items-center justify-center text-cyan-400">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-850 text-slate-400 rounded-tl-none flex items-center gap-2 border-l-4 border-l-cyan-500/40">
                    <span className="text-xs font-bold animate-pulse text-slate-400">
                      StadiumPulse is writing...
                    </span>
                    <div className="flex gap-1">
                      <div
                        className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce"
                        style={{ animationDelay: '0s' }}
                      />
                      <div
                        className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce"
                        style={{ animationDelay: '0.2s' }}
                      />
                      <div
                        className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce"
                        style={{ animationDelay: '0.4s' }}
                      />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Chat footer input form */}
            <div className="p-4 border-t border-slate-850 bg-slate-900/30 flex flex-col gap-2">
              {/* Quick suggestions inside form on mobile */}
              <div className="flex gap-2 overflow-x-auto pb-2 lg:hidden no-scrollbar">
                {quickPrompts.slice(0, 3).map((p, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setInputValue(p.text);
                      sendMessage(p.text);
                    }}
                    disabled={isLoading}
                    className="whitespace-nowrap px-3.5 py-2 rounded-full bg-slate-900/80 text-[10px] text-slate-300 font-semibold border border-slate-850 hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none transition focus-ring h-10"
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* TextInput row */}
              <div className="flex gap-3 items-center">
                {/* Text-To-Speech toggler button */}
                <button
                  onClick={() => setIsTtsEnabled(!isTtsEnabled)}
                  disabled={isLoading}
                  className={`p-3 rounded-xl border transition-all h-11 w-11 flex items-center justify-center shrink-0 focus-ring ${
                    isTtsEnabled
                      ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                      : 'bg-slate-900/60 text-slate-500 border-slate-800 hover:text-slate-400'
                  } disabled:opacity-50`}
                  title={
                    isTtsEnabled
                      ? 'Disable text-to-speech audio feedback'
                      : 'Enable text-to-speech audio feedback'
                  }
                  aria-label="Toggle speech audio"
                >
                  {isTtsEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                </button>

                {/* Message input */}
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                    disabled={isLoading}
                    placeholder={
                      isLoading
                        ? 'StadiumPulse is processing your query...'
                        : isListening
                          ? 'Listening... speak now.'
                          : 'Ask about bags, strollers, parking or gates...'
                    }
                    className="w-full bg-slate-950/80 disabled:opacity-50 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-cyan-500 transition text-slate-200 pr-10 focus:ring-1 focus:ring-cyan-500 h-11"
                    aria-label="Write a stadium assistance question"
                  />

                  {/* Voice recognition trigger */}
                  <button
                    onClick={toggleListening}
                    disabled={isLoading}
                    className={`absolute right-2 top-1.5 p-1.5 rounded-lg transition h-8 w-8 flex items-center justify-center focus-ring ${
                      isListening
                        ? 'bg-rose-500/20 text-rose-400 animate-pulse'
                        : 'text-slate-500 hover:text-slate-300'
                    } disabled:opacity-30`}
                    title="Speak command to StadiumPulse"
                    aria-label="Activate voice speech to text input"
                  >
                    {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </button>
                </div>

                {/* Send action button */}
                <button
                  onClick={() => sendMessage()}
                  disabled={isLoading}
                  className="p-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white transition disabled:opacity-50 disabled:pointer-events-none h-11 w-11 flex items-center justify-center shrink-0 focus-ring shadow-lg shadow-cyan-950/55"
                  title="Send input query"
                  aria-label="Send message bubble"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
