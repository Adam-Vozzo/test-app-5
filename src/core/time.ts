// Game clock: slow-mo and hitstop. Real dt drives input/camera look; sim dt drives the world.
import { tuning } from '../tuning';

export class Clock {
  /** Seconds of real time left in the current hitstop. */
  private hitstop = 0;
  elapsed = 0;
  realElapsed = 0;

  addHitstop(seconds: number) {
    this.hitstop = Math.max(this.hitstop, seconds);
  }

  get inHitstop() {
    return this.hitstop > 0;
  }

  /** Advance with real dt; returns the simulation dt for this frame. */
  tick(realDt: number): number {
    this.realElapsed += realDt;
    if (this.hitstop > 0) {
      this.hitstop -= realDt;
      return 0;
    }
    const scale = tuning.debug.slowmo ? tuning.debug.slowmoScale : 1;
    const dt = realDt * scale;
    this.elapsed += dt;
    return dt;
  }
}
