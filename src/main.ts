import { seedFromUrl } from './core/rng';
import { Game } from './game';
import { Physics } from './physics/world';
import { tuning } from './tuning';

declare global {
  interface Window {
    __game?: Game;
    __tuning?: typeof tuning;
  }
}

async function boot() {
  await Physics.init();
  const seed = seedFromUrl(location.search, Date.now() % 100000);
  const game = new Game(document.getElementById('app')!, seed);
  window.__game = game;
  window.__tuning = tuning;
  const mode = new URLSearchParams(location.search).get('mode');
  if (mode === 'arena' || mode === 'range' || mode === 'garden' || mode === 'kitchen') game.start(mode);
}

boot().catch((e) => {
  console.error(e);
  document.body.insertAdjacentHTML('beforeend', `<pre style="color:#fff;padding:20px">Failed to start: ${String(e)}</pre>`);
});
