import * as THREE from 'three';
import { controls } from './Controls';
import { resolveCollisions, applyGravity } from './Physics';
import { gameScene } from '../rendering/Scene';
import { world } from '../world/World';
import { BlockType } from '../world/Block';
import { MOVE_SPEED, JUMP_FORCE, EYE_HEIGHT } from '../utils/constants';

class Player {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  private grounded = false;
  selectedBlock: BlockType = BlockType.DIRT;

  constructor() {
    this.position = new THREE.Vector3(0, 50, 0);
    this.velocity = new THREE.Vector3(0, 0, 0);

    // block placement/breaking
    document.addEventListener('mousedown', (e) => {
      if (!controls.isLocked) return;

      const rayResult = world.raycast(
        gameScene.camera.position,
        controls.getForwardDirection()
      );

      if (!rayResult.hit) return;

      if (e.button === 0 && rayResult.blockPos) {
        // left click - break block
        world.setBlock(
          rayResult.blockPos.x,
          rayResult.blockPos.y,
          rayResult.blockPos.z,
          BlockType.AIR
        );
      } else if (e.button === 2 && rayResult.placePos) {
        // right click - place block
        world.setBlock(
          rayResult.placePos.x,
          rayResult.placePos.y,
          rayResult.placePos.z,
          this.selectedBlock
        );
      }
    });

    // prevent context menu on right click
    document.addEventListener('contextmenu', (e) => e.preventDefault());

    // block selection with number keys
    document.addEventListener('keydown', (e) => {
      const num = parseInt(e.key);
      if (num >= 1 && num <= 8) {
        this.selectedBlock = num as BlockType;
      }
    });
  }

  spawn(): void {
    // spawn in center of starting chunk to avoid edge issues
    const spawnX = 8.5;
    const spawnZ = 8.5;
    const spawnY = world.getSpawnHeight(spawnX, spawnZ);
    // spawn 3 blocks above ground, gravity will bring us down safely
    this.position.set(spawnX, spawnY + 3, spawnZ);
    this.velocity.set(0, 0, 0);
    this.grounded = false;
  }

  update(deltaTime: number): void {
    // apply gravity
    applyGravity(this.velocity, deltaTime);

    // get movement input
    const input = controls.getMovementInput();

    // apply horizontal movement
    this.velocity.x = input.x * MOVE_SPEED;
    this.velocity.z = input.z * MOVE_SPEED;

    // jump
    if (controls.wantsJump() && this.grounded) {
      this.velocity.y = JUMP_FORCE;
      this.grounded = false;
    }

    // resolve collisions
    const result = resolveCollisions(this.position, this.velocity, deltaTime);
    this.grounded = result.grounded;

    // update camera position and rotation
    gameScene.camera.position.copy(this.position);
    gameScene.camera.position.y += EYE_HEIGHT;
    controls.updateCamera(gameScene.camera);
  }
}

export const player = new Player();
