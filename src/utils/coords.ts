import * as THREE from 'three';

// convert world position to block coordinates
export function toBlockPos(pos: THREE.Vector3): { x: number; y: number; z: number } {
  return {
    x: Math.floor(pos.x),
    y: Math.floor(pos.y),
    z: Math.floor(pos.z),
  };
}

// get min/max block coords that an AABB covers
export function getBlockBounds(
  position: THREE.Vector3,
  halfWidth: number,
  height: number
): { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number } {
  return {
    minX: Math.floor(position.x - halfWidth),
    maxX: Math.floor(position.x + halfWidth),
    minY: Math.floor(position.y),
    maxY: Math.floor(position.y + height),
    minZ: Math.floor(position.z - halfWidth),
    maxZ: Math.floor(position.z + halfWidth),
  };
}
