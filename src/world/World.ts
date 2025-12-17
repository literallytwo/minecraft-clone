import * as THREE from 'three';
import { Chunk, type WorldBlockGetter } from './Chunk';
import { BlockType, isBlockSolid, isBlockWater } from './Block';
import { CHUNK_WIDTH, CHUNK_HEIGHT, CHUNK_DEPTH, RENDER_DISTANCE } from '../utils/constants';
import { terrainGenerator } from './TerrainGenerator';
import { gameScene } from '../rendering/Scene';

class World {
  private chunks: Map<string, Chunk> = new Map();
  private raycaster = new THREE.Raycaster();

  // bound function for chunks to query cross-chunk block state
  private worldBlockGetter: WorldBlockGetter = this.getBlockForChunk.bind(this);

  private getChunkKey(chunkX: number, chunkZ: number): string {
    return `${chunkX},${chunkZ}`;
  }

  // get block at world coords, used by chunks for cross-chunk neighbor lookups
  // falls back to terrain generator if chunk doesn't exist (unloaded or not yet generated)
  private getBlockForChunk(worldX: number, worldY: number, worldZ: number): BlockType {
    // handle Y bounds
    if (worldY < 0 || worldY >= CHUNK_HEIGHT) {
      return terrainGenerator.getBlock(worldX, worldY, worldZ);
    }
    const [chunkX, chunkZ, localX, localY, localZ] = this.worldToLocal(worldX, worldY, worldZ);
    const chunk = this.chunks.get(this.getChunkKey(chunkX, chunkZ));
    if (!chunk) {
      // chunk not loaded, use terrain generator as fallback
      return terrainGenerator.getBlock(worldX, worldY, worldZ);
    }
    // get block directly from chunk's internal data to avoid infinite recursion
    return chunk.getBlockLocal(localX, localY, localZ);
  }

  // convert world coords to chunk coords
  private worldToChunk(worldX: number, worldZ: number): [number, number] {
    return [
      Math.floor(worldX / CHUNK_WIDTH),
      Math.floor(worldZ / CHUNK_DEPTH)
    ];
  }

  // convert world coords to local chunk coords
  private worldToLocal(worldX: number, worldY: number, worldZ: number): [number, number, number, number, number] {
    const chunkX = Math.floor(worldX / CHUNK_WIDTH);
    const chunkZ = Math.floor(worldZ / CHUNK_DEPTH);
    const localX = ((worldX % CHUNK_WIDTH) + CHUNK_WIDTH) % CHUNK_WIDTH;
    const localZ = ((worldZ % CHUNK_DEPTH) + CHUNK_DEPTH) % CHUNK_DEPTH;
    return [chunkX, chunkZ, localX, worldY, localZ];
  }

  getBlock(worldX: number, worldY: number, worldZ: number): BlockType {
    const [chunkX, chunkZ, localX, localY, localZ] = this.worldToLocal(
      Math.floor(worldX), Math.floor(worldY), Math.floor(worldZ)
    );
    const chunk = this.chunks.get(this.getChunkKey(chunkX, chunkZ));
    if (!chunk) return BlockType.AIR;
    return chunk.getBlock(localX, localY, localZ);
  }

  setBlock(worldX: number, worldY: number, worldZ: number, blockType: BlockType): void {
    const [chunkX, chunkZ, localX, localY, localZ] = this.worldToLocal(
      Math.floor(worldX), Math.floor(worldY), Math.floor(worldZ)
    );
    const chunk = this.chunks.get(this.getChunkKey(chunkX, chunkZ));
    if (!chunk) return;

    chunk.setBlock(localX, localY, localZ, blockType);
    chunk.buildMesh();

    // rebuild adjacent chunks if on edge
    if (localX === 0) this.rebuildChunk(chunkX - 1, chunkZ);
    if (localX === CHUNK_WIDTH - 1) this.rebuildChunk(chunkX + 1, chunkZ);
    if (localZ === 0) this.rebuildChunk(chunkX, chunkZ - 1);
    if (localZ === CHUNK_DEPTH - 1) this.rebuildChunk(chunkX, chunkZ + 1);
  }

