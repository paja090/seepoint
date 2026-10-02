// Node tests execute server code. Next provides this marker through its bundler;
// the standalone Node runner needs the equivalent server-side no-op.
const Module = require('node:module');
const originalLoad = Module._load;
Module._load = function (id, ...args) {
  return id === 'server-only' ? {} : originalLoad.call(this, id, ...args);
};
