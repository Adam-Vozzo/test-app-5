// Keyboard + mouse state with pointer lock. Also accepts scripted input (smoke tests drive window.__game.input).

export class Input {
  private down = new Set<string>();
  private pressed = new Set<string>();
  private released = new Set<string>();
  mouseDX = 0;
  mouseDY = 0;
  wheel = 0;
  locked = false;
  /**
   * Soft lock: used when the browser refuses pointer lock (e.g. a sandboxed iframe). Mouse look then runs
   * from raw movement while the cursor is over the page, and Esc pauses instead of the lock being lost.
   */
  soft = false;
  onSoftFallback: () => void = () => {};
  /** Scripted keys/buttons held regardless of real input (for automated tests). */
  readonly virtual = new Set<string>();
  onLockChange: (locked: boolean) => void = () => {};
  onKey: (code: string) => void = () => {};

  constructor(private canvas: HTMLElement) {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
      if (e.repeat) return;
      if (e.code === 'Escape' && this.soft && this.locked) this.exitLock();
      this.press(e.code);
      this.onKey(e.code);
    });
    window.addEventListener('keyup', (e) => this.release(e.code));
    window.addEventListener('blur', () => {
      for (const c of this.down) this.released.add(c);
      this.down.clear();
    });
    canvas.addEventListener('mousedown', (e) => {
      if (!this.locked) return;
      this.press(`Mouse${e.button}`);
    });
    window.addEventListener('mouseup', (e) => this.release(`Mouse${e.button}`));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.mouseDX += e.movementX;
      this.mouseDY += e.movementY;
    });
    window.addEventListener(
      'wheel',
      (e) => {
        if (this.locked) this.wheel += Math.sign(e.deltaY);
      },
      { passive: true },
    );
    document.addEventListener('pointerlockerror', () => this.fallback());
    document.addEventListener('pointerlockchange', () => {
      if (this.soft) return;
      this.locked = document.pointerLockElement === canvas;
      if (!this.locked) {
        for (const c of [...this.down]) if (c.startsWith('Mouse')) this.release(c);
      }
      this.onLockChange(this.locked);
    });
  }

  requestLock() {
    if (this.soft || !this.canvas.requestPointerLock) {
      this.fallback();
      return;
    }
    try {
      const r = this.canvas.requestPointerLock() as unknown;
      if (r instanceof Promise) r.catch(() => this.fallback());
    } catch {
      this.fallback();
    }
  }

  private fallback() {
    const first = !this.soft;
    this.soft = true;
    if (!this.locked) {
      this.locked = true;
      this.canvas.style.cursor = 'none';
      this.onLockChange(true);
    }
    if (first) this.onSoftFallback();
  }

  exitLock() {
    if (this.soft) {
      if (!this.locked) return;
      this.locked = false;
      this.canvas.style.cursor = '';
      for (const c of [...this.down]) if (c.startsWith('Mouse')) this.release(c);
      this.onLockChange(false);
      return;
    }
    if (document.pointerLockElement) document.exitPointerLock();
  }

  press(code: string) {
    if (!this.down.has(code)) this.pressed.add(code);
    this.down.add(code);
  }
  release(code: string) {
    if (this.down.has(code)) this.released.add(code);
    this.down.delete(code);
  }

  held(code: string) {
    return this.down.has(code) || this.virtual.has(code);
  }
  justPressed(code: string) {
    return this.pressed.has(code);
  }
  justReleased(code: string) {
    return this.released.has(code);
  }

  /** Call once at the end of each frame. */
  endFrame() {
    this.pressed.clear();
    this.released.clear();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheel = 0;
  }
}
