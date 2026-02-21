// Cloud Function entry point wrapper
// Re-exports the pre-built handler from dist/
const { handler } = require('./dist/functions/src/index');
exports.handler = handler;
