/**
 * A world-height cut for materials (the build and label reveals). three.js local clipping
 * planes would do this, but compileAsync can't precompile clipped programs (clipping state
 * is only set per object during a render), so their first use compiled synchronously and
 * blocked the main thread for over half a second. A uniform-driven discard keeps one
 * stable program per material that compiles off the main thread like the rest.
 */
import type { Material, WebGLProgramParametersWithUniforms } from 'three';

export interface HeightClip {
  value: number;
}

/**
 * Discards fragments above `height` (dir 1) or below it (dir -1), in world units.
 * `extra` can edit the shader further; `key` must be unique per shader variant.
 */
export function addHeightClip(
  material: Material,
  height: HeightClip,
  dir: 1 | -1,
  key: string,
  extra?: (shader: WebGLProgramParametersWithUniforms) => void,
): void {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uClipY = height;
    shader.uniforms.uClipDir = { value: dir };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vClipWorldY;')
      .replace(
        '#include <project_vertex>',
        '#include <project_vertex>\n\tvClipWorldY = ( modelMatrix * vec4( transformed, 1.0 ) ).y;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying float vClipWorldY;\nuniform float uClipY;\nuniform float uClipDir;',
      )
      .replace('void main() {', 'void main() {\n\tif ( ( vClipWorldY - uClipY ) * uClipDir > 0.0 ) discard;');
    extra?.(shader);
  };
  material.customProgramCacheKey = () => `height-clip:${key}`;
}
