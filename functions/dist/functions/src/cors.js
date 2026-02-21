"use strict";
/**
 * CORS Middleware for Cloud Functions
 *
 * Handles preflight requests and sets CORS headers on all responses.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.setCorsHeaders = setCorsHeaders;
exports.handlePreflight = handlePreflight;
const ALLOWED_ORIGINS = [
    'https://agentics.dev',
    'https://console.agentics.dev',
    'https://us-central1-agentics-dev.cloudfunctions.net',
];
const ALLOWED_METHODS = 'GET, POST, OPTIONS';
const ALLOWED_HEADERS = 'Content-Type, Authorization, X-Correlation-Id, X-Request-Id';
const MAX_AGE = '3600';
/**
 * Set CORS headers on the response
 */
function setCorsHeaders(res) {
    // Allow any origin for now (can be restricted via ALLOWED_ORIGINS in production)
    res.setHeader('Access-Control-Allow-Origin', '*');
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
//# sourceMappingURL=cors.js.map