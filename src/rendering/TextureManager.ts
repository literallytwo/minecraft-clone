import * as THREE from 'three';

const ATLAS_SIZE = 4;
const TILE_SIZE = 16;
const TOTAL_SIZE = ATLAS_SIZE * TILE_SIZE;

// block colors [row][col]
const BLOCK_COLORS = [
  ['#5d9b3d', '#8b6b47', '#8b6b47', '#808080'], // grass top, grass side, dirt, stone
  ['#333333', '#e8d8a0', '#3d6ea8', '#b5985a'], // bedrock, sand, water, wood top
  ['#6b4423', '#3d8b3d', '#ff00ff', '#ff00ff'], // wood side, leaves
  ['#ff00ff', '#ff00ff', '#ff00ff', '#ff00ff'],
];

class TextureManager {
  private textureAtlas: THREE.Texture | null = null;
  private material: THREE.MeshLambertMaterial | null = null;
  private waterMaterial: THREE.MeshLambertMaterial | null = null;

  async load(): Promise<void> {
    // generate texture atlas on canvas
    const canvas = document.createElement('canvas');
    canvas.width = TOTAL_SIZE;
    canvas.height = TOTAL_SIZE;
    const ctx = canvas.getContext('2d')!;

    for (let row = 0; row < ATLAS_SIZE; row++) {
      for (let col = 0; col < ATLAS_SIZE; col++) {
        const x = col * TILE_SIZE;
        const y = row * TILE_SIZE;
        const color = BLOCK_COLORS[row][col];

        // fill base color
        ctx.fillStyle = color;
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

        // add noise texture
        for (let px = 0; px < TILE_SIZE; px++) {
          for (let py = 0; py < TILE_SIZE; py++) {
            if (Math.random() > 0.7) {
              const bright = Math.random() > 0.5;
              ctx.fillStyle = bright ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
              ctx.fillRect(x + px, y + py, 1, 1);
            }
          }
        }

        // grass top detail
        if (row === 0 && col === 0) {
          ctx.fillStyle = '#4a8030';
          for (let i = 0; i < 6; i++) {
            ctx.fillRect(x + Math.random() * TILE_SIZE, y + Math.random() * TILE_SIZE, 1, 2);
          }
        }

        // grass side (dirt with grass strip on top)
        if (row === 0 && col === 1) {
          ctx.fillStyle = '#5d9b3d';
          ctx.fillRect(x, y, TILE_SIZE, 3);
        }
      }
    }

    this.textureAtlas = new THREE.CanvasTexture(canvas);
    this.textureAtlas.magFilter = THREE.NearestFilter;
    this.textureAtlas.minFilter = THREE.NearestFilter;
    this.textureAtlas.colorSpace = THREE.SRGBColorSpace;

    this.material = new THREE.MeshLambertMaterial({
      map: this.textureAtlas,
      side: THREE.FrontSide,
    });

    this.waterMaterial = new THREE.MeshLambertMaterial({
      map: this.textureAtlas,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
    });
  }

  getMaterial(): THREE.MeshLambertMaterial {
    if (!this.material) {
      throw new Error('textures not loaded yet, call load() first');
    }
    return this.material;
  }

  getWaterMaterial(): THREE.MeshLambertMaterial {
    if (!this.waterMaterial) {
      throw new Error('textures not loaded yet, call load() first');
    }
    return this.waterMaterial;
  }

  getTexture(): THREE.Texture {
    if (!this.textureAtlas) {
      throw new Error('textures not loaded yet, call load() first');
    }
    return this.textureAtlas;
  }
}

export const textureManager = new TextureManager();
