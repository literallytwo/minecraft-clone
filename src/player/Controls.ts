import * as THREE from 'three';
import { gameScene } from '../rendering/Scene';
import { gameState } from '../state/GameState';
import { edgeWorldState } from '../state/EdgeWorldState';

class Controls {
  private keys: Set<string> = new Set();
  private pitch = 0; // up/down rotation
  private yaw = 0;   // left/right rotation
  private mouseSensitivity = 0.002;

  isLocked = false;

  constructor() {
    // keyboard
    document.addEventListener('keydown', (e) => {
      this.keys.add(e.code.toLowerCase());
    });

    document.addEventListener('keyup', (e) => {
      this.keys.delete(e.code.toLowerCase());
    });

    // pointer lock state tracking
    document.addEventListener('pointerlockchange', () => {
      this.isLocked = document.pointerLockElement === gameScene.renderer.domElement;

      // if pointer lock was lost while playing, go to paused state
      // edge world: menu is disabled, try to reacquire lock
      if (!this.isLocked && gameState.isPlaying()) {
        if (edgeWorldState.isEdgeWorld) {
          // try to reacquire pointer lock in edge world
          setTimeout(() => {
            if (gameState.isPlaying() && edgeWorldState.isEdgeWorld) {
              gameScene.renderer.domElement.requestPointerLock();
            }
          }, 100);
        } else {
          gameState.setState('paused');
        }
      }
    });

    // ESC key handling - browser automatically exits pointer lock on ESC,
    // but we need to ensure we go to paused (not main menu)
    // edge world: menu is disabled, can only escape by falling into void
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && gameState.isPlaying() && !edgeWorldState.isEdgeWorld) {
        // browser will handle exiting pointer lock, we just ensure state is set
        gameState.setState('paused');
      }
    });

    // mouse movement
    document.addEventListener('mousemove', (e) => {
      if (!this.isLocked) return;

      this.yaw -= e.movementX * this.mouseSensitivity;
      this.pitch -= e.movementY * this.mouseSensitivity;

      // clamp pitch to prevent flipping
      this.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.pitch));
    });
  }

  isKeyDown(key: string): boolean {
    return this.keys.has(key.toLowerCase());
  }

  // get movement input as direction vector (forward/right based on camera facing)
  getMovementInput(): THREE.Vector3 {
    const input = new THREE.Vector3();

    if (this.isKeyDown('keyw') || this.isKeyDown('arrowup')) input.z -= 1;
    if (this.isKeyDown('keys') || this.isKeyDown('arrowdown')) input.z += 1;
    if (this.isKeyDown('keya') || this.isKeyDown('arrowleft')) input.x -= 1;
    if (this.isKeyDown('keyd') || this.isKeyDown('arrowright')) input.x += 1;

    // normalize to prevent faster diagonal movement
    if (input.length() > 0) input.normalize();

    // rotate input to face camera direction (only yaw, not pitch)
    const rotation = new THREE.Euler(0, this.yaw, 0);
    input.applyEuler(rotation);

    return input;
  }

  wantsJump(): boolean {
    return this.isKeyDown('space');
  }

  wantsSwimDown(): boolean {
    return this.isKeyDown('shiftleft') || this.isKeyDown('shiftright');
  }

  // update camera rotation
  updateCamera(camera: THREE.Camera): void {
    camera.rotation.order = 'YXZ';
    camera.rotation.y = this.yaw;
    camera.rotation.x = this.pitch;
  }

  // get forward direction for raycasting
  getForwardDirection(): THREE.Vector3 {
    const direction = new THREE.Vector3(0, 0, -1);
    const rotation = new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ');
    direction.applyEuler(rotation);
    return direction;
  }
}

export const controls = new Controls();
