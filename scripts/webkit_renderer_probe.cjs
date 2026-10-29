// Diagnostic only: WebGL identifies the renderer exposed to a page, which may
// not be the same context as WebKit's compositor. Never changes primary CI.
const { webkit } = require('playwright');

function validateRenderer(info, expected) {
  if (!info.renderer) throw new Error(`WebGL renderer unavailable: ${info.reason || 'unknown'}`);
  if (expected === 'softpipe' && !/softpipe/i.test(info.renderer)) {
    throw new Error(`Requested softpipe but WebGL reported ${info.renderer}`);
  }
  return info;
}

async function main() {
  const browser = await webkit.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const info = await page.evaluate(() => {
      const gl = document.createElement('canvas').getContext('webgl');
      if (!gl) return { reason: 'WebGL context unavailable' };
      const debug = gl.getExtension('WEBGL_debug_renderer_info');
      if (!debug) return { reason: 'WEBGL_debug_renderer_info unavailable' };
      return { vendor: gl.getParameter(debug.UNMASKED_VENDOR_WEBGL),
        renderer: gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) };
    });
    console.log(`WebGL renderer (not necessarily compositor): ${JSON.stringify(info)}`);
    validateRenderer(info, process.env.GALLIUM_DRIVER || 'default');
    console.log(`::notice title=WebGL renderer::${JSON.stringify(info).replace(/%/g, '%25')}`);
  } finally {
    await browser.close();
  }
}

if (require.main === module) main().catch((error) => { console.error(error); process.exitCode = 1; });
module.exports = { validateRenderer };
