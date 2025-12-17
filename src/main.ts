import './style.css';
import { textureManager } from './rendering/TextureManager';
import { gameScene } from './rendering/Scene';
import { world } from './world/World';
import { player } from './player/Player';
import { controls } from './player/Controls';

async function init() {
  const loadingEl = document.getElementById('loading')!;

  try {
    await textureManager.load();
    world.update(0, 0);
    player.spawn();

    loadingEl.style.display = 'none';
    document.getElementById('instructions')!.style.display = 'block';
  } catch (error) {
    loadingEl.textContent = 'failed to load: ' + error;
    console.error(error);
    return;
  }

  let lastTime = performance.now();

  function gameLoop(currentTime: number) {
    const deltaTime = Math.min((currentTime - lastTime) / 1000, 0.1);
    lastTime = currentTime;

    player.update(deltaTime);
    world.update(player.position.x, player.position.z);
    gameScene.render();

    if (controls.isLocked) {
      document.getElementById('instructions')!.style.display = 'none';
      document.getElementById('crosshair')!.style.display = 'block';
      document.getElementById('coords')!.style.display = 'block';
      document.getElementById('coords')!.textContent =
        `X: ${Math.floor(player.position.x)} Y: ${Math.floor(player.position.y)} Z: ${Math.floor(player.position.z)}`;
    } else {
      document.getElementById('instructions')!.style.display = 'block';
      document.getElementById('crosshair')!.style.display = 'none';
      document.getElementById('coords')!.style.display = 'none';
    }

    requestAnimationFrame(gameLoop);
  }

  requestAnimationFrame(gameLoop);
}

init();
