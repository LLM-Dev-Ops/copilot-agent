// Cloud Function entry point wrapper
// Re-exports the pre-built handler from lib/
const { handler } = require('./lib/functions/src/index');
exports.handler = handler;
