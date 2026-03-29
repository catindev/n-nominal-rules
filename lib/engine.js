/**
 * lib/engine.js
 *
 * Thin re-export: delegates createEngine to the jsonspecs library.
 * All engine logic (compiler, runner, wildcard, aggregation) lives in jsonspecs.
 * This project owns only the application layer: loader-fs, custom operators,
 * HTTP server, docs routes.
 */
const { createEngine } = require("jsonspecs");

module.exports = { createEngine };
