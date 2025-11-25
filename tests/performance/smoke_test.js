// Smoke test - Quick validation of performance (5 minutes)
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const intentAccuracy = new Rate('intent_accuracy');
const responseTime = new Trend('response_time');

export const options = {
  stages: [
    { duration: '1m', target: 50 },    // Ramp up
    { duration: '3m', target: 100 },   // Steady load
    { duration: '1m', target: 0 },     // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],  // 95% under 2s
    http_req_failed: ['rate<0.01'],     // <1% errors
    intent_accuracy: ['rate>0.95'],     // >95% accuracy
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:8081';

export default function() {
  // Create session
  const sessionRes = http.post(`${BASE_URL}/api/v1/sessions`, JSON.stringify({
    user_id: `user_${__VU}_${__ITER}`,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  const sessionOk = check(sessionRes, {
    'session created': (r) => r.status === 201,
  });

  if (!sessionOk) {
    console.error('Failed to create session:', sessionRes.status, sessionRes.body);
    return;
  }

  const sessionId = sessionRes.json('session_id');

  // Test queries
  const queries = [
    'Show me CPU usage for auth-service',
    'What errors occurred in the last hour?',
    'Show me memory usage',
    'Find logs for payment-service',
  ];

  const query = queries[Math.floor(Math.random() * queries.length)];
  const queryStart = Date.now();

  const queryRes = http.post(`${BASE_URL}/api/v1/messages`, JSON.stringify({
    session_id: sessionId,
    message: query,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  const duration = Date.now() - queryStart;
  responseTime.add(duration);

  const queryOk = check(queryRes, {
    'query successful': (r) => r.status === 200,
    'has intent': (r) => {
      try {
        const json = r.json();
        return json.intent_type !== undefined;
      } catch {
        return false;
      }
    },
  });

  if (queryOk && queryRes.status === 200) {
    try {
      const json = queryRes.json();
      if (json.confidence >= 0.95) {
        intentAccuracy.add(1);
      } else {
        intentAccuracy.add(0);
      }
    } catch {
      intentAccuracy.add(0);
    }
  } else {
    intentAccuracy.add(0);
  }

  sleep(1);
}

export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
  };
}
