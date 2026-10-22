import { seedFromUrl } from './core/rng';
import { Game } from './game';
import { Physics } from './physics/world';

declare global {
  interface Window {
    __game?: Game;
  }
}

async function boot() {
  await Physics.init();
  const seed = seedFromUrl(location.search, Date.now() % 100000);
  const game = new Game(document.getElementById('app')!, seed);
  window.__game = game;
  const mode = new URLSearchParams(location.search).get('mode');
  if (mode === 'arena' || mode === 'range') game.start(mode);
}

boot().catch((e) => {
  console.error(e);
  document.body.insertAdjacentHTML('beforeend', `<pre style="color:#fff;padding:20px">Failed to start: ${String(e)}</pre>`);
});
