const assert = require('node:assert/strict');
const { validateRenderer } = require('../scripts/webkit_renderer_probe.cjs');
assert.deepEqual(validateRenderer({ renderer: 'softpipe' }, 'softpipe'), { renderer: 'softpipe' });
assert.deepEqual(validateRenderer({ renderer: 'llvmpipe' }, 'default'), { renderer: 'llvmpipe' });
assert.deepEqual(validateRenderer({ renderer: 'Apple GPU' }), { renderer: 'Apple GPU' });
assert.throws(() => validateRenderer({ reason: 'unavailable' }, 'softpipe'), /renderer unavailable/);
console.log('WebGL exposure validation: four checks passed');
