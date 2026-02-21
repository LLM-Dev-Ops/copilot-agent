/**
 * CORS Middleware for Cloud Functions
 *
 * Handles preflight requests and sets CORS headers on all responses.
 */
import { CfResponse } from './index';
/**
 * Set CORS headers on the response
 */
export declare function setCorsHeaders(res: CfResponse): void;
/**
 * Handle CORS preflight (OPTIONS) request
 */
export declare function handlePreflight(res: CfResponse): void;
