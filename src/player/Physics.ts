import * as THREE from 'three';
import { world } from '../world/World';
import { PLAYER_WIDTH, PLAYER_HEIGHT, GRAVITY, WATER_GRAVITY, WATER_MAX_SWIM_SPEED, WATER_MAX_HORIZONTAL_SPEED, WATER_DRAG } from '../utils/constants';

// simple AABB collision detection with voxels
export function resolveCollisions(
  position: THREE.Vector3,
  velocity: THREE.Vector3,
  deltaTime: number
): { grounded: boolean } {
  let grounded = false;

  // apply velocity one axis at a time to handle collisions properly
  const halfWidth = PLAYER_WIDTH / 2;

  // move X
  position.x += velocity.x * deltaTime;
  if (checkCollision(position, halfWidth, PLAYER_HEIGHT)) {
    // undo movement and zero velocity
    position.x -= velocity.x * deltaTime;
    velocity.x = 0;
  }

  // move Y (gravity)
  position.y += velocity.y * deltaTime;
  if (checkCollision(position, halfWidth, PLAYER_HEIGHT)) {
    if (velocity.y < 0) {
      // hit ground, snap to top of the block we collided with
      position.y = Math.floor(position.y) + 1.001;
      grounded = true;
    } else {
      // hit ceiling
      position.y -= velocity.y * deltaTime;
    }
    velocity.y = 0;
  }

  // move Z
  position.z += velocity.z * deltaTime;
  if (checkCollision(position, halfWidth, PLAYER_HEIGHT)) {
    position.z -= velocity.z * deltaTime;
    velocity.z = 0;
  }

  return { grounded };
}

function checkCollision(position: THREE.Vector3, halfWidth: number, height: number): boolean {
  // check all corners of player bounding box
  const minX = Math.floor(position.x - halfWidth);
  const maxX = Math.floor(position.x + halfWidth);
  const minY = Math.floor(position.y);
  const maxY = Math.floor(position.y + height);
  const minZ = Math.floor(position.z - halfWidth);
  const maxZ = Math.floor(position.z + halfWidth);

  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      for (let z = minZ; z <= maxZ; z++) {
        if (world.isBlockSolidAt(x, y, z)) {
          return true;
        }
      }
    }
  }

  return false;
}

export function applyGravity(velocity: THREE.Vector3, deltaTime: number): void {
  velocity.y -= GRAVITY * deltaTime;
  // terminal velocity
  velocity.y = Math.max(velocity.y, -50);
}

export function applyWaterPhysics(velocity: THREE.Vector3, deltaTime: number): void {
  // apply drag - higher speeds get more drag (quadratic-ish feel for falling fast into water)
  // base drag handles normal swimming, extra drag kicks in at high velocities
  const speed = velocity.length();
  const effectiveDrag = WATER_DRAG + Math.max(0, speed - 5) * 0.5; // extra drag above 5 m/s
  const dragFactor = Math.exp(-effectiveDrag * deltaTime);
  velocity.x *= dragFactor;
  velocity.y *= dragFactor;
  velocity.z *= dragFactor;

  // apply water gravity (buoyancy counteracted by slight sinking)
  velocity.y -= WATER_GRAVITY * deltaTime;

  // only clamp upward swim speed, let drag handle slowing down from fast falls
  velocity.y = Math.min(velocity.y, WATER_MAX_SWIM_SPEED);

  // clamp horizontal velocity
  velocity.x = Math.max(-WATER_MAX_HORIZONTAL_SPEED, Math.min(WATER_MAX_HORIZONTAL_SPEED, velocity.x));
  velocity.z = Math.max(-WATER_MAX_HORIZONTAL_SPEED, Math.min(WATER_MAX_HORIZONTAL_SPEED, velocity.z));
}
