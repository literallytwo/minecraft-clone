// "edge of the universe" easter egg state
// 1 in 10,000 chance on world generation (independent of seed)
// FUTURE: when survival/damage is added, player should be invincible in edge world
// FUTURE: when mobs are added, no mobs should spawn in edge world

class EdgeWorldState {
  private _isEdgeWorld = false;

  // roll the dice - 1/10,000 chance
  roll(): void {
    this._isEdgeWorld = Math.random() < 0.0001;
  }

  get isEdgeWorld(): boolean {
    return this._isEdgeWorld;
  }

  reset(): void {
    this._isEdgeWorld = false;
  }

  // for testing: force edge world on
  forceEdgeWorld(): void {
    this._isEdgeWorld = true;
  }
}

export const edgeWorldState = new EdgeWorldState();
