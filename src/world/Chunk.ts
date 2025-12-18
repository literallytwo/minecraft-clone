import * as THREE from 'three';
import { CHUNK_WIDTH, CHUNK_HEIGHT, CHUNK_DEPTH, RenderLayer } from '../utils/constants';
import { BlockType, getBlockUVs, isBlockTransparent, isBlockWater, getBlockHeight, isPartialBlock } from './Block';
import { terrainGenerator } from './TerrainGenerator';
import { textureManager } from '../rendering/TextureManager';

// AO levels: 0=bright, 3=darkest (smooth curve)
const AO_CURVE = [1.0, 0.75, 0.5, 0.3];

// face descriptor: direction, vertices (0=bottom, 1=top of block), uv face type, brightness
type FaceDescriptor = {
  dir: [number, number, number];
  verts: [[number, number, number], [number, number, number], [number, number, number], [number, number, number]];
  uvFace: 'top' | 'side' | 'bottom';
  brightness: number;
};

const FACES: FaceDescriptor[] = [
  { dir: [0, 1, 0], verts: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], uvFace: 'top', brightness: 1.0 },      // +Y top
  { dir: [0, -1, 0], verts: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], uvFace: 'bottom', brightness: 0.5 },  // -Y bottom
  { dir: [0, 0, 1], verts: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], uvFace: 'side', brightness: 0.8 },     // +Z south
  { dir: [0, 0, -1], verts: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], uvFace: 'side', brightness: 0.8 },    // -Z north
  { dir: [1, 0, 0], verts: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], uvFace: 'side', brightness: 0.6 },     // +X east
  { dir: [-1, 0, 0], verts: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], uvFace: 'side', brightness: 0.6 },    // -X west
];

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

          const isWater = isBlockWater(blockType);
          const height = getBlockHeight(blockType);

          for (const face of FACES) {
            const [dx, dy, dz] = face.dir;
            const neighbor = this.getBlock(x + dx, y + dy, z + dz);

            // determine if face should be visible
            let visible: boolean;

            if (isWater) {
              visible = neighbor === BlockType.AIR;
            } else if (isPartialBlock(blockType)) {
              // partial blocks don't cull any faces - always render all of them
              visible = true;
            } else {
              visible = isBlockTransparent(neighbor);
            }

            if (!visible) continue;

            // transform vertices: scale y by block height
            const v = face.verts.map(([vx, vy, vz]) => [
              x + vx,
              y + vy * height,
              z + vz,
            ]) as [[number, number, number], [number, number, number], [number, number, number], [number, number, number]];

            if (isWater) {
              this.addFace(
                waterPositions, waterNormals, waterUvs, waterColors, waterIndices, waterVertexIndex,
                v, face.dir, face.brightness, blockType, face.uvFace, x, y, z, true, height
              );
              waterVertexIndex += 4;
            } else {
              this.addFace(
                solidPositions, solidNormals, solidUvs, solidColors, solidIndices, solidVertexIndex,
                v, face.dir, face.brightness, blockType, face.uvFace, x, y, z, false, height
              );
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
    this.waterMesh.renderOrder = RenderLayer.WATER;
  }

  // check if a block occludes light for AO purposes
  // partial blocks (like snow) don't occlude since they only cover a small portion of the block space
  private isBlockOccluding(x: number, y: number, z: number): boolean {
    const block = this.getBlock(Math.floor(x), Math.floor(y), Math.floor(z));
    if (block === BlockType.AIR || isBlockTransparent(block)) return false;
    // partial blocks don't occlude for AO purposes
    if (isPartialBlock(block)) return false;
    return true;
  }

  // calculate ambient occlusion for a single vertex
  // blockHeight: the height of the block (1 for full, <1 for partial like snow)
  private calculateVertexAO(
    blockX: number, blockY: number, blockZ: number,
    nx: number, ny: number, nz: number,
    vx: number, vy: number, vz: number,
    blockHeight: number = 1
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
    // for partial blocks, use actual center (blockY + height/2) for Y direction calculation
    const cx = blockX + 0.5;
    const cy = blockY + blockHeight / 2;
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
    verts: [[number, number, number], [number, number, number], [number, number, number], [number, number, number]],
    normal: [number, number, number],
    faceBrightness: number,
    blockType: BlockType, uvFace: 'top' | 'side' | 'bottom',
    blockX: number, blockY: number, blockZ: number,
    isWater: boolean,
    blockHeight: number
  ): void {
    const [nx, ny, nz] = normal;

    // positions
    for (const [vx, vy, vz] of verts) {
      positions.push(vx, vy, vz);
    }

    // normals
    for (let i = 0; i < 4; i++) {
      normals.push(nx, ny, nz);
    }

    // uvs from texture atlas
    const [u1, v1, u2, v2] = getBlockUVs(blockType, uvFace);
    uvs.push(u1, v1, u2, v1, u2, v2, u1, v2);

    // calculate vertex colors with AO
    // use block's actual height for correct AO direction calculation on partial blocks
    const aoValues: number[] = [];
    for (let i = 0; i < verts.length; i++) {
      const [vx, vy, vz] = verts[i];
      const ao = isWater ? 0 : this.calculateVertexAO(blockX, blockY, blockZ, nx, ny, nz, vx, vy, vz, blockHeight);
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
