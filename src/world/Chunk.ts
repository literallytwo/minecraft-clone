import * as THREE from 'three';
import { CHUNK_WIDTH, CHUNK_HEIGHT, CHUNK_DEPTH } from '../utils/constants';
import { BlockType, getBlockUVs, isBlockTransparent, isBlockWater } from './Block';
import { terrainGenerator } from './TerrainGenerator';
import { textureManager } from '../rendering/TextureManager';

// face brightness - minecraft style directional shading
const FACE_BRIGHTNESS = {
  TOP: 1.0,     // Y+ direct light
  BOTTOM: 0.5,  // Y- darkest
  NORTH: 0.8,   // Z-
  SOUTH: 0.8,   // Z+
  EAST: 0.6,    // X+
  WEST: 0.6,    // X-
};

// AO levels: 0=bright, 3=darkest (smooth curve)
const AO_CURVE = [1.0, 0.75, 0.5, 0.3];

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
    return this.blocks[this.getIndex(x, y, z)] as BlockType;
  }

  // get block directly from internal data (no bounds check, no cross-chunk lookup)
  // used by World.getBlockForChunk to avoid infinite recursion
  getBlockLocal(x: number, y: number, z: number): BlockType {
    return this.blocks[this.getIndex(x, y, z)] as BlockType;
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
    const solidColors: number[] = [];
    const solidIndices: number[] = [];
    let solidVertexIndex = 0;

    const waterPositions: number[] = [];
    const waterNormals: number[] = [];
    const waterUvs: number[] = [];
    const waterColors: number[] = [];
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
              this.addFace(waterPositions, waterNormals, waterUvs, waterColors, waterIndices, waterVertexIndex,
                x, y + 1, z + 1, x + 1, y + 1, z + 1, x + 1, y + 1, z, x, y + 1, z,
                0, 1, 0, blockType, 'top', x, y, z, true);
              waterVertexIndex += 4;
            }
            // -y (bottom)
            if (this.getBlock(x, y - 1, z) === BlockType.AIR) {
              this.addFace(waterPositions, waterNormals, waterUvs, waterColors, waterIndices, waterVertexIndex,
                x, y, z, x + 1, y, z, x + 1, y, z + 1, x, y, z + 1,
                0, -1, 0, blockType, 'bottom', x, y, z, true);
              waterVertexIndex += 4;
            }
            // +z (front)
            if (this.getBlock(x, y, z + 1) === BlockType.AIR) {
              this.addFace(waterPositions, waterNormals, waterUvs, waterColors, waterIndices, waterVertexIndex,
                x, y, z + 1, x + 1, y, z + 1, x + 1, y + 1, z + 1, x, y + 1, z + 1,
                0, 0, 1, blockType, 'side', x, y, z, true);
              waterVertexIndex += 4;
            }
            // -z (back)
            if (this.getBlock(x, y, z - 1) === BlockType.AIR) {
              this.addFace(waterPositions, waterNormals, waterUvs, waterColors, waterIndices, waterVertexIndex,
                x + 1, y, z, x, y, z, x, y + 1, z, x + 1, y + 1, z,
                0, 0, -1, blockType, 'side', x, y, z, true);
              waterVertexIndex += 4;
            }
            // +x (right)
            if (this.getBlock(x + 1, y, z) === BlockType.AIR) {
              this.addFace(waterPositions, waterNormals, waterUvs, waterColors, waterIndices, waterVertexIndex,
                x + 1, y, z + 1, x + 1, y, z, x + 1, y + 1, z, x + 1, y + 1, z + 1,
                1, 0, 0, blockType, 'side', x, y, z, true);
              waterVertexIndex += 4;
            }
            // -x (left)
            if (this.getBlock(x - 1, y, z) === BlockType.AIR) {
              this.addFace(waterPositions, waterNormals, waterUvs, waterColors, waterIndices, waterVertexIndex,
                x, y, z, x, y, z + 1, x, y + 1, z + 1, x, y + 1, z,
                -1, 0, 0, blockType, 'side', x, y, z, true);
              waterVertexIndex += 4;
            }
          } else {
            // solid block - check each face and add if adjacent block is transparent
            // +y (top)
            if (isBlockTransparent(this.getBlock(x, y + 1, z))) {
              this.addFace(solidPositions, solidNormals, solidUvs, solidColors, solidIndices, solidVertexIndex,
                x, y + 1, z + 1, x + 1, y + 1, z + 1, x + 1, y + 1, z, x, y + 1, z,
                0, 1, 0, blockType, 'top', x, y, z, false);
              solidVertexIndex += 4;
            }
            // -y (bottom)
            if (isBlockTransparent(this.getBlock(x, y - 1, z))) {
              this.addFace(solidPositions, solidNormals, solidUvs, solidColors, solidIndices, solidVertexIndex,
                x, y, z, x + 1, y, z, x + 1, y, z + 1, x, y, z + 1,
                0, -1, 0, blockType, 'bottom', x, y, z, false);
              solidVertexIndex += 4;
            }
            // +z (front)
            if (isBlockTransparent(this.getBlock(x, y, z + 1))) {
              this.addFace(solidPositions, solidNormals, solidUvs, solidColors, solidIndices, solidVertexIndex,
                x, y, z + 1, x + 1, y, z + 1, x + 1, y + 1, z + 1, x, y + 1, z + 1,
                0, 0, 1, blockType, 'side', x, y, z, false);
              solidVertexIndex += 4;
            }
            // -z (back)
            if (isBlockTransparent(this.getBlock(x, y, z - 1))) {
              this.addFace(solidPositions, solidNormals, solidUvs, solidColors, solidIndices, solidVertexIndex,
                x + 1, y, z, x, y, z, x, y + 1, z, x + 1, y + 1, z,
                0, 0, -1, blockType, 'side', x, y, z, false);
              solidVertexIndex += 4;
            }
            // +x (right)
            if (isBlockTransparent(this.getBlock(x + 1, y, z))) {
              this.addFace(solidPositions, solidNormals, solidUvs, solidColors, solidIndices, solidVertexIndex,
                x + 1, y, z + 1, x + 1, y, z, x + 1, y + 1, z, x + 1, y + 1, z + 1,
                1, 0, 0, blockType, 'side', x, y, z, false);
              solidVertexIndex += 4;
            }
            // -x (left)
            if (isBlockTransparent(this.getBlock(x - 1, y, z))) {
              this.addFace(solidPositions, solidNormals, solidUvs, solidColors, solidIndices, solidVertexIndex,
                x, y, z, x, y, z + 1, x, y + 1, z + 1, x, y + 1, z,
                -1, 0, 0, blockType, 'side', x, y, z, false);
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
    solidGeometry.setAttribute('color', new THREE.Float32BufferAttribute(solidColors, 3));
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
    waterGeometry.setAttribute('color', new THREE.Float32BufferAttribute(waterColors, 3));
    waterGeometry.setIndex(waterIndices);

    if (!this.waterMesh) {
      this.waterMesh = new THREE.Mesh(waterGeometry, textureManager.getWaterMaterial());
    } else {
      this.waterMesh.geometry = waterGeometry;
    }
    this.waterMesh.position.set(worldX, 0, worldZ);
    this.waterMesh.renderOrder = 1; // render water after solid blocks
  }

  // check if a block occludes light for AO purposes
  private isBlockOccluding(x: number, y: number, z: number): boolean {
    const block = this.getBlock(Math.floor(x), Math.floor(y), Math.floor(z));
    return block !== BlockType.AIR && !isBlockTransparent(block);
  }

  // calculate ambient occlusion for a single vertex
  private calculateVertexAO(
    blockX: number, blockY: number, blockZ: number,
    nx: number, ny: number, nz: number,
    vx: number, vy: number, vz: number
  ): number {
    // determine tangent vectors for face plane
    let t1x: number, t1y: number, t1z: number;
    let t2x: number, t2y: number, t2z: number;

    if (ny !== 0) {
      // top/bottom face: tangents are X and Z
      t1x = 1; t1y = 0; t1z = 0;
      t2x = 0; t2y = 0; t2z = 1;
    } else if (nx !== 0) {
      // east/west face: tangents are Y and Z
      t1x = 0; t1y = 1; t1z = 0;
      t2x = 0; t2y = 0; t2z = 1;
    } else {
      // north/south face: tangents are X and Y
      t1x = 1; t1y = 0; t1z = 0;
      t2x = 0; t2y = 1; t2z = 0;
    }

    // determine corner direction from vertex position relative to block center
    const cx = blockX + 0.5;
    const cy = blockY + 0.5;
    const cz = blockZ + 0.5;
    const d1 = (vx - cx) * t1x + (vy - cy) * t1y + (vz - cz) * t1z;
    const d2 = (vx - cx) * t2x + (vy - cy) * t2y + (vz - cz) * t2z;
    const s1 = d1 > 0 ? 1 : -1;
    const s2 = d2 > 0 ? 1 : -1;

    // check 3 neighbor blocks: 2 edges + corner (offset by face normal)
    const baseX = blockX + nx;
    const baseY = blockY + ny;
    const baseZ = blockZ + nz;

    const side1 = this.isBlockOccluding(baseX + s1 * t1x, baseY + s1 * t1y, baseZ + s1 * t1z) ? 1 : 0;
    const side2 = this.isBlockOccluding(baseX + s2 * t2x, baseY + s2 * t2y, baseZ + s2 * t2z) ? 1 : 0;
    const corner = this.isBlockOccluding(
      baseX + s1 * t1x + s2 * t2x,
      baseY + s1 * t1y + s2 * t2y,
      baseZ + s1 * t1z + s2 * t2z
    ) ? 1 : 0;

    // minecraft AO formula: if both sides block, corner doesn't matter
    if (side1 && side2) return 3;
    return side1 + side2 + corner;
  }

  private addFace(
    positions: number[], normals: number[], uvs: number[], colors: number[], indices: number[],
    startIndex: number,
    x1: number, y1: number, z1: number,
    x2: number, y2: number, z2: number,
    x3: number, y3: number, z3: number,
    x4: number, y4: number, z4: number,
    nx: number, ny: number, nz: number,
    blockType: BlockType, face: 'top' | 'side' | 'bottom',
    blockX: number, blockY: number, blockZ: number,
    isWater: boolean
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

    // calculate face brightness based on normal direction
    let faceBrightness: number;
    if (ny > 0) faceBrightness = FACE_BRIGHTNESS.TOP;
    else if (ny < 0) faceBrightness = FACE_BRIGHTNESS.BOTTOM;
    else if (nz !== 0) faceBrightness = FACE_BRIGHTNESS.NORTH;
    else faceBrightness = FACE_BRIGHTNESS.EAST;

    // calculate vertex colors with AO
    const vertices = [
      [x1, y1, z1],
      [x2, y2, z2],
      [x3, y3, z3],
      [x4, y4, z4],
    ];
    const aoValues: number[] = [];

    for (let i = 0; i < 4; i++) {
      const ao = isWater ? 0 : this.calculateVertexAO(
        blockX, blockY, blockZ,
        nx, ny, nz,
        vertices[i][0], vertices[i][1], vertices[i][2]
      );
      aoValues.push(ao);
      const brightness = faceBrightness * AO_CURVE[ao];
      colors.push(brightness, brightness, brightness);
    }

    // AO flip fix: choose triangulation that looks better
    // compare diagonal AO sums to prevent ugly diagonal bands
    if (aoValues[0] + aoValues[2] > aoValues[1] + aoValues[3]) {
      indices.push(
        startIndex + 1, startIndex + 2, startIndex + 3,
        startIndex + 1, startIndex + 3, startIndex
      );
    } else {
      indices.push(
        startIndex, startIndex + 1, startIndex + 2,
        startIndex, startIndex + 2, startIndex + 3
      );
    }
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
