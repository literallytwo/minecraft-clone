import * as THREE from 'three';
import { CHUNK_WIDTH, CHUNK_HEIGHT, CHUNK_DEPTH } from '../utils/constants';
import { BlockType, getBlockUVs, isBlockTransparent, isBlockWater } from './Block';
import { terrainGenerator } from './TerrainGenerator';
import { textureManager } from '../rendering/TextureManager';

// function type for querying blocks from the world (used for cross-chunk neighbor lookups)
export type WorldBlockGetter = (worldX: number, worldY: number, worldZ: number) => BlockType;

export class Chunk {
  readonly chunkX: number;
  readonly chunkZ: number;
  private blocks: Uint8Array;
  private worldBlockGetter: WorldBlockGetter | null = null;
  mesh: THREE.Mesh | null = null;
  waterMesh: THREE.Mesh | null = null;

  constructor(chunkX: number, chunkZ: number, worldBlockGetter?: WorldBlockGetter) {
    this.chunkX = chunkX;
    this.chunkZ = chunkZ;
    this.blocks = new Uint8Array(CHUNK_WIDTH * CHUNK_HEIGHT * CHUNK_DEPTH);
    this.worldBlockGetter = worldBlockGetter ?? null;
    this.generate();
  }

  setWorldBlockGetter(getter: WorldBlockGetter): void {
    this.worldBlockGetter = getter;
  }

  private getIndex(x: number, y: number, z: number): number {
    return y * CHUNK_WIDTH * CHUNK_DEPTH + z * CHUNK_WIDTH + x;
  }

  private generate(): void {
    const worldOffsetX = this.chunkX * CHUNK_WIDTH;
    const worldOffsetZ = this.chunkZ * CHUNK_DEPTH;

    for (let x = 0; x < CHUNK_WIDTH; x++) {
      for (let z = 0; z < CHUNK_DEPTH; z++) {
        for (let y = 0; y < CHUNK_HEIGHT; y++) {
          const worldX = worldOffsetX + x;
          const worldZ = worldOffsetZ + z;
          const blockType = terrainGenerator.getBlock(worldX, y, worldZ);
          this.blocks[this.getIndex(x, y, z)] = blockType;
        }
      }
    }
  }

  getBlock(x: number, y: number, z: number): BlockType {
    if (x < 0 || x >= CHUNK_WIDTH || y < 0 || y >= CHUNK_HEIGHT || z < 0 || z >= CHUNK_DEPTH) {
      // for out of bounds, query actual world state for correct neighbor block
      // this properly handles player-modified blocks at chunk boundaries
      const worldX = this.chunkX * CHUNK_WIDTH + x;
      const worldZ = this.chunkZ * CHUNK_DEPTH + z;
      if (this.worldBlockGetter) {
        return this.worldBlockGetter(worldX, y, worldZ);
      }
      // fallback to terrain generator if no world getter (shouldn't happen in normal use)
      return terrainGenerator.getBlock(worldX, y, worldZ);
    }
    return this.blocks[this.getIndex(x, y, z)];
  }

  // get block directly from internal data (no bounds check, no cross-chunk lookup)
  // used by World.getBlockForChunk to avoid infinite recursion
  getBlockLocal(x: number, y: number, z: number): BlockType {
    return this.blocks[this.getIndex(x, y, z)];
  }

  setBlock(x: number, y: number, z: number, blockType: BlockType): void {
    if (x < 0 || x >= CHUNK_WIDTH || y < 0 || y >= CHUNK_HEIGHT || z < 0 || z >= CHUNK_DEPTH) {
      return;
    }
    this.blocks[this.getIndex(x, y, z)] = blockType;
  }

