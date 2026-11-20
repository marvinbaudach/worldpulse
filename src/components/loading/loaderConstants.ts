// Shared constants for the loading screen, split out so the component file and
// the globe hook can both use them without importing each other.

// How long the dots take to converge into the center once loading is done —
// they collapse into exactly the point the handoff blooms out of.
export const CONVERGE_MS = 750;

export const MONO = "ui-monospace, 'SF Mono', 'Cascadia Mono', Menlo, Consolas, monospace";
