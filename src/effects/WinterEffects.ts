import * as THREE from 'three';
import { SnowParticles } from './SnowParticles';
import { SnowAccumulation } from './SnowAccumulation';
import { isDecember } from '../utils/seasonalEffects';
import { resourceManager, type Disposable } from '../utils/Disposable';

export class WinterEffects implements Disposable {
  private snowParticles: SnowParticles | null = null;
  private snowAccumulation: SnowAccumulation | null = null;
  private enabled = false;

  constructor() {
    this.enabled = isDecember();

    if (this.enabled) {
      this.snowParticles = new SnowParticles();
      this.snowAccumulation = new SnowAccumulation();
      resourceManager.track(this.snowParticles, this.snowParticles.getMesh());
    }
  }

  update(deltaTime: number, currentTime: number, playerPos: THREE.Vector3): void {
    if (!this.enabled) return;

    this.snowParticles?.update(deltaTime, playerPos);
    this.snowAccumulation?.update(currentTime, playerPos.x, playerPos.z);
  }

  dispose(): void {
    if (this.snowParticles) {
      resourceManager.release(this.snowParticles);
    }
    this.snowParticles = null;
    this.snowAccumulation = null;
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}
