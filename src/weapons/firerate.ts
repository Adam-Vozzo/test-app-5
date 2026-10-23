// Pure fire-rate accumulator: how many shots fire this frame, so low frame rates keep their RPM
// without banking a backlog while the gun can't shoot.

export interface FireRateState {
  /** Seconds until the next shot may fire (≤ 0 means ready). */
  cooldown: number;
}

/**
 * Advance the accumulator by `dt` and return how many shots fire this frame.
 * @param wants trigger demands fire this frame (held for automatics, pressed for semi)
 * @param canShoot the gun is able to fire (not reloading/committed, has ammo)
 * @param maxShots cap per frame (semi-auto passes 1)
 */
export function stepFireRate(s: FireRateState, dt: number, interval: number, wants: boolean, canShoot: boolean, maxShots: number): number {
  s.cooldown -= dt;
  // Only shots owed within this frame may carry over. Holding the trigger through a reload, roll or swap
  // must not bank a backlog that dumps the next magazine in a few frames.
  if (!wants || !canShoot) {
    s.cooldown = Math.max(s.cooldown, 0);
    return 0;
  }
  s.cooldown = Math.max(s.cooldown, -dt);
  let shots = 0;
  while (s.cooldown <= 0 && shots < maxShots) {
    shots++;
    s.cooldown += interval;
  }
  return shots;
}
