// world dimensions
export const CHUNK_WIDTH = 16;
export const CHUNK_HEIGHT = 64;
export const CHUNK_DEPTH = 16;

// how many chunks to render around player
export const RENDER_DISTANCE = 3;

// player settings
export const PLAYER_HEIGHT = 1.8;
export const PLAYER_WIDTH = 0.6;
export const EYE_HEIGHT = 1.6;
export const MOVE_SPEED = 5;
export const JUMP_FORCE = 8;
export const GRAVITY = 20;

// water settings
export const SEA_LEVEL = 25;
export const WATER_GRAVITY = 3;
export const SWIM_UP_ACCELERATION = 10;
export const SWIM_DOWN_ACCELERATION = 8;
export const WATER_MOVE_SPEED = 15;
export const WATER_MAX_SINK_SPEED = -3;
export const WATER_MAX_SWIM_SPEED = 3;
export const WATER_MAX_HORIZONTAL_SPEED = 4.5;
export const WATER_DRAG = 4; // how fast velocity decays in water

// texture atlas is 4x4 grid (16 textures)
export const ATLAS_SIZE = 4;
export const TILE_SIZE = 1 / ATLAS_SIZE;

// render order layers (higher = rendered later/on top)
export const RenderLayer = {
  SOLID: 0,
  WATER: 1,
  PARTICLES: 2,
  OVERLAY: 999,
} as const;
