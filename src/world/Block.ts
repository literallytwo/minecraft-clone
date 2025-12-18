import { TILE_SIZE } from '../utils/constants';

export const BlockType = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  BEDROCK: 4,
  SAND: 5,
  WATER: 6,
  WOOD: 7,
  LEAVES: 8,
  SNOW: 9,
} as const;

export type BlockType = (typeof BlockType)[keyof typeof BlockType];

// block properties - add new blocks here and everything else follows
type BlockProperties = {
  uvs: { top: [number, number]; side: [number, number]; bottom: [number, number] };
  solid: boolean;
  transparent: boolean;
  fluid: boolean;
  height: number; // 1 = full block, <1 = partial (like snow)
};

const blockRegistry: Record<BlockType, BlockProperties> = {
  [BlockType.AIR]: {
    uvs: { top: [0, 0], side: [0, 0], bottom: [0, 0] },
    solid: false, transparent: true, fluid: false, height: 1,
  },
  [BlockType.GRASS]: {
    uvs: { top: [0, 0], side: [1, 0], bottom: [2, 0] },
    solid: true, transparent: false, fluid: false, height: 1,
  },
  [BlockType.DIRT]: {
    uvs: { top: [2, 0], side: [2, 0], bottom: [2, 0] },
    solid: true, transparent: false, fluid: false, height: 1,
  },
  [BlockType.STONE]: {
    uvs: { top: [3, 0], side: [3, 0], bottom: [3, 0] },
    solid: true, transparent: false, fluid: false, height: 1,
  },
  [BlockType.BEDROCK]: {
    uvs: { top: [0, 1], side: [0, 1], bottom: [0, 1] },
    solid: true, transparent: false, fluid: false, height: 1,
  },
  [BlockType.SAND]: {
    uvs: { top: [1, 1], side: [1, 1], bottom: [1, 1] },
    solid: true, transparent: false, fluid: false, height: 1,
  },
  [BlockType.WATER]: {
    uvs: { top: [2, 1], side: [2, 1], bottom: [2, 1] },
    solid: false, transparent: true, fluid: true, height: 1,
  },
  [BlockType.WOOD]: {
    uvs: { top: [3, 1], side: [0, 2], bottom: [3, 1] },
    solid: true, transparent: false, fluid: false, height: 1,
  },
  [BlockType.LEAVES]: {
    uvs: { top: [1, 2], side: [1, 2], bottom: [1, 2] },
    solid: false, transparent: true, fluid: false, height: 1,
  },
  [BlockType.SNOW]: {
    uvs: { top: [2, 2], side: [2, 2], bottom: [2, 2] },
    solid: false, transparent: false, fluid: false, height: 5 / 16,
  },
};

export function getBlockProps(blockType: BlockType): BlockProperties {
  return blockRegistry[blockType];
}

export function getBlockUVs(blockType: BlockType, face: 'top' | 'side' | 'bottom'): [number, number, number, number] {
  const uvs = blockRegistry[blockType].uvs[face];
  const u = uvs[0] * TILE_SIZE;
  const v = 1 - (uvs[1] + 1) * TILE_SIZE; // flip y because textures are upside down
  return [u, v, u + TILE_SIZE, v + TILE_SIZE];
}

export function isBlockSolid(blockType: BlockType): boolean {
  return blockRegistry[blockType].solid;
}

export function isBlockTransparent(blockType: BlockType): boolean {
  return blockRegistry[blockType].transparent;
}

export function isBlockWater(blockType: BlockType): boolean {
  return blockRegistry[blockType].fluid;
}

export function isBlockSnow(blockType: BlockType): boolean {
  return blockType === BlockType.SNOW;
}

export function getBlockHeight(blockType: BlockType): number {
  return blockRegistry[blockType].height;
}

// kept for backwards compat, use getBlockHeight() for new code
export const SNOW_HEIGHT = 5 / 16;