  private rebuildChunk(chunkX: number, chunkZ: number): void {
    const chunk = this.chunks.get(this.getChunkKey(chunkX, chunkZ));
    if (chunk) chunk.buildMesh();
  }

  // update chunks around player position
  update(playerX: number, playerZ: number): void {
    const [playerChunkX, playerChunkZ] = this.worldToChunk(playerX, playerZ);

    // load chunks in range
    for (let dx = -RENDER_DISTANCE; dx <= RENDER_DISTANCE; dx++) {
      for (let dz = -RENDER_DISTANCE; dz <= RENDER_DISTANCE; dz++) {
        const chunkX = playerChunkX + dx;
        const chunkZ = playerChunkZ + dz;
        const key = this.getChunkKey(chunkX, chunkZ);

        if (!this.chunks.has(key)) {
          const chunk = new Chunk(chunkX, chunkZ, this.worldBlockGetter);
          chunk.buildMesh();
          this.chunks.set(key, chunk);
          if (chunk.mesh) gameScene.add(chunk.mesh);
          if (chunk.waterMesh) gameScene.add(chunk.waterMesh);
        }
      }
    }

    // unload distant chunks
    for (const [key, chunk] of this.chunks) {
      const [chunkX, chunkZ] = key.split(',').map(Number);
      const dx = Math.abs(chunkX - playerChunkX);
      const dz = Math.abs(chunkZ - playerChunkZ);

      if (dx > RENDER_DISTANCE + 1 || dz > RENDER_DISTANCE + 1) {
        if (chunk.mesh) gameScene.remove(chunk.mesh);
        if (chunk.waterMesh) gameScene.remove(chunk.waterMesh);
        chunk.dispose();
        this.chunks.delete(key);
      }
    }
  }

  // raycast for block selection
  raycast(origin: THREE.Vector3, direction: THREE.Vector3, maxDistance: number = 5): {
    hit: boolean;
    blockPos?: THREE.Vector3;
    placePos?: THREE.Vector3;
    normal?: THREE.Vector3;
  } {
    this.raycaster.set(origin, direction);
    this.raycaster.far = maxDistance;

    const meshes: THREE.Mesh[] = [];
    for (const chunk of this.chunks.values()) {
      if (chunk.mesh) meshes.push(chunk.mesh);
    }

    const intersects = this.raycaster.intersectObjects(meshes);
    if (intersects.length === 0) {
      return { hit: false };
    }

    const hit = intersects[0];
    const point = hit.point;
    const normal = hit.face?.normal ?? new THREE.Vector3(0, 1, 0);

    // move slightly into the block to get block position
    const blockPos = new THREE.Vector3(
      Math.floor(point.x - normal.x * 0.01),
      Math.floor(point.y - normal.y * 0.01),
      Math.floor(point.z - normal.z * 0.01)
    );

    // place position is adjacent in normal direction
    const placePos = new THREE.Vector3(
      Math.floor(point.x + normal.x * 0.5),
      Math.floor(point.y + normal.y * 0.5),
      Math.floor(point.z + normal.z * 0.5)
    );

    return { hit: true, blockPos, placePos, normal };
  }

  // check collision with blocks
  isBlockSolidAt(x: number, y: number, z: number): boolean {
    return isBlockSolid(this.getBlock(x, y, z));
  }

  // check if block is water
  isBlockWaterAt(x: number, y: number, z: number): boolean {
    return isBlockWater(this.getBlock(x, y, z));
  }

  // get spawn height at position
  getSpawnHeight(x: number, z: number): number {
    for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
      if (isBlockSolid(this.getBlock(x, y, z))) {
        return y + 1;
      }
    }
    return 30;
  }

  // reset the world - clears all chunks
  reset(): void {
    for (const chunk of this.chunks.values()) {
      if (chunk.mesh) gameScene.remove(chunk.mesh);
      if (chunk.waterMesh) gameScene.remove(chunk.waterMesh);
      chunk.dispose();
    }
    this.chunks.clear();
  }
}

export const world = new World();
