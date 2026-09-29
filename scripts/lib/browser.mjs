/**
 * Chromium launch flags for scripts. By default Chromium renders WebGL on the machine's
 * GPU through ANGLE (D3D11 on Windows, like desktop Chrome). SOFTWARE_GL=1 forces
 * SwiftShader instead, the path CI machines without a GPU take.
 */
export function chromiumArgs() {
  if (process.env.SOFTWARE_GL === '1') return [];
  const angle = process.platform === 'win32' ? 'd3d11' : process.platform === 'darwin' ? 'metal' : 'gl';
  return ['--enable-gpu', '--ignore-gpu-blocklist', `--use-angle=${angle}`];
}

export function launchOptions() {
  return { args: chromiumArgs(), executablePath: process.env.CHROME_PATH || undefined };
}
