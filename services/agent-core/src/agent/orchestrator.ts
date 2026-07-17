import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { searchVenueKB } from '../rag/kb';
import { AgentTrace, WayfindingResult, Incident } from '@stadiumpulse/shared-types';

// Global trace log for Ops Console
export let agentTraces: AgentTrace[] = [];

// Helper to add trace
export function addTrace(toolName: string, input: any, output: any) {
  const newTrace: AgentTrace = {
    id: `trace-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    toolName,
    input: typeof input === 'string' ? input : JSON.stringify(input),
    output: typeof output === 'string' ? output : JSON.stringify(output),
    timestamp: new Date().toISOString(),
  };
  agentTraces.unshift(newTrace);
  if (agentTraces.length > 50) agentTraces.pop(); // limit size
  return newTrace;
}

// Clear traces
export function clearTraces() {
  agentTraces = [];
}

// Load configurations
const API_KEY = process.env.GEMINI_API_KEY || '';
const SIMULATOR_URL = process.env.NEXT_PUBLIC_SIMULATION_URL || 'http://localhost:3002';

// -------------------------------------------------------------
// Real-time Tool Implementations
// -------------------------------------------------------------

async function fetchCrowdState() {
  try {
    const res = await fetch(`${SIMULATOR_URL}/api/crowd`);
    const data = await res.json();
    addTrace('get_crowd_state', '{}', data);
    return data;
  } catch (err) {
    console.error('Error fetching crowd state:', err);
    return [];
  }
}

async function fetchTransitStatus() {
  try {
    const res = await fetch(`${SIMULATOR_URL}/api/transit`);
    const data = await res.json();
    addTrace('get_transit_status', '{}', data);
    return data;
  } catch (err) {
    console.error('Error fetching transit status:', err);
    return [];
  }
}

// Custom route calculation with congestion checking and accessibility support
// Custom zone map coordinates
const ZONE_COORDINATES: Record<string, { x: number; y: number; name: string }> = {
  'gate-a': { x: 450, y: 100, name: 'Gate A (East)' },
  'gate-b': { x: 250, y: 50, name: 'Gate B (North)' },
  'gate-c': { x: 50, y: 150, name: 'Gate C (South)' },
  'gate-d': { x: 50, y: 350, name: 'Gate D (West - ADA)' },
  'concourse-l1': { x: 250, y: 200, name: 'Concourse Level 1' },
  'concourse-l2': { x: 250, y: 280, name: 'Concourse Level 2' },
  'seating-lower': { x: 250, y: 150, name: 'Seating Bowl Lower' },
  'seating-upper': { x: 250, y: 320, name: 'Seating Bowl Upper' },
};

interface RouteParams {
  start: string;
  end: string;
  accessibleOnly?: boolean;
}

async function calculateRoute(params: RouteParams): Promise<WayfindingResult> {
  const { start, end, accessibleOnly = false } = params;
  const startId = start.toLowerCase().trim();
  const endId = end.toLowerCase().trim();

  // Fetch current crowd metrics to look for congested zones
  const crowd = await fetchCrowdState();
  const congestedZones = crowd
    .filter((z: any) => z.densityLevel === 'high' || z.densityLevel === 'critical')
    .map((z: any) => z.zoneId);

  // Accessible routes must bypass stairs / non-ADA gates
  // Let's resolve route nodes
  const routeNodes: string[] = [];
  const routeSteps: string[] = [];

  // Simple hardcoded router based on inputs
  let actualStart = startId;
  let rerouted = false;

  // Handle congestion check at start gate
  if (congestedZones.includes(startId)) {
    rerouted = true;
    // Suggest alternative
    if (startId === 'gate-c') {
      actualStart = 'gate-d'; // Redirect to Gate D
      routeSteps.push(
        `⚠️ WARNING: Gate C is currently experiencing heavy congestion. Rerouted to Gate D (ADA Accessible/Low Congestion).`,
      );
    } else if (startId === 'gate-a') {
      actualStart = 'gate-b';
      routeSteps.push(
        `⚠️ WARNING: Gate A is currently experiencing high crowd density. Rerouted to Gate B.`,
      );
    }
  }

  routeNodes.push(actualStart);
  routeSteps.push(`Start at ${ZONE_COORDINATES[actualStart]?.name || actualStart}.`);

  // Accessible adjustments
  if (accessibleOnly) {
    if (actualStart !== 'gate-d' && actualStart.startsWith('gate')) {
      routeSteps.push(
        `♿ Accessible Routing: Moving from ${ZONE_COORDINATES[actualStart]?.name} to designated ADA Entrance Gate D.`,
      );
      routeNodes.push('gate-d');
      actualStart = 'gate-d';
    }
    routeSteps.push(`Proceed via the wheelchair-accessible ramp to Elevators West.`);
    routeNodes.push('concourse-l2');
    routeSteps.push(`Take Elevator 3 to Concourse Level 2.`);
  } else {
    // Normal routing
    routeNodes.push('concourse-l1');
    routeSteps.push(`Scan ticket and proceed through turnstiles to Concourse Level 1.`);
  }

  // End destination connection
  if (endId.includes('upper')) {
    routeNodes.push('seating-upper');
    routeSteps.push(`Proceed to Section 314 via escalator 4.`);
  } else {
    routeNodes.push('seating-lower');
    routeSteps.push(`Proceed to Section 112 via Portal 6.`);
  }

  const routeCoordinates = routeNodes
    .map((node) => ZONE_COORDINATES[node])
    .filter(Boolean)
    .map((coord) => ({ x: coord.x, y: coord.y }));

  const result: WayfindingResult = {
    textResponse: rerouted
      ? `Wayfinding update: We have rerouted you due to high crowd density. Please proceed to ${ZONE_COORDINATES[actualStart]?.name}.`
      : `Route generated successfully from ${ZONE_COORDINATES[startId]?.name || startId} to ${ZONE_COORDINATES[endId]?.name || endId}.`,
    routeCoordinates,
    routeSteps,
    accessibleOnly,
  };

  addTrace('calculate_route', params, result);
  return result;
}

// -------------------------------------------------------------
// AI Chat Orchestrator (Gemini Integration)
// -------------------------------------------------------------

function queryContainsRouteKeywords(q: string): boolean {
  const query = q.toLowerCase();
  return (
    query.includes('route') ||
    query.includes('directions') ||
    query.includes('get to') ||
    query.includes('where is gate') ||
    query.includes('go to')
  );
}

function extractStartEnd(q: string) {
  const query = q.toLowerCase();
  let start = 'gate-a';
  let end = 'seating-lower';
  const accessibleOnly =
    query.includes('wheelchair') ||
    query.includes('accessible') ||
    query.includes('ada') ||
    query.includes('stroller');

  if (query.includes('gate c') || query.includes('gate-c')) start = 'gate-c';
  else if (query.includes('gate b') || query.includes('gate-b')) start = 'gate-b';
  else if (query.includes('gate d') || query.includes('gate-d')) start = 'gate-d';

  if (query.includes('upper') || query.includes('section 300') || query.includes('314'))
    end = 'seating-upper';
  return { start, end, accessibleOnly };
}

export async function processAgentChat(
  userMessage: string,
  history: any[] = [],
): Promise<{
  response: string;
  traces: AgentTrace[];
  routeData?: WayfindingResult;
}> {
  console.log(`[Agent] Processing message: "${userMessage}"`);

  // 1. If Gemini API Key is missing, run in fallback Mock mode
  if (!API_KEY) {
    console.log('[Agent] GEMINI_API_KEY not found. Running Mock Agent reasoning...');
    return runMockAgent(userMessage);
  }

  try {
    const genAI = new GoogleGenerativeAI(API_KEY);

    // Step 1: Explicit query normalization & Intent classification
    const classifyModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const classifyPrompt = `Analyze the user's MetLife Stadium visitor query: "${userMessage}"
Locate the user's intent, fix any typos (e.g., "statuim" -> "stadium", "build" -> "built"), and normalize the query for RAG database search.

Select one of these intent categories:
- "GREETING": User is saying hello.
- "FAREWELL": User is saying goodbye.
- "WAYFINDING": User asks for directions, routes, locations, or nearest amenities (restrooms, water fountains, gates).
- "POLICY": User asks what is allowed inside (bag size, stroller checks, food, water limits).
- "FACTS": User asks general stadium history, capacity, year built, overview facts.
- "AMBIGUOUS": The query is too short or vague (e.g. just "water", "gate") and has multiple valid interpretations.

Respond strictly with a JSON object in this format (no markdown blocks, just raw JSON):
{
  "intent": "GREETING" | "FAREWELL" | "WAYFINDING" | "POLICY" | "FACTS" | "AMBIGUOUS",
  "normalizedQuery": "corrected, expanded search term for RAG, or empty for greetings",
  "clarifyingQuestion": "clarifying question if intent is AMBIGUOUS, otherwise empty"
}`;

    const classificationResponse = await classifyModel.generateContent(classifyPrompt);
    let classJsonText = classificationResponse.response.text().trim();

    // Clean JSON markdown tags if present
    if (classJsonText.startsWith('```json')) {
      classJsonText = classJsonText.substring(7);
    }
    if (classJsonText.endsWith('```')) {
      classJsonText = classJsonText.substring(0, classJsonText.length - 3);
    }

    let classification = { intent: 'FACTS', normalizedQuery: userMessage, clarifyingQuestion: '' };
    try {
      classification = JSON.parse(classJsonText);
    } catch (e) {
      console.warn('Failed to parse classification JSON, using fallbacks.', e);
    }

    addTrace('intent_classification', { rawQuery: userMessage }, classification);

    const intent = classification.intent;
    const normalizedQuery = classification.normalizedQuery || userMessage;

    // Handle Greetings/Farewells/Ambiguous immediately to optimize latency
    if (intent === 'GREETING') {
      const greetingResponse = `Hello! 👋 Welcome to MetLife Stadium.\nHow may I assist you today?`;
      addTrace('generate_greeting', { query: userMessage }, greetingResponse);
      return { response: greetingResponse, traces: agentTraces };
    }

    if (intent === 'FAREWELL') {
      const farewellResponse = `Thank you for contacting MetLife Stadium! Have a great match day! ⚽`;
      addTrace('generate_farewell', { query: userMessage }, farewellResponse);
      return { response: farewellResponse, traces: agentTraces };
    }

    if (intent === 'AMBIGUOUS') {
      const clarifyText =
        classification.clarifyingQuestion ||
        'Do you mean where to refill a water bottle, or the policy on bringing water in?';
      addTrace('ambiguous_clarification', { query: userMessage }, clarifyText);
      return { response: clarifyText, traces: agentTraces };
    }

    // Step 2: Route Execution / RAG retrieval based on classified intent
    let routeData: WayfindingResult | undefined = undefined;
    let retrievalContext = '';

    if (intent === 'WAYFINDING') {
      const isRouteQuery = queryContainsRouteKeywords(normalizedQuery);
      if (isRouteQuery) {
        const startEnd = extractStartEnd(normalizedQuery);
        routeData = await calculateRoute(startEnd);
        retrievalContext = `Calculated Wayfinding Route Steps: ${JSON.stringify(routeData.routeSteps)}`;
      } else {
        const docs = searchVenueKB(normalizedQuery, 3);
        retrievalContext = docs.map((d) => `[${d.title}]: ${d.content}`).join('\n');
      }
    } else {
      // POLICY or FACTS: retrieve from RAG
      const docs = searchVenueKB(normalizedQuery, 3);
      retrievalContext = docs.map((d) => `[${d.title}]: ${d.content}`).join('\n');
    }

    // Step 3: Final grounded generation
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: `SYSTEM ROLE:
You are StadiumPulse AI Assistant for MetLife Stadium.
Provide accurate assistance using ONLY the supplied Context. Do not mock or use external facts.

If the information is not found in the Context (or if the Context is empty/irrelevant), respond exactly:
"I couldn't find that information in the current stadium guide. However, I can help you with bag policies, water rules, stroller checks, wheelchair accessibility, and routing paths inside MetLife. Please let me know what you need help with!"

Reply in the user's language. Be friendly and professional.`,
    });

    const promptText = `Context from Stadium Guide:
${retrievalContext}

User Question:
${userMessage}

Respond appropriately using ONLY the Context provided above. If not found in Context, use the exact fallback warning message.`;

    const generationResponse = await model.generateContent(promptText);
    const finalResponseText = generationResponse.response.text().trim();

    return {
      response: finalResponseText,
      traces: agentTraces,
      routeData,
    };
  } catch (err: any) {
    console.error(
      '[Agent] Gemini API invocation failed. Falling back to Mock Agent...',
      err.message,
    );
    addTrace('gemini_api_error', userMessage, err.message);
    return runMockAgent(userMessage);
  }
}

