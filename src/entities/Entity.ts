import * as THREE from 'three';
import { world } from '../world/World';
import { getBlockBounds } from '../utils/coords';
import { GRAVITY } from '../utils/constants';

export interface EntityBounds {
  width: number;  // full width (not half)
  height: number;
}

export class Entity {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  bounds: EntityBounds;
  grounded = false;

  constructor(x: number, y: number, z: number, bounds: EntityBounds) {
    this.position = new THREE.Vector3(x, y, z);
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.bounds = bounds;
  }

  // apply gravity to velocity
  applyGravity(deltaTime: number): void {
    this.velocity.y -= GRAVITY * deltaTime;
    this.velocity.y = Math.max(this.velocity.y, -50); // terminal velocity
  }

  // resolve collisions with the world
  resolveCollisions(deltaTime: number): void {
    // move X
    this.position.x += this.velocity.x * deltaTime;
    if (this.checkCollision()) {
      this.position.x -= this.velocity.x * deltaTime;
      this.velocity.x = 0;
    }

    // move Y (gravity)
    this.position.y += this.velocity.y * deltaTime;
    if (this.checkCollision()) {
      if (this.velocity.y < 0) {
        // hit ground, snap to top of the block
        this.position.y = Math.floor(this.position.y) + 1.001;
        this.grounded = true;
      } else {
        // hit ceiling
        this.position.y -= this.velocity.y * deltaTime;
      }
      this.velocity.y = 0;
    } else {
      this.grounded = false;
    }

    // move Z
    this.position.z += this.velocity.z * deltaTime;
    if (this.checkCollision()) {
      this.position.z -= this.velocity.z * deltaTime;
      this.velocity.z = 0;
    }
  }

  // check if entity collides with any solid blocks
  private checkCollision(): boolean {
    const halfWidth = this.bounds.width / 2;
    const { minX, maxX, minY, maxY, minZ, maxZ } = getBlockBounds(this.position, halfWidth, this.bounds.height);

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

  // check if entity is in water (feet or chest level)
  isInWater(): boolean {
    const x = Math.floor(this.position.x);
    const feetY = Math.floor(this.position.y);
    const chestY = Math.floor(this.position.y + this.bounds.height / 2);
    const z = Math.floor(this.position.z);
    return world.isBlockWaterAt(x, feetY, z) || world.isBlockWaterAt(x, chestY, z);
  }

  // update - override in subclasses
  update(deltaTime: number): void {
    this.applyGravity(deltaTime);
    this.resolveCollisions(deltaTime);
  }
}
