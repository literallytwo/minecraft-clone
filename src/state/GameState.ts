export type GameStateType = 'main_menu' | 'playing' | 'paused';

type StateChangeCallback = (state: GameStateType) => void;

class GameState {
  private _state: GameStateType = 'main_menu';
  private listeners: StateChangeCallback[] = [];

  get state(): GameStateType {
    return this._state;
  }

  setState(newState: GameStateType): void {
    if (this._state === newState) return;
    this._state = newState;
    this.listeners.forEach(cb => cb(newState));
  }

  onStateChange(callback: StateChangeCallback): void {
    this.listeners.push(callback);
  }

  isPlaying(): boolean {
    return this._state === 'playing';
  }

  isPaused(): boolean {
    return this._state === 'paused';
  }

  isMainMenu(): boolean {
    return this._state === 'main_menu';
  }
}

export const gameState = new GameState();