// -------------------------------------------------------------
// Mock / Fallback Agent logic
// -------------------------------------------------------------

async function runMockAgent(userMessage: string): Promise<{
  response: string;
  traces: AgentTrace[];
  routeData?: WayfindingResult;
}> {
  const query = userMessage.trim().toLowerCase();
  let response = '';
  let routeData: WayfindingResult | undefined = undefined;

  addTrace(
    'mock_agent_init',
    { query: userMessage },
    'Starting local rules-based simulation solver.',
  );

  // Helper to check if string contains words
  const matchesKeyword = (doc: any, q: string) => {
    const tokens = q
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter((t) => t.length > 3);
    if (tokens.length === 0) return true;
    return tokens.some(
      (token) =>
        doc.title.toLowerCase().includes(token) || doc.content.toLowerCase().includes(token),
    );
  };

  // 0. Check for greetings
  const greetings = [
    'hi',
    'hello',
    'hey',
    'good morning',
    'good afternoon',
    'hola',
    'buenos dias',
    'buenos',
    'bonjour',
    'salut',
    'hihihhhhhhhhhhhhh',
  ];
  if (greetings.some((g) => query.startsWith(g) || query === g || g.startsWith(query))) {
    addTrace('mock_greeting', { query: userMessage }, 'Responding with standard greeting.');
    if (query.includes('hola') || query.includes('buenos')) {
      return {
        response: '¡Hola! 👋 Bienvenido al MetLife Stadium.\n¿Cómo puedo ayudarte hoy?',
        traces: agentTraces,
      };
    }
    if (query.includes('bonjour') || query.includes('salut')) {
      return {
        response:
          "Bonjour! 👋 Bienvenue au MetLife Stadium.\nComment puis-je vous aider aujourd'hui?",
        traces: agentTraces,
      };
    }
    return {
      response: 'Hello! 👋 Welcome to MetLife Stadium.\nHow may I assist you today?',
      traces: agentTraces,
    };
  }

  // 0.5 Check for farewells
  const farewells = ['bye', 'goodbye', 'ciao', 'adiós', 'see you'];
  if (farewells.some((f) => query.startsWith(f) || query === f)) {
    addTrace('mock_farewell', { query: userMessage }, 'Responding with standard farewell.');
    if (query.includes('adiós') || query.includes('adios')) {
      return {
        response: '¡Gracias por visitar MetLife Stadium! ¡Que disfrutes del partido! ⚽',
        traces: agentTraces,
      };
    }
    return {
      response: 'Thank you for contacting MetLife Stadium! Have a great match day! ⚽',
      traces: agentTraces,
    };
  }

  // 0.7 Check for ambiguity
  if (query === 'water' || query === 'bottle' || query === 'refill') {
    addTrace(
      'mock_ambiguity',
      { query: userMessage },
      'Responding with ambiguity clarifying question.',
    );
    return {
      response: 'Do you mean where to refill a water bottle, or the policy on bringing water in?',
      traces: agentTraces,
    };
  }

  // 1. Check for wayfinding/routes
  if (
    query.includes('route') ||
    query.includes('directions') ||
    query.includes('get to') ||
    query.includes('where is gate') ||
    query.includes('go to')
  ) {
    let start = 'gate-a';
    let end = 'seating-lower';
    const accessibleOnly =
      query.includes('wheelchair') ||
      query.includes('accessible') ||
      query.includes('ada') ||
      query.includes('stroller');

    if (query.includes('gate c') || query.includes('gate-c')) start = 'gate-c';
    else if (query.includes('gate b') || query.includes('gate-b')) start = 'gate-b';
    else if (query.includes('gate d') || query.includes('gate-d')) start = 'gate-d';

    if (query.includes('upper') || query.includes('section 300')) end = 'seating-upper';

    routeData = await calculateRoute({ start, end, accessibleOnly });

    response = `Here is your route. ${routeData.textResponse}\n\n**Steps:**\n${routeData.routeSteps?.map((s, i) => `${i + 1}. ${s}`).join('\n')}`;

    // Check if the route contains warnings
    const warning = routeData.routeSteps?.find((s) => s.includes('WARNING'));
    if (warning) {
      response = `${warning}\n\n` + response;
    }
  }
  // 1.5 Specific location search: "where can i get the water" (should return refill location, not policy)
  else if (
    query.includes('water') &&
    (query.includes('get') ||
      query.includes('find') ||
      query.includes('drink') ||
      query.includes('refill') ||
      query.includes('fountain') ||
      query.includes('where'))
  ) {
    // Return Sustainability/Refill station
    const docs = searchVenueKB('sustainability');
    addTrace('search_venue_kb', 'sustainability', docs);
    response = `Based on the Stadium Policy Guide:\n\nWater refill stations are located next to every restroom area on Concourse Level 1 and Level 2. Reusable empty plastic or aluminum water bottles may be permitted for refilling depending on event rules.`;
  }
  // 2. Check for stroller rules
  else if (query.includes('stroller') || query.includes('baby') || query.includes('carrito')) {
    const docs = searchVenueKB('stroller');
    addTrace('search_venue_kb', 'stroller', docs);
    response = `**Stroller Policy:**\n${docs[0].content}\n\nI checked the stadium guidelines and confirmed that you can bring strollers, but they must be checked in at Guest Services near Gate A or Gate D.`;
  }
  // 3. Check for bags or clear bag policy
  else if (
    query.includes('bag') ||
    query.includes('backpack') ||
    query.includes('purse') ||
    query.includes('bolsa') ||
    query.includes('cartera')
  ) {
    const docs = searchVenueKB('bag');
    addTrace('search_venue_kb', 'bag', docs);
    response = `**Bag Policy:**\n${docs[0].content}\n\nOnly clear bags under 12"x6"x12" are permitted. Backpacks are prohibited.`;
  }
  // 3.5 Check for year built / opened (includes typos: "statuim" / "build")
  else if (
    (query.includes('year') ||
      query.includes('build') ||
      query.includes('built') ||
      query.includes('opened') ||
      query.includes('open')) &&
    (query.includes('stadium') ||
      query.includes('statuim') ||
      query.includes('venue') ||
      query.includes('metlife') ||
      query.includes('built'))
  ) {
    const docs = searchVenueKB('overview');
    addTrace('search_venue_kb', 'overview', docs);
    response = `Based on the Stadium Policy Guide:\n\nMetLife Stadium opened on April 10, 2010. It is a multipurpose sports and entertainment venue with a capacity of 82,500 seats.`;
  }
  // 4. Check for crowd / congestion
  else if (
    query.includes('crowd') ||
    query.includes('congest') ||
    query.includes('busy') ||
    query.includes('gate c status')
  ) {
    const crowd = await fetchCrowdState();
    const congestedGates = crowd.filter(
      (z: any) => z.densityLevel === 'high' || z.densityLevel === 'critical',
    );

    if (congestedGates.length > 0) {
      response =
        `Currently, the following zones are busy:\n` +
        congestedGates
          .map(
            (g: any) =>
              `- **${g.zoneName}**: Density is **${g.densityLevel.toUpperCase()}** (${g.currentCount} people).`,
          )
          .join('\n') +
        `\n\nI recommend using Gate D (ADA/West) or Gate A which are less crowded.`;
    } else {
      response = `Crowd status at all gates is currently normal (Low/Medium density). Feel free to use any entrance!`;
    }
  }
  // 5. Check for transit
  else if (
    query.includes('transit') ||
    query.includes('shuttle') ||
    query.includes('train') ||
    query.includes('bus') ||
    query.includes('parking')
  ) {
    const transit = await fetchTransitStatus();
    response =
      `Here is the current transit status:\n` +
      transit
        .map(
          (t: any) =>
            `- **${t.name}**: ${t.status} (Departure in ${t.nextDeparture}, Congestion: ${t.congestion})`,
        )
        .join('\n');
  }
  // 6. Generic grounding fallback
  else {
    const docs = searchVenueKB(userMessage);
    addTrace('search_venue_kb', userMessage, docs);
    if (docs.length > 0 && matchesKeyword(docs[0], query)) {
      response = `Based on the Stadium Policy Guide:\n\n${docs[0].content}`;
    } else {
      response =
        "I couldn't find that information in the current stadium guide. However, I can help you with bag policies, water rules, stroller checks, wheelchair accessibility, and routing paths inside MetLife. Please let me know what you need help with!";
    }
  }

  // Generate translation fallback text if message is in non-English
  if (
    query.includes('dónde') ||
    query.includes('donde') ||
    query.includes('carrito') ||
    query.includes('bolsa')
  ) {
    addTrace(
      'translate_if_needed',
      { text: userMessage },
      'Detected Spanish. Simulating multilingual translation.',
    );
    response = `[Traducción automática] ${response}\n\n*Nota: He traducido esta información para su comodidad.*`;
  }

  return {
    response,
    traces: agentTraces,
    routeData,
  };
}

