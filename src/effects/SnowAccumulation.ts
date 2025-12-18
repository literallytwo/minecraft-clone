import { world } from '../world/World';
import { BlockType, isBlockSolid } from '../world/Block';
import { CHUNK_WIDTH, CHUNK_DEPTH, RENDER_DISTANCE } from '../utils/constants';

const ACCUMULATION_INTERVAL = 5000; // ms between accumulation passes
const BLOCKS_PER_PASS = 10;

export class SnowAccumulation {
  private lastAccumulationTime = 0;
  private checkQueue: Array<{ x: number; z: number }> = [];

  update(currentTime: number, playerX: number, playerZ: number): void {
    if (currentTime - this.lastAccumulationTime < ACCUMULATION_INTERVAL) {
      return;
    }
    this.lastAccumulationTime = currentTime;

    // build queue if empty
    if (this.checkQueue.length === 0) {
      this.buildCheckQueue(playerX, playerZ);
    }

    // process some positions
    for (let i = 0; i < BLOCKS_PER_PASS && this.checkQueue.length > 0; i++) {
      const pos = this.checkQueue.pop()!;
      this.tryPlaceSnow(pos.x, pos.z);
    }
  }

  private buildCheckQueue(playerX: number, playerZ: number): void {
    const chunkX = Math.floor(playerX / CHUNK_WIDTH);
    const chunkZ = Math.floor(playerZ / CHUNK_DEPTH);

    for (let dx = -RENDER_DISTANCE; dx <= RENDER_DISTANCE; dx++) {
      for (let dz = -RENDER_DISTANCE; dz <= RENDER_DISTANCE; dz++) {
        const baseX = (chunkX + dx) * CHUNK_WIDTH;
        const baseZ = (chunkZ + dz) * CHUNK_DEPTH;

        // add random positions in this chunk
        for (let i = 0; i < 5; i++) {
          this.checkQueue.push({
            x: baseX + Math.floor(Math.random() * CHUNK_WIDTH),
            z: baseZ + Math.floor(Math.random() * CHUNK_DEPTH),
          });
        }
      }
    }

    // shuffle for random distribution
    for (let i = this.checkQueue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.checkQueue[i], this.checkQueue[j]] = [this.checkQueue[j], this.checkQueue[i]];
    }
  }

  private tryPlaceSnow(worldX: number, worldZ: number): void {
    const surface = world.getSurfaceBlock(worldX, worldZ);
    if (!surface) return;

    const { y, blockType } = surface;

    // no snow on water, existing snow, or leaves
    if (blockType === BlockType.WATER) return;
    if (blockType === BlockType.SNOW) return;
    if (blockType === BlockType.LEAVES) return;

    // check if space above is clear
    const above = world.getBlock(worldX, y + 1, worldZ);
    if (above !== BlockType.AIR) return;

    // check for sky exposure (nothing solid above for ~10 blocks)
    for (let checkY = y + 2; checkY < y + 10; checkY++) {
      if (isBlockSolid(world.getBlock(worldX, checkY, worldZ))) {
        return; // covered, no snow
      }
    }

    world.setBlock(worldX, y + 1, worldZ, BlockType.SNOW);
  }
}
