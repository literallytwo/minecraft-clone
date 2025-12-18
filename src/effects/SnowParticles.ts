import * as THREE from 'three';
import { ParticleSystem, type ParticleConfig } from './ParticleSystem';

const SNOW_CONFIG: ParticleConfig = {
  particleCount: 1500,
  spawnRadius: 40,
  spawnHeight: 30,
  particleSize: 0.15,
  color: 0xffffff,
  opacity: 0.8,
  mode: 'world',
  unloadOn: 'solidOrWater',
};

const FALL_SPEED = 4;
const DRIFT_SPEED = 1;

export class SnowParticles extends ParticleSystem {
  private firstUpdate = true;

  constructor() {
    super(SNOW_CONFIG);

    // initial spawn - randomize positions relative to origin
    // will be repositioned on first update when we know player position
    for (let i = 0; i < SNOW_CONFIG.particleCount; i++) {
      const i3 = i * 3;
      this.positions[i3] = (Math.random() - 0.5) * SNOW_CONFIG.spawnRadius * 2;
      this.positions[i3 + 1] = Math.random() * SNOW_CONFIG.spawnHeight;
      this.positions[i3 + 2] = (Math.random() - 0.5) * SNOW_CONFIG.spawnRadius * 2;
      this.initParticleVelocity(i);
    }
  }

  protected initParticleVelocity(index: number): void {
    const i3 = index * 3;
    this.velocities[i3] = (Math.random() - 0.5) * DRIFT_SPEED;
    this.velocities[i3 + 1] = -FALL_SPEED - Math.random() * 2;
    this.velocities[i3 + 2] = (Math.random() - 0.5) * DRIFT_SPEED;
  }

  protected updateParticleVelocity(index: number, deltaTime: number): void {
    const i3 = index * 3;

    // slight drift variation
    this.velocities[i3] += (Math.random() - 0.5) * 0.5 * deltaTime;
    this.velocities[i3 + 2] += (Math.random() - 0.5) * 0.5 * deltaTime;

    // clamp drift so particles don't go sideways forever
    this.velocities[i3] = Math.max(-DRIFT_SPEED * 2, Math.min(DRIFT_SPEED * 2, this.velocities[i3]));
    this.velocities[i3 + 2] = Math.max(-DRIFT_SPEED * 2, Math.min(DRIFT_SPEED * 2, this.velocities[i3 + 2]));
  }

  protected shouldResetParticle(index: number, playerPos: THREE.Vector3): boolean {
    const i3 = index * 3;
    const { spawnRadius } = this.config;

    // check block collision first (solid/water)
    if (this.shouldUnloadOnBlock(index)) return true;

    // in world mode, check distance from player
    const dx = this.positions[i3] - playerPos.x;
    const dz = this.positions[i3 + 2] - playerPos.z;
    const distSq = dx * dx + dz * dz;

    // below threshold or too far from player
    const relY = this.positions[i3 + 1] - playerPos.y;
    return relY < -10 || distSq > spawnRadius * spawnRadius * 2.25;
  }

  update(deltaTime: number, playerPos: THREE.Vector3): void {
    // on first update, reposition all particles around actual player position
    if (this.firstUpdate) {
      this.firstUpdate = false;
      for (let i = 0; i < this.config.particleCount; i++) {
        const i3 = i * 3;
        this.positions[i3] += playerPos.x;
        this.positions[i3 + 1] += playerPos.y;
        this.positions[i3 + 2] += playerPos.z;
      }
    }

    super.update(deltaTime, playerPos);
  }
}
