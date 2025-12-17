import * as THREE from 'three';
import { CHUNK_WIDTH, CHUNK_HEIGHT, CHUNK_DEPTH } from '../utils/constants';
import { BlockType, getBlockUVs, isBlockTransparent } from './Block';
import { terrainGenerator } from './TerrainGenerator';
import { textureManager } from '../rendering/TextureManager';

export class Chunk {
  readonly chunkX: number;
  readonly chunkZ: number;
  private blocks: Uint8Array;
  mesh: THREE.Mesh | null = null;

  constructor(chunkX: number, chunkZ: number) {
    this.chunkX = chunkX;
    this.chunkZ = chunkZ;
    this.blocks = new Uint8Array(CHUNK_WIDTH * CHUNK_HEIGHT * CHUNK_DEPTH);
    this.generate();
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
      return BlockType.AIR;
    }
    return this.blocks[this.getIndex(x, y, z)];
  }

  setBlock(x: number, y: number, z: number, blockType: BlockType): void {
    if (x < 0 || x >= CHUNK_WIDTH || y < 0 || y >= CHUNK_HEIGHT || z < 0 || z >= CHUNK_DEPTH) {
      return;
    }
    this.blocks[this.getIndex(x, y, z)] = blockType;
  }

  buildMesh(): void {
    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    let vertexIndex = 0;

    for (let x = 0; x < CHUNK_WIDTH; x++) {
      for (let y = 0; y < CHUNK_HEIGHT; y++) {
        for (let z = 0; z < CHUNK_DEPTH; z++) {
          const blockType = this.getBlock(x, y, z);
          if (blockType === BlockType.AIR) continue;

          // check each face and add if adjacent block is transparent
          // +y (top)
          if (isBlockTransparent(this.getBlock(x, y + 1, z))) {
            this.addFace(positions, normals, uvs, indices, vertexIndex,
              x, y + 1, z + 1, x + 1, y + 1, z + 1, x + 1, y + 1, z, x, y + 1, z,
              0, 1, 0, blockType, 'top');
            vertexIndex += 4;
          }

          // -y (bottom)
          if (isBlockTransparent(this.getBlock(x, y - 1, z))) {
            this.addFace(positions, normals, uvs, indices, vertexIndex,
              x, y, z, x + 1, y, z, x + 1, y, z + 1, x, y, z + 1,
              0, -1, 0, blockType, 'bottom');
            vertexIndex += 4;
          }

          // +z (front)
          if (isBlockTransparent(this.getBlock(x, y, z + 1))) {
            this.addFace(positions, normals, uvs, indices, vertexIndex,
              x, y, z + 1, x + 1, y, z + 1, x + 1, y + 1, z + 1, x, y + 1, z + 1,
              0, 0, 1, blockType, 'side');
            vertexIndex += 4;
          }

          // -z (back)
          if (isBlockTransparent(this.getBlock(x, y, z - 1))) {
            this.addFace(positions, normals, uvs, indices, vertexIndex,
              x + 1, y, z, x, y, z, x, y + 1, z, x + 1, y + 1, z,
              0, 0, -1, blockType, 'side');
            vertexIndex += 4;
          }

          // +x (right)
          if (isBlockTransparent(this.getBlock(x + 1, y, z))) {
            this.addFace(positions, normals, uvs, indices, vertexIndex,
              x + 1, y, z + 1, x + 1, y, z, x + 1, y + 1, z, x + 1, y + 1, z + 1,
              1, 0, 0, blockType, 'side');
            vertexIndex += 4;
          }

          // -x (left)
          if (isBlockTransparent(this.getBlock(x - 1, y, z))) {
            this.addFace(positions, normals, uvs, indices, vertexIndex,
              x, y, z, x, y, z + 1, x, y + 1, z + 1, x, y + 1, z,
              -1, 0, 0, blockType, 'side');
            vertexIndex += 4;
          }
        }
      }
    }

    // clean up old mesh if it exists
    if (this.mesh) {
      this.mesh.geometry.dispose();
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);

    const worldX = this.chunkX * CHUNK_WIDTH;
    const worldZ = this.chunkZ * CHUNK_DEPTH;

    if (!this.mesh) {
      this.mesh = new THREE.Mesh(geometry, textureManager.getMaterial());
    } else {
      this.mesh.geometry = geometry;
    }

    this.mesh.position.set(worldX, 0, worldZ);
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
  }
}