  buildMesh(): void {
    // separate geometry for solid blocks and water blocks
    const solidPositions: number[] = [];
    const solidNormals: number[] = [];
    const solidUvs: number[] = [];
    const solidIndices: number[] = [];
    let solidVertexIndex = 0;

    const waterPositions: number[] = [];
    const waterNormals: number[] = [];
    const waterUvs: number[] = [];
    const waterIndices: number[] = [];
    let waterVertexIndex = 0;

    for (let x = 0; x < CHUNK_WIDTH; x++) {
      for (let y = 0; y < CHUNK_HEIGHT; y++) {
        for (let z = 0; z < CHUNK_DEPTH; z++) {
          const blockType = this.getBlock(x, y, z);
          if (blockType === BlockType.AIR) continue;

          if (isBlockWater(blockType)) {
            // water block - only show faces adjacent to AIR (not water-to-water)
            // +y (top)
            if (this.getBlock(x, y + 1, z) === BlockType.AIR) {
              this.addFace(waterPositions, waterNormals, waterUvs, waterIndices, waterVertexIndex,
                x, y + 1, z + 1, x + 1, y + 1, z + 1, x + 1, y + 1, z, x, y + 1, z,
                0, 1, 0, blockType, 'top');
              waterVertexIndex += 4;
            }
            // -y (bottom)
            if (this.getBlock(x, y - 1, z) === BlockType.AIR) {
              this.addFace(waterPositions, waterNormals, waterUvs, waterIndices, waterVertexIndex,
                x, y, z, x + 1, y, z, x + 1, y, z + 1, x, y, z + 1,
                0, -1, 0, blockType, 'bottom');
              waterVertexIndex += 4;
            }
            // +z (front)
            if (this.getBlock(x, y, z + 1) === BlockType.AIR) {
              this.addFace(waterPositions, waterNormals, waterUvs, waterIndices, waterVertexIndex,
                x, y, z + 1, x + 1, y, z + 1, x + 1, y + 1, z + 1, x, y + 1, z + 1,
                0, 0, 1, blockType, 'side');
              waterVertexIndex += 4;
            }
            // -z (back)
            if (this.getBlock(x, y, z - 1) === BlockType.AIR) {
              this.addFace(waterPositions, waterNormals, waterUvs, waterIndices, waterVertexIndex,
                x + 1, y, z, x, y, z, x, y + 1, z, x + 1, y + 1, z,
                0, 0, -1, blockType, 'side');
              waterVertexIndex += 4;
            }
            // +x (right)
            if (this.getBlock(x + 1, y, z) === BlockType.AIR) {
              this.addFace(waterPositions, waterNormals, waterUvs, waterIndices, waterVertexIndex,
                x + 1, y, z + 1, x + 1, y, z, x + 1, y + 1, z, x + 1, y + 1, z + 1,
                1, 0, 0, blockType, 'side');
              waterVertexIndex += 4;
            }
            // -x (left)
            if (this.getBlock(x - 1, y, z) === BlockType.AIR) {
              this.addFace(waterPositions, waterNormals, waterUvs, waterIndices, waterVertexIndex,
                x, y, z, x, y, z + 1, x, y + 1, z + 1, x, y + 1, z,
                -1, 0, 0, blockType, 'side');
              waterVertexIndex += 4;
            }
          } else {
            // solid block - check each face and add if adjacent block is transparent
            // +y (top)
            if (isBlockTransparent(this.getBlock(x, y + 1, z))) {
              this.addFace(solidPositions, solidNormals, solidUvs, solidIndices, solidVertexIndex,
                x, y + 1, z + 1, x + 1, y + 1, z + 1, x + 1, y + 1, z, x, y + 1, z,
                0, 1, 0, blockType, 'top');
              solidVertexIndex += 4;
            }
            // -y (bottom)
            if (isBlockTransparent(this.getBlock(x, y - 1, z))) {
              this.addFace(solidPositions, solidNormals, solidUvs, solidIndices, solidVertexIndex,
                x, y, z, x + 1, y, z, x + 1, y, z + 1, x, y, z + 1,
                0, -1, 0, blockType, 'bottom');
              solidVertexIndex += 4;
            }
            // +z (front)
            if (isBlockTransparent(this.getBlock(x, y, z + 1))) {
              this.addFace(solidPositions, solidNormals, solidUvs, solidIndices, solidVertexIndex,
                x, y, z + 1, x + 1, y, z + 1, x + 1, y + 1, z + 1, x, y + 1, z + 1,
                0, 0, 1, blockType, 'side');
              solidVertexIndex += 4;
            }
            // -z (back)
            if (isBlockTransparent(this.getBlock(x, y, z - 1))) {
              this.addFace(solidPositions, solidNormals, solidUvs, solidIndices, solidVertexIndex,
                x + 1, y, z, x, y, z, x, y + 1, z, x + 1, y + 1, z,
                0, 0, -1, blockType, 'side');
              solidVertexIndex += 4;
            }
            // +x (right)
            if (isBlockTransparent(this.getBlock(x + 1, y, z))) {
              this.addFace(solidPositions, solidNormals, solidUvs, solidIndices, solidVertexIndex,
                x + 1, y, z + 1, x + 1, y, z, x + 1, y + 1, z, x + 1, y + 1, z + 1,
                1, 0, 0, blockType, 'side');
              solidVertexIndex += 4;
            }
            // -x (left)
            if (isBlockTransparent(this.getBlock(x - 1, y, z))) {
              this.addFace(solidPositions, solidNormals, solidUvs, solidIndices, solidVertexIndex,
                x, y, z, x, y, z + 1, x, y + 1, z + 1, x, y + 1, z,
                -1, 0, 0, blockType, 'side');
              solidVertexIndex += 4;
            }
          }
        }
      }
    }

    const worldX = this.chunkX * CHUNK_WIDTH;
    const worldZ = this.chunkZ * CHUNK_DEPTH;

    // build solid mesh
    if (this.mesh) {
      this.mesh.geometry.dispose();
    }
    const solidGeometry = new THREE.BufferGeometry();
    solidGeometry.setAttribute('position', new THREE.Float32BufferAttribute(solidPositions, 3));
    solidGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(solidNormals, 3));
    solidGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(solidUvs, 2));
    solidGeometry.setIndex(solidIndices);

    if (!this.mesh) {
      this.mesh = new THREE.Mesh(solidGeometry, textureManager.getMaterial());
    } else {
      this.mesh.geometry = solidGeometry;
    }
    this.mesh.position.set(worldX, 0, worldZ);

    // build water mesh
    if (this.waterMesh) {
      this.waterMesh.geometry.dispose();
    }
    const waterGeometry = new THREE.BufferGeometry();
    waterGeometry.setAttribute('position', new THREE.Float32BufferAttribute(waterPositions, 3));
    waterGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(waterNormals, 3));
    waterGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(waterUvs, 2));
    waterGeometry.setIndex(waterIndices);

    if (!this.waterMesh) {
      this.waterMesh = new THREE.Mesh(waterGeometry, textureManager.getWaterMaterial());
    } else {
      this.waterMesh.geometry = waterGeometry;
    }
    this.waterMesh.position.set(worldX, 0, worldZ);
    this.waterMesh.renderOrder = 1; // render water after solid blocks
  }

  private addFace(
    positions: number[], normals: number[], uvs: number[], indices: number[],
    startIndex: number,
    x1: number, y1: number, z1: number,
    x2: number, y2: number, z2: number,
    x3: number, y3: number, z3: number,
    x4: number, y4: number, z4: number,
    nx: number, ny: number, nz: number,
    blockType: BlockType, face: 'top' | 'side' | 'bottom'
  ): void {
    // positions
    positions.push(x1, y1, z1, x2, y2, z2, x3, y3, z3, x4, y4, z4);

    // normals
    for (let i = 0; i < 4; i++) {
      normals.push(nx, ny, nz);
    }

    // uvs from texture atlas
    const [u1, v1, u2, v2] = getBlockUVs(blockType, face);
    uvs.push(u1, v1, u2, v1, u2, v2, u1, v2);

    // indices (two triangles)
    indices.push(
      startIndex, startIndex + 1, startIndex + 2,
      startIndex, startIndex + 2, startIndex + 3
    );
  }

  dispose(): void {
    if (this.mesh) {
      this.mesh.geometry.dispose();
      this.mesh = null;
    }
    if (this.waterMesh) {
      this.waterMesh.geometry.dispose();
      this.waterMesh = null;
    }
  }
}
