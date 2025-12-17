import { gameState } from '../state/GameState';
import type { GameStateType } from '../state/GameState';
import { gameScene } from '../rendering/Scene';

class MenuManager {
  private mainMenuEl: HTMLElement;
  private pauseMenuEl: HTMLElement;
  private crosshairEl: HTMLElement;
  private coordsEl: HTMLElement;

  constructor() {
    this.mainMenuEl = document.getElementById('main-menu')!;
    this.pauseMenuEl = document.getElementById('pause-menu')!;
    this.crosshairEl = document.getElementById('crosshair')!;
    this.coordsEl = document.getElementById('coords')!;

    this.setupEventListeners();
    gameState.onStateChange(this.updateUI.bind(this));
  }

  private setupEventListeners(): void {
    // singleplayer button starts the game
    document.getElementById('btn-singleplayer')!.addEventListener('click', () => {
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
