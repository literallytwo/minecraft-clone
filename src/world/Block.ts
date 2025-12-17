import { TILE_SIZE } from '../utils/constants';

export enum BlockType {
  AIR = 0,
  GRASS = 1,
  DIRT = 2,
  STONE = 3,
  BEDROCK = 4,
  SAND = 5,
  WATER = 6,
  WOOD = 7,
  LEAVES = 8,
}

// uv coords for each block type in the texture atlas
// format: [top, side, bottom] - each is [u, v] in atlas grid coords
type BlockUVs = {
  top: [number, number];
  side: [number, number];
  bottom: [number, number];
};

const blockUVMap: Record<BlockType, BlockUVs> = {
  [BlockType.AIR]: { top: [0, 0], side: [0, 0], bottom: [0, 0] },
  [BlockType.GRASS]: { top: [0, 0], side: [1, 0], bottom: [2, 0] },
  [BlockType.DIRT]: { top: [2, 0], side: [2, 0], bottom: [2, 0] },
  [BlockType.STONE]: { top: [3, 0], side: [3, 0], bottom: [3, 0] },
  [BlockType.BEDROCK]: { top: [0, 1], side: [0, 1], bottom: [0, 1] },
  [BlockType.SAND]: { top: [1, 1], side: [1, 1], bottom: [1, 1] },
  [BlockType.WATER]: { top: [2, 1], side: [2, 1], bottom: [2, 1] },
  [BlockType.WOOD]: { top: [3, 1], side: [0, 2], bottom: [3, 1] },
  [BlockType.LEAVES]: { top: [1, 2], side: [1, 2], bottom: [1, 2] },
};

export function getBlockUVs(blockType: BlockType, face: 'top' | 'side' | 'bottom'): [number, number, number, number] {
  const uvs = blockUVMap[blockType][face];
  const u = uvs[0] * TILE_SIZE;
  const v = 1 - (uvs[1] + 1) * TILE_SIZE; // flip y because textures are upside down
  return [u, v, u + TILE_SIZE, v + TILE_SIZE];
}

export function isBlockSolid(blockType: BlockType): boolean {
  return blockType !== BlockType.AIR && blockType !== BlockType.WATER;
}

export function isBlockTransparent(blockType: BlockType): boolean {
  return blockType === BlockType.AIR || blockType === BlockType.WATER || blockType === BlockType.LEAVES;
}

export function isBlockWater(blockType: BlockType): boolean {
  return blockType === BlockType.WATER;
}
