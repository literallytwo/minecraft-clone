import * as THREE from 'three';

// interface for objects that need cleanup
export interface Disposable {
  dispose(): void;
}

// tracks disposable resources and handles cleanup
export class ResourceManager {
  private resources: Set<Disposable> = new Set();
  private sceneObjects: Map<Disposable, THREE.Object3D> = new Map();
  private scene: THREE.Scene | null = null;

  setScene(scene: THREE.Scene): void {
    this.scene = scene;
  }

  // register a disposable resource, optionally with a scene object
  track<T extends Disposable>(resource: T, sceneObject?: THREE.Object3D): T {
    this.resources.add(resource);
    if (sceneObject) {
      this.sceneObjects.set(resource, sceneObject);
      this.scene?.add(sceneObject);
    }
    return resource;
  }

  // dispose a specific resource
  release(resource: Disposable): void {
    if (!this.resources.has(resource)) return;

    const sceneObject = this.sceneObjects.get(resource);
    if (sceneObject && this.scene) {
      this.scene.remove(sceneObject);
    }

    resource.dispose();
    this.resources.delete(resource);
    this.sceneObjects.delete(resource);
  }

  // dispose all tracked resources
  disposeAll(): void {
    for (const resource of this.resources) {
      const sceneObject = this.sceneObjects.get(resource);
      if (sceneObject && this.scene) {
        this.scene.remove(sceneObject);
      }
      resource.dispose();
    }
    this.resources.clear();
    this.sceneObjects.clear();
  }
}

export const resourceManager = new ResourceManager();
