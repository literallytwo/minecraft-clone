import * as THREE from 'three';
import { WATER_GRAVITY, WATER_MAX_SWIM_SPEED, WATER_MAX_HORIZONTAL_SPEED, WATER_DRAG } from '../utils/constants';

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
