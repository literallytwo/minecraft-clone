import * as THREE from 'three';
import { RenderLayer } from '../utils/constants';
import { resourceManager } from '../utils/Disposable';

class GameScene {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  private normalFog: THREE.Fog;
  private underwaterFog: THREE.Fog;
  private underwaterOverlay: THREE.Mesh | null = null;
  private isUnderwater = false;

  constructor() {
    // scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb); // sky blue
    this.normalFog = new THREE.Fog(0x87ceeb, 50, 150);
    this.underwaterFog = new THREE.Fog(0x1a4a6e, 0, 30); // dark blue, much closer
    this.scene.fog = this.normalFog;

    // camera
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );

    // renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: false });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    document.body.appendChild(this.renderer.domElement);

    // lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 0.8);
    sunLight.position.set(100, 200, 100);
    this.scene.add(sunLight);

    // create underwater overlay
    this.createUnderwaterOverlay();

    // handle resize
    window.addEventListener('resize', this.onResize.bind(this));

    // set up resource manager with scene
    resourceManager.setScene(this.scene);
  }

  private createUnderwaterOverlay(): void {
    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.MeshBasicMaterial({
      color: 0x1a5a8e,
      transparent: true,
      opacity: 0.3,
      depthTest: false,
      depthWrite: false,
    });
    this.underwaterOverlay = new THREE.Mesh(geometry, material);
    this.underwaterOverlay.renderOrder = RenderLayer.OVERLAY;
    this.underwaterOverlay.frustumCulled = false;
    this.underwaterOverlay.visible = false;
    this.scene.add(this.underwaterOverlay);
  }

  setUnderwater(underwater: boolean): void {
    if (underwater === this.isUnderwater) return;
    this.isUnderwater = underwater;

    if (underwater) {
      this.scene.fog = this.underwaterFog;
      this.scene.background = new THREE.Color(0x1a4a6e);
      if (this.underwaterOverlay) this.underwaterOverlay.visible = true;
    } else {
      this.scene.fog = this.normalFog;
      this.scene.background = new THREE.Color(0x87ceeb);
      if (this.underwaterOverlay) this.underwaterOverlay.visible = false;
    }
  }

  private onResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  render(): void {
    // position underwater overlay in front of camera
    if (this.underwaterOverlay && this.underwaterOverlay.visible) {
      this.underwaterOverlay.position.copy(this.camera.position);
      const forward = new THREE.Vector3(0, 0, -0.1);
      forward.applyQuaternion(this.camera.quaternion);
      this.underwaterOverlay.position.add(forward);
      this.underwaterOverlay.quaternion.copy(this.camera.quaternion);
    }
    this.renderer.render(this.scene, this.camera);
  }

  add(object: THREE.Object3D): void {
    this.scene.add(object);
  }

  remove(object: THREE.Object3D): void {
    this.scene.remove(object);
  }
}

export const gameScene = new GameScene();
