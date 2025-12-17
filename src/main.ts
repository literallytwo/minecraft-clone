import './style.css';
import { textureManager } from './rendering/TextureManager';
import { gameScene } from './rendering/Scene';
import { world } from './world/World';
import { player } from './player/Player';
import { gameState } from './state/GameState';
import { menuManager } from './ui/MenuManager';

async function init() {
  const loadingEl = document.getElementById('loading')!;
  const coordsEl = document.getElementById('coords')!;

  try {
    await textureManager.load();

    // hide loading, show main menu
    loadingEl.style.display = 'none';
    menuManager.init();
  } catch (error) {
    loadingEl.textContent = 'failed to load: ' + error;
    console.error(error);
    return;
  }

  // world generation deferred until first play
  let worldInitialized = false;

  gameState.onStateChange((state) => {
    if (state === 'playing' && !worldInitialized) {
      world.update(0, 0);
      player.spawn();
      worldInitialized = true;
    }

    // reset world when returning to main menu
    if (state === 'main_menu' && worldInitialized) {
      world.reset();
      gameScene.setUnderwater(false);
      worldInitialized = false;
    }
  });

  let lastTime = performance.now();

  function gameLoop(currentTime: number) {
    const deltaTime = Math.min((currentTime - lastTime) / 1000, 0.1);
    lastTime = currentTime;

    // only update game when playing
    if (gameState.isPlaying()) {
      player.update(deltaTime);
      world.update(player.position.x, player.position.z);

      // update coords display
      coordsEl.textContent =
        `X: ${Math.floor(player.position.x)} Y: ${Math.floor(player.position.y)} Z: ${Math.floor(player.position.z)}`;
    }

    // always render so paused menu shows world behind it
    gameScene.render();

    requestAnimationFrame(gameLoop);
  }

  requestAnimationFrame(gameLoop);
}

init();
