import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import {
  processAgentChat,
  generateShiftBriefing,
  agentTraces,
  clearTraces,
} from './agent/orchestrator';

dotenv.config({ path: '../../.env' });

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || process.env.PORT_AGENT_CORE || 3001;

// REST API Endpoints

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'agent-core' });
});

// Chat session route
app.post('/api/chat', async (req, res) => {
  try {
    const { message, messageId, history } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Message field is required.' });
    }

    const chatHistory = history || [];
    const result = await processAgentChat(message, chatHistory);
    res.json({
      ...result,
      messageId: messageId || `msg-${Date.now()}`,
    });
  } catch (err: any) {
    console.error('Error in /api/chat:', err);
    res.status(500).json({ error: 'Internal Server Error', details: err.message });
  }
});

// Live Situational Shift Briefing
app.get('/api/briefing', async (req, res) => {
  try {
    const briefing = await generateShiftBriefing();
    res.json(briefing);
  } catch (err: any) {
    console.error('Error in /api/briefing:', err);
    res.status(500).json({ error: 'Internal Server Error', details: err.message });
  }
});

// Traces endpoints for dashboard
app.get('/api/traces', (req, res) => {
  res.json(agentTraces);
});

app.post('/api/traces/clear', (req, res) => {
  clearTraces();
  res.json({ message: 'Traces cleared successfully.' });
});

app.listen(PORT, () => {
  console.log(`[Agent Core] Running on http://localhost:${PORT}`);
});
