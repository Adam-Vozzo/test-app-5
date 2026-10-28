// Just enough of a DOM for builders that paint small canvas textures (glow pools, blob shadows) to run in Node.
const ctx2d = new Proxy(
  {},
  { get: (_t, p) => (p === 'createRadialGradient' || p === 'createLinearGradient' ? () => ({ addColorStop() {} }) : () => {}) },
);
const g = globalThis as unknown as { document?: unknown };
g.document ??= {
  createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d }),
};
