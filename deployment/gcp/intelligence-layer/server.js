/**
 * Intelligence Layer Agent HTTP Server - Phase 7 (Layer 2)
 *
 * Cloud Run compatible HTTP server exposing the agent via REST API.
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');

// Import bundled agent
const {
  IntelligenceLayerAgent,
  IntelligenceLayerInputSchema,
  PHASE7_PERFORMANCE_BUDGETS,
  createRuvectorFromEnv,
  createTelemetryFromEnv,
} = require('./agent-bundle');

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(express.json({ limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  if (process.env.ENABLE_REQUEST_LOGGING === 'true') {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  }
  next();
});

// Create agent instance
const persistence = createRuvectorFromEnv();
const telemetry = createTelemetryFromEnv();
const agent = new IntelligenceLayerAgent(persistence, telemetry);

// Health endpoints
app.get('/health/startup', (req, res) => {
  res.status(200).json({ status: 'ok', phase: 7, layer: 2 });
});

app.get('/health/live', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'intelligence-layer-agent' });
});

app.get('/health/ready', (req, res) => {
  const ruvectorConfigured = !!process.env.RUVECTOR_ENDPOINT;
  if (ruvectorConfigured) {
    res.status(200).json({ status: 'ready', ruvector: 'configured' });
  } else {
    res.status(503).json({ status: 'not_ready', reason: 'RUVECTOR_ENDPOINT not configured' });
  }
});

// Agent metadata endpoint
app.get('/metadata', (req, res) => {
  res.json({
    ...agent.metadata,
    phase: 7,
    layer: 2,
    role_clarity: {
      may: ['reason', 'simulate', 'explore'],
      must: ['emit signals', 'avoid final decisions'],
    },
    signals_emitted: [
      'hypothesis_signal',
      'simulation_outcome_signal',
      'confidence_delta_signal',
    ],
    performance_budgets: {
      max_tokens: parseInt(process.env.MAX_TOKENS || PHASE7_PERFORMANCE_BUDGETS.MAX_TOKENS),
      max_latency_ms: parseInt(process.env.MAX_LATENCY_MS || PHASE7_PERFORMANCE_BUDGETS.MAX_LATENCY_MS),
    },
  });
});

// Main invoke endpoint
app.post('/invoke', async (req, res) => {
  const startTime = Date.now();
  const executionRef = req.headers['x-execution-ref'] || uuidv4();

  try {
    const input = IntelligenceLayerInputSchema.parse(req.body);
    const result = await agent.invoke(input, executionRef);

    const latencyMs = Date.now() - startTime;
    const maxLatency = parseInt(process.env.MAX_LATENCY_MS || PHASE7_PERFORMANCE_BUDGETS.MAX_LATENCY_MS);

    if (latencyMs > maxLatency) {
      console.warn(`[WARN] Latency budget exceeded: ${latencyMs}ms > ${maxLatency}ms`);
    }

    res.set('X-Execution-Ref', executionRef);
    res.set('X-Latency-Ms', latencyMs.toString());

    if (result.status === 'success') {
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error(`[ERROR] Invoke failed: ${error.message}`);
    res.set('X-Execution-Ref', executionRef);
    res.status(500).json({
      status: 'error',
      error_code: error.name === 'ZodError' ? 'AGENT_VALIDATION_FAILED' : 'AGENT_PROCESSING_ERROR',
      error_message: error.message,
      execution_ref: executionRef,
      timestamp: new Date().toISOString(),
    });
  }
});

// Convenience endpoints
app.post('/reason', async (req, res) => {
  req.body.mode = 'reason';
  const startTime = Date.now();
  const executionRef = req.headers['x-execution-ref'] || uuidv4();

  try {
    const input = IntelligenceLayerInputSchema.parse(req.body);
    const result = await agent.invoke(input, executionRef);
    res.set('X-Execution-Ref', executionRef);
    res.set('X-Latency-Ms', (Date.now() - startTime).toString());
    res.status(result.status === 'success' ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({ status: 'error', error_message: error.message, execution_ref: executionRef });
  }
});

app.post('/simulate', async (req, res) => {
  req.body.mode = 'simulate';
  const startTime = Date.now();
  const executionRef = req.headers['x-execution-ref'] || uuidv4();

  try {
    const input = IntelligenceLayerInputSchema.parse(req.body);
    const result = await agent.invoke(input, executionRef);
    res.set('X-Execution-Ref', executionRef);
    res.set('X-Latency-Ms', (Date.now() - startTime).toString());
    res.status(result.status === 'success' ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({ status: 'error', error_message: error.message, execution_ref: executionRef });
  }
});

app.post('/explore', async (req, res) => {
  req.body.mode = 'explore';
  const startTime = Date.now();
  const executionRef = req.headers['x-execution-ref'] || uuidv4();

  try {
    const input = IntelligenceLayerInputSchema.parse(req.body);
    const result = await agent.invoke(input, executionRef);
    res.set('X-Execution-Ref', executionRef);
    res.set('X-Latency-Ms', (Date.now() - startTime).toString());
    res.status(result.status === 'success' ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({ status: 'error', error_message: error.message, execution_ref: executionRef });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`[Intelligence Layer Agent] Phase 7, Layer 2`);
  console.log(`[Intelligence Layer Agent] Listening on port ${PORT}`);
  console.log(`[Intelligence Layer Agent] Performance budgets: MAX_TOKENS=${process.env.MAX_TOKENS || PHASE7_PERFORMANCE_BUDGETS.MAX_TOKENS}, MAX_LATENCY_MS=${process.env.MAX_LATENCY_MS || PHASE7_PERFORMANCE_BUDGETS.MAX_LATENCY_MS}`);
  console.log(`[Intelligence Layer Agent] RuVector: ${process.env.RUVECTOR_ENDPOINT || 'not configured'}`);
  console.log(`[Intelligence Layer Agent] Telemetry: ${process.env.TELEMETRY_ENABLED !== 'false' ? 'enabled' : 'disabled'}`);
});
