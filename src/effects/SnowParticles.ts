import * as THREE from 'three';
import { RenderLayer } from '../utils/constants';
import type { Disposable } from '../utils/Disposable';

const PARTICLE_COUNT = 1500;
const SPAWN_RADIUS = 40;
const SPAWN_HEIGHT = 30;
const FALL_SPEED = 4;
const DRIFT_SPEED = 1;
const PARTICLE_SIZE = 0.15;

export class SnowParticles implements Disposable {
  private particles: THREE.Points;
  private positions: Float32Array;
  private velocities: Float32Array;
  private geometry: THREE.BufferGeometry;

  constructor() {
    this.positions = new Float32Array(PARTICLE_COUNT * 3);
    this.velocities = new Float32Array(PARTICLE_COUNT * 3);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      this.resetParticle(i, true);
    }

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));

    const material = new THREE.PointsMaterial({
      color: 0xffffff,
      size: PARTICLE_SIZE,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      sizeAttenuation: true,
    });

    this.particles = new THREE.Points(this.geometry, material);
    this.particles.renderOrder = RenderLayer.PARTICLES;
  }

  private resetParticle(index: number, randomizeY = false): void {
    const i3 = index * 3;

    // position relative to center
    this.positions[i3] = (Math.random() - 0.5) * SPAWN_RADIUS * 2;
    this.positions[i3 + 1] = randomizeY ? Math.random() * SPAWN_HEIGHT : SPAWN_HEIGHT;
    this.positions[i3 + 2] = (Math.random() - 0.5) * SPAWN_RADIUS * 2;

    // velocity with slight random drift
    this.velocities[i3] = (Math.random() - 0.5) * DRIFT_SPEED;
    this.velocities[i3 + 1] = -FALL_SPEED - Math.random() * 2;
    this.velocities[i3 + 2] = (Math.random() - 0.5) * DRIFT_SPEED;
  }

  update(deltaTime: number, playerPos: THREE.Vector3): void {
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;

      // update position
      this.positions[i3] += this.velocities[i3] * deltaTime;
      this.positions[i3 + 1] += this.velocities[i3 + 1] * deltaTime;
      this.positions[i3 + 2] += this.velocities[i3 + 2] * deltaTime;

      // slight drift variation
      this.velocities[i3] += (Math.random() - 0.5) * 0.5 * deltaTime;
      this.velocities[i3 + 2] += (Math.random() - 0.5) * 0.5 * deltaTime;

      // clamp drift so particles don't go sideways forever
      this.velocities[i3] = Math.max(-DRIFT_SPEED * 2, Math.min(DRIFT_SPEED * 2, this.velocities[i3]));
      this.velocities[i3 + 2] = Math.max(-DRIFT_SPEED * 2, Math.min(DRIFT_SPEED * 2, this.velocities[i3 + 2]));

      // check if particle needs reset (below player or too far)
      const relY = this.positions[i3 + 1];
      const distSq = this.positions[i3] * this.positions[i3] + this.positions[i3 + 2] * this.positions[i3 + 2];

      if (relY < -10 || distSq > SPAWN_RADIUS * SPAWN_RADIUS * 2.25) {
        this.resetParticle(i);
      }
    }

    // center particle system on player
    this.particles.position.copy(playerPos);

    this.geometry.attributes.position.needsUpdate = true;
  }

  getMesh(): THREE.Points {
    return this.particles;
  }

  dispose(): void {
    this.geometry.dispose();
    (this.particles.material as THREE.PointsMaterial).dispose();
  }
}
