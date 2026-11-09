"use strict";
/**
 * CORS Middleware for Cloud Functions
 *
 * Handles preflight requests and sets CORS headers on all responses.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.setCorsHeaders = setCorsHeaders;
exports.handlePreflight = handlePreflight;
const ALLOWED_ORIGINS = new Set([
    'https://agentics.dev',
    'https://console.agentics.dev',
    'https://us-central1-agentics-dev.cloudfunctions.net',
]);
const ALLOWED_METHODS = 'GET, POST, OPTIONS';
const ALLOWED_HEADERS = 'Content-Type, Authorization, X-Anthropic-Api-Key, X-Correlation-Id, X-Request-Id';
const MAX_AGE = '3600';
/**
 * Set CORS headers on the response
 */
function setCorsHeaders(req, res) {
    const origin = req.headers.origin;
    if (typeof origin === 'string' && ALLOWED_ORIGINS.has(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Methods', ALLOWED_METHODS);
    res.setHeader('Access-Control-Allow-Headers', ALLOWED_HEADERS);
    res.setHeader('Access-Control-Max-Age', MAX_AGE);
}
/**
 * Handle CORS preflight (OPTIONS) request
 */
function handlePreflight(res) {
    res.writeHead(204);
    res.end();
}