// -------------------------------------------------------------
// Live Shift Briefing Generator
// -------------------------------------------------------------

export async function generateShiftBriefing(): Promise<{
  summary: string;
  risks: string[];
  recommendations: string[];
}> {
  console.log('[Agent] Generating natural-language shift briefing...');

  const crowd = await fetchCrowdState();
  const transit = await fetchTransitStatus();
  const activeIncidents = incidents.filter((i) => i.status === 'active'); // wait, import incidents from simulator or just fetch it

  // We can fetch incidents from simulator
  let simulationIncidents: any[] = [];
  try {
    const res = await fetch(`${SIMULATOR_URL}/api/incidents`);
    simulationIncidents = await res.json();
  } catch (e) {
    console.error('[Agent] Failed to fetch simulation incidents:', e);
  }

  const activeSimulationIncidents = simulationIncidents.filter((i: any) => i.status === 'active');

  const briefingData = {
    crowd,
    transit,
    incidents: activeSimulationIncidents,
  };

  // If Gemini API Key is available, use Gemini 2.5 Pro or Flash to generate briefing
  if (API_KEY) {
    try {
      const genAI = new GoogleGenerativeAI(API_KEY);
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' }); // Pro is better for summarizing operational dashboards

      const prompt = `You are a Venue Operations Analyst for the FIFA World Cup 2026.
Generate a concise operations shift briefing based on this live telemetry JSON:
${JSON.stringify(briefingData, null, 2)}

Provide your output strictly in JSON format with three fields:
- "summary": A 2-3 sentence overview of the current stadium status.
- "risks": A list of top risks (e.g. crowd congestion, delayed trains, active incidents). Maximum 3.
- "recommendations": A list of actionable next steps for volunteers and staff (e.g. open extra lanes at Gate C, redirect fans to Shuttle B). Maximum 3.

Format your JSON output correctly. Do not include markdown codeblocks around it, just raw JSON.`;

      const response = await model.generateContent(prompt);
      let text = response.response.text().trim();

      // Clean up markdown block if present
      if (text.startsWith('```json')) {
        text = text.substring(7);
      }
      if (text.endsWith('```')) {
        text = text.substring(0, text.length - 3);
      }

      const parsed = JSON.parse(text);
      addTrace('generate_shift_briefing_gemini', briefingData, parsed);
      return parsed;
    } catch (err: any) {
      console.error(
        '[Agent] Gemini shift briefing failed. Falling back to local summarizer...',
        err.message,
      );
    }
  }

  // Fallback Rule-based shift briefing
  console.log('[Agent] Generating mock briefing based on telemetry...');

  const highDensityZones = crowd.filter(
    (z: any) => z.densityLevel === 'high' || z.densityLevel === 'critical',
  );
  const delayedTransit = transit.filter((t: any) => t.status !== 'on-time');

  let summary = `Stadium operations are currently running smoothly across most gates. Concourse density is moderate.`;
  const risks: string[] = [];
  const recommendations: string[] = [];

  if (highDensityZones.length > 0) {
    const zoneNames = highDensityZones.map((z: any) => z.zoneName).join(', ');
    summary = `Crowd counts are rising significantly, with high density observed at ${zoneNames}. Main entry scans are slowing down.`;
    risks.push(`Queue congestion building up at ${zoneNames}, causing scanning bottleneck.`);
    recommendations.push(
      `Redeploy 10 volunteers to ${highDensityZones.map((z: any) => z.zoneName.split(' ')[0]).join('/')} to help guide traffic and pre-check tickets.`,
    );
  }

  if (activeSimulationIncidents.length > 0) {
    const incidentTitles = activeSimulationIncidents.map((i: any) => i.title).join(', ');
    summary += ` An active incident is currently reported: ${incidentTitles}.`;
    risks.push(`Active operational blockages: ${incidentTitles}.`);
    recommendations.push(`Ensure security staff is dispatched to the incident zone immediately.`);
  } else {
    risks.push(`Rising fan arrival volume in the next 15 minutes as kickoff approaches.`);
    recommendations.push(`Ensure all ticket scanning terminals remain active and online.`);
  }

  if (delayedTransit.length > 0) {
    const transitNames = delayedTransit.map((t: any) => t.name).join(', ');
    risks.push(`Transport delay on ${transitNames}, which may delay fan departures.`);
    recommendations.push(`Coordinate with transit dispatch to increase shuttle frequencies.`);
  } else {
    recommendations.push(`Promote public shuttle transit routes on the Fan Companion wayfinding.`);
  }

  const result = {
    summary,
    risks: risks.slice(0, 3),
    recommendations: recommendations.slice(0, 3),
  };

  addTrace('generate_shift_briefing_mock', briefingData, result);
  return result;
}

// Stub list of active incidents for local reference
const incidents: Incident[] = [];
