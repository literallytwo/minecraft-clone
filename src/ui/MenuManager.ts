import { gameState } from '../state/GameState';
import type { GameStateType } from '../state/GameState';
import { gameScene } from '../rendering/Scene';
import { hashSeed } from '../utils/seedHash';
import { terrainGenerator } from '../world/TerrainGenerator';
import { edgeWorldState } from '../state/EdgeWorldState';
import { audioManager } from '../audio/AudioManager';

// konami code: up up down down left right left right b a
const KONAMI_CODE = [
  'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
  'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight',
  'KeyB', 'KeyA'
];

class MenuManager {
  private mainMenuEl: HTMLElement;
  private pauseMenuEl: HTMLElement;
  private crosshairEl: HTMLElement;
  private coordsEl: HTMLElement;
  private seedInputEl: HTMLInputElement;
  private konamiProgress = 0;

  constructor() {
    this.mainMenuEl = document.getElementById('main-menu')!;
    this.pauseMenuEl = document.getElementById('pause-menu')!;
    this.crosshairEl = document.getElementById('crosshair')!;
    this.coordsEl = document.getElementById('coords')!;
    this.seedInputEl = document.getElementById('seed-field') as HTMLInputElement;

    this.setupEventListeners();
    this.setupKonamiCode();
    gameState.onStateChange(this.updateUI.bind(this));
  }

  private generateRandomSeed(): string {
    return Math.floor(Math.random() * 10000000000).toString();
  }

  private setupEventListeners(): void {
    // singleplayer button starts the game
    document.getElementById('btn-singleplayer')!.addEventListener('click', () => {
      // roll for edge world (1/10,000 chance, independent of seed)
      // skip roll if already forced via konami code
      if (!edgeWorldState.isEdgeWorld) {
        edgeWorldState.roll();
      }

      const seedString = this.seedInputEl.value.trim() || this.generateRandomSeed();
      terrainGenerator.setSeed(hashSeed(seedString));

      // start eerie music if edge world
      if (edgeWorldState.isEdgeWorld) {
        audioManager.playLoop('sounds/edgeofauniverse.mp3');
      }

      gameState.setState('playing');
      this.requestPointerLock();
    });

    // resume button continues the game
    document.getElementById('btn-resume')!.addEventListener('click', () => {
      gameState.setState('playing');
      this.requestPointerLock();
    });

    // back to menu button returns to main menu
    document.getElementById('btn-back-to-menu')!.addEventListener('click', () => {
      gameState.setState('main_menu');
    });
  }

  private setupKonamiCode(): void {
    document.addEventListener('keydown', (e) => {
      // only listen on main menu
      if (gameState.state !== 'main_menu') {
        this.konamiProgress = 0;
        return;
      }

      if (e.code === KONAMI_CODE[this.konamiProgress]) {
        this.konamiProgress++;
        if (this.konamiProgress === KONAMI_CODE.length) {
          edgeWorldState.forceEdgeWorld();
          this.konamiProgress = 0;
          console.log('edge of the universe activated');
        }
      } else {
        // reset on wrong key (unless it's the start of the sequence)
        this.konamiProgress = e.code === KONAMI_CODE[0] ? 1 : 0;
      }
    });
  }

  private requestPointerLock(): void {
    gameScene.renderer.domElement.requestPointerLock();
  }

  private hideAll(): void {
    this.mainMenuEl.style.display = 'none';
    this.pauseMenuEl.style.display = 'none';
    this.crosshairEl.style.display = 'none';
    this.coordsEl.style.display = 'none';
  }

  private updateUI(state: GameStateType): void {
    this.hideAll();

    switch (state) {
      case 'main_menu':
        this.mainMenuEl.style.display = 'block';
        this.seedInputEl.value = this.generateRandomSeed();
        break;
      case 'paused':
        this.pauseMenuEl.style.display = 'block';
        break;
      case 'playing':
        this.crosshairEl.style.display = 'block';
        this.coordsEl.style.display = 'block';
        break;
    }
  }

  // call this after DOM is ready
  init(): void {
    // set initial UI state
    this.updateUI(gameState.state);
  }
}

export const menuManager = new MenuManager();
