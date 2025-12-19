import { controls } from './Controls';
import { applyWaterPhysics } from './Physics';
import { gameScene } from '../rendering/Scene';
import { world } from '../world/World';
import { BlockType, isBlockReplaceable } from '../world/Block';
import { MOVE_SPEED, JUMP_FORCE, EYE_HEIGHT, WATER_MOVE_SPEED, SWIM_UP_ACCELERATION, SWIM_DOWN_ACCELERATION, PLAYER_WIDTH, PLAYER_HEIGHT } from '../utils/constants';
import { toBlockPos } from '../utils/coords';
import { Entity } from '../entities/Entity';
import { edgeWorldState } from '../state/EdgeWorldState';

class Player extends Entity {
  selectedBlock: BlockType = BlockType.DIRT;

  constructor() {
    super(0, 50, 0, { width: PLAYER_WIDTH, height: PLAYER_HEIGHT });

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
        // right click - place block (only if target is replaceable)
        const targetBlock = world.getBlock(
          rayResult.placePos.x,
          rayResult.placePos.y,
          rayResult.placePos.z
        );
        if (isBlockReplaceable(targetBlock)) {
          world.setBlock(
            rayResult.placePos.x,
            rayResult.placePos.y,
            rayResult.placePos.z,
            this.selectedBlock
          );
        }
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
    // find safe spawn near center of starting chunk
    const spawn = world.findSafeSpawn(8.5, 8.5);
    // spawn 3 blocks above ground, gravity will bring us down safely
    this.position.set(spawn.x, spawn.y + 3, spawn.z);
    this.velocity.set(0, 0, 0);
    this.grounded = false;
  }

  update(deltaTime: number): void {
    const inWater = this.isInWater();

    // get movement input
    const input = controls.getMovementInput();

    // edge world: 1/4 speed
    const speedMultiplier = edgeWorldState.isEdgeWorld ? 0.25 : 1;

    if (inWater) {
      // swim up with space
      if (controls.wantsJump()) {
        this.velocity.y += SWIM_UP_ACCELERATION * deltaTime * speedMultiplier;
      }

      // swim down with shift
      if (controls.wantsSwimDown()) {
        this.velocity.y -= SWIM_DOWN_ACCELERATION * deltaTime * speedMultiplier;
      }

      // horizontal movement in water
      this.velocity.x += input.x * WATER_MOVE_SPEED * deltaTime * speedMultiplier;
      this.velocity.z += input.z * WATER_MOVE_SPEED * deltaTime * speedMultiplier;

      // apply water physics (drag, clamping)
      applyWaterPhysics(this.velocity, deltaTime);
    } else {
      // normal physics
      this.applyGravity(deltaTime);

      // apply horizontal movement
      this.velocity.x = input.x * MOVE_SPEED * speedMultiplier;
      this.velocity.z = input.z * MOVE_SPEED * speedMultiplier;

      // jump
      if (controls.wantsJump() && this.grounded) {
        this.velocity.y = JUMP_FORCE;
        this.grounded = false;
      }
    }

    // resolve collisions
    this.resolveCollisions(deltaTime);

    // update camera position and rotation
    gameScene.camera.position.copy(this.position);
    gameScene.camera.position.y += EYE_HEIGHT;
    controls.updateCamera(gameScene.camera);

    // update underwater visual effects
    gameScene.setUnderwater(this.isEyeUnderwater());
  }

  private isEyeUnderwater(): boolean {
    const eyePos = this.position.clone();
    eyePos.y += EYE_HEIGHT;
    const { x, y, z } = toBlockPos(eyePos);
    return world.isBlockWaterAt(x, y, z);
  }
}

export const player = new Player();
