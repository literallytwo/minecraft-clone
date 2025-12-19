import * as THREE from 'three';
import { RenderLayer } from '../utils/constants';
import type { Disposable } from '../utils/Disposable';
import { world } from '../world/World';

export type ParticleMode = 'following' | 'world';

// when to reset a particle:
// 'void' - only when below threshold (default behavior)
// 'solid' - when hitting any solid block
// 'solidOrWater' - when hitting any solid block or water
export type UnloadCondition = 'void' | 'solid' | 'solidOrWater';

export interface ParticleConfig {
  particleCount: number;
  spawnRadius: number;
  spawnHeight: number;
  particleSize: number;
  color: number;
  opacity: number;
  mode: ParticleMode;
  unloadOn?: UnloadCondition; // defaults to 'void'
}

export abstract class ParticleSystem implements Disposable {
  protected particles: THREE.Points;
  protected positions: Float32Array;
  protected velocities: Float32Array;
  protected geometry: THREE.BufferGeometry;
  protected config: ParticleConfig;
  protected spawnCenter: THREE.Vector3 = new THREE.Vector3();

  constructor(config: ParticleConfig) {
    this.config = config;
    this.positions = new Float32Array(config.particleCount * 3);
    this.velocities = new Float32Array(config.particleCount * 3);

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));

    const material = new THREE.PointsMaterial({
      color: config.color,
      size: config.particleSize,
      transparent: true,
      opacity: config.opacity,
      depthWrite: true,
      alphaTest: 0.1,
      sizeAttenuation: true,
    });

    this.particles = new THREE.Points(this.geometry, material);
    this.particles.renderOrder = RenderLayer.PARTICLES;

    // world mode uses absolute positions, so frustum culling based on mesh position won't work
    if (config.mode === 'world') {
      this.particles.frustumCulled = false;
    }
  }

  // subclasses implement their own velocity initialization
  protected abstract initParticleVelocity(index: number): void;

  // subclasses implement their own update logic for velocities
  protected abstract updateParticleVelocity(index: number, deltaTime: number): void;

  // subclasses define when a particle should reset
  protected abstract shouldResetParticle(index: number, playerPos: THREE.Vector3): boolean;

  update(deltaTime: number, playerPos: THREE.Vector3): void {
    const { particleCount, mode } = this.config;

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;

      // update position
      this.positions[i3] += this.velocities[i3] * deltaTime;
      this.positions[i3 + 1] += this.velocities[i3 + 1] * deltaTime;
      this.positions[i3 + 2] += this.velocities[i3 + 2] * deltaTime;

      // let subclass update velocity (drift, etc)
      this.updateParticleVelocity(i, deltaTime);

      // check reset conditions
      if (this.shouldResetParticle(i, playerPos)) {
        this.resetParticle(i, playerPos);
      }
    }

    if (mode === 'following') {
      // particles are relative to player - move mesh with player
      this.particles.position.copy(playerPos);
    }
    // world mode: particles have absolute positions, mesh stays at origin

    this.geometry.attributes.position.needsUpdate = true;
  }

  protected resetParticle(index: number, playerPos: THREE.Vector3): void {
    const { mode, spawnRadius, spawnHeight } = this.config;
    const i3 = index * 3;

    if (mode === 'following') {
      // position relative to center (mesh follows player)
      this.positions[i3] = (Math.random() - 0.5) * spawnRadius * 2;
      this.positions[i3 + 1] = spawnHeight;
      this.positions[i3 + 2] = (Math.random() - 0.5) * spawnRadius * 2;
    } else {
      // world mode: absolute world coordinates around player
      this.positions[i3] = playerPos.x + (Math.random() - 0.5) * spawnRadius * 2;
      this.positions[i3 + 1] = playerPos.y + spawnHeight;
      this.positions[i3 + 2] = playerPos.z + (Math.random() - 0.5) * spawnRadius * 2;
    }

    this.initParticleVelocity(index);
  }

  getMesh(): THREE.Points {
    return this.particles;
  }

  // check if particle should unload based on block at its position
  protected shouldUnloadOnBlock(index: number): boolean {
    const condition = this.config.unloadOn ?? 'void';
    if (condition === 'void') return false; // void condition doesn't check blocks

    const i3 = index * 3;
    const x = Math.floor(this.positions[i3]);
    const y = Math.floor(this.positions[i3 + 1]);
    const z = Math.floor(this.positions[i3 + 2]);

    if (condition === 'solid') {
      return world.isBlockSolidAt(x, y, z);
    }
    // solidOrWater
    return world.isBlockSolidAt(x, y, z) || world.isBlockWaterAt(x, y, z);
  }

  dispose(): void {
    this.geometry.dispose();
    (this.particles.material as THREE.PointsMaterial).dispose();
  }
}
