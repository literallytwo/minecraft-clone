import { createNoise2D, createNoise3D, type NoiseFunction2D, type NoiseFunction3D } from 'simplex-noise';
import { BlockType } from './Block';
import { SEA_LEVEL } from '../utils/constants';

class TerrainGenerator {
  private noise2D!: NoiseFunction2D;
  private noise3D!: NoiseFunction3D;
  private seed: number;

  constructor(seed?: number) {
    this.seed = seed ?? Math.random() * 10000;
    this.initNoise();
  }

  private initNoise(): void {
    const seededRandom = this.createSeededRandom(this.seed);
    this.noise2D = createNoise2D(seededRandom);
    this.noise3D = createNoise3D(seededRandom);
  }

  setSeed(seed: number): void {
    this.seed = seed;
    this.initNoise();
  }

  private createSeededRandom(seed: number): () => number {
    return () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
  }

  // get terrain height at world position
  getHeight(worldX: number, worldZ: number): number {
    // layer multiple octaves for more interesting terrain
    let height = 0;

    // base terrain - large hills
    height += this.noise2D(worldX * 0.01, worldZ * 0.01) * 20;

    // medium detail
    height += this.noise2D(worldX * 0.03, worldZ * 0.03) * 10;

    // small detail
    height += this.noise2D(worldX * 0.1, worldZ * 0.1) * 3;

    // offset to make terrain mostly above 0
    height += 30;

    return Math.floor(height);
  }

  // get block type at world position
  getBlock(worldX: number, worldY: number, worldZ: number): BlockType {
    const surfaceHeight = this.getHeight(worldX, worldZ);

    // below world
    if (worldY < 0) return BlockType.BEDROCK;

    // above terrain
    if (worldY > surfaceHeight) {
      // fill with water if below sea level
      if (worldY <= SEA_LEVEL) return BlockType.WATER;
      return BlockType.AIR;
    }

    // bedrock layer
    if (worldY <= 1) return BlockType.BEDROCK;

    // cave generation using 3d noise
    const caveNoise = this.noise3D(worldX * 0.05, worldY * 0.05, worldZ * 0.05);
    if (caveNoise > 0.6 && worldY < surfaceHeight - 5 && worldY > 5) {
      return BlockType.AIR; // cave
    }

    // surface block
    if (worldY === surfaceHeight) {
      if (surfaceHeight < 25) return BlockType.SAND; // beach
      return BlockType.GRASS;
    }

    // just below surface
    if (worldY >= surfaceHeight - 3) {
      return BlockType.DIRT;
    }

    // deep underground - chance for ores would go here
    return BlockType.STONE;
  }
}

export const terrainGenerator = new TerrainGenerator();
