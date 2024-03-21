import { create } from 'zustand';

const SOUND_KEY = 'vimate.sound';
const FIT_KEY = 'vimate.videoFit';

function readString(key, allowed, fallback) {
  try {
    const stored = localStorage.getItem(key);
    return allowed.includes(stored) ? stored : fallback;
  } catch {
    return fallback;
  }
}

function readBoolean(key, fallback) {
  try {
    const stored = localStorage.getItem(key);
    return stored === null ? fallback : stored === 'true';
  } catch {
    return fallback;
  }
}

function persist(key, value) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // Storage blocked; the setting still holds for this session.
  }
}

/**
 * View state. Nothing here touches the network or the media stack, so it can
 * change as often as the user likes without disturbing the call.
 */
export const useUIStore = create((set, get) => ({
  layout: 'auto', // auto | grid | spotlight
  spotlightId: null,

  sidePanel: 'chat', // chat | roster | null

  /*
   * Open by default only where the panel docks beside the stage.
   *
   * Below that it is a sheet over the call, and defaulting it open meant a
   * phone joined a call into a chat panel covering the video — with its scrim
   * swallowing taps on the picture-in-picture tile behind it.
   */
  isPanelOpen:
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(min-width: 1080px)').matches
      : true,

  /*
   * How video is framed inside its tile.
   *
   *   fit  — the whole frame, letterboxed. Nobody is ever cropped.
   *   fill — cover the tile, cropping whatever does not fit.
   *
   * Defaults to `fit`, matching Google Meet's tiled view (which letterboxes
   * "to show you everything your camera sees") and Zoom's Original Ratio.
   * Cropping is a real preference — it looks tidier in a uniform grid — but it
   * is the wrong default, because the thing it crops is the top of people's
   * heads. Both products expose the same toggle; so does this.
   */
  videoFit: readString(FIT_KEY, ['fit', 'fill'], 'fit'),

  /**
   * Sound is on by default because join/leave chimes are load-bearing in a
   * call — you need to know someone arrived while you were looking elsewhere —
   * but it is one click from off and the choice is remembered. Nothing here
   * ever plays before a user gesture, which also keeps autoplay policy happy.
   */
  soundEnabled: readBoolean(SOUND_KEY, true),

  /**
   * Deliberately **not** persisted.
   *
   * It is an inspection, not a preference: you open it because a call is bad,
   * and you are done with it a minute later. Remembering it meant every
   * subsequent call opened with a table of packet-loss figures over the video,
   * with no obvious way to get rid of it — the panel had no close of its own,
   * so the only route back was to find the same control again.
   */
  diagnosticsOpen: false,

  toast: null,

  setLayout: (layout) => set({ layout }),

  /** Click-to-expand: a second click on the spotlit tile returns to the grid. */
  toggleSpotlight: (id) =>
    set((state) =>
      state.spotlightId === id
        ? { spotlightId: null, layout: 'auto' }
        : { spotlightId: id, layout: 'spotlight' }
    ),

  setSpotlight: (spotlightId) =>
    set({ spotlightId, layout: spotlightId ? 'spotlight' : 'auto' }),

  /**
   * `auto` is grid until something (a screen share, a spotlight click) says
   * otherwise, so it has to toggle *to* spotlight — treating it as "not grid"
   * made the button both mislabel itself and move the wrong way on first press.
   */
  cycleLayout: () =>
    set((state) => {
      const showingGrid = state.layout !== 'spotlight';
      return {
        layout: showingGrid ? 'spotlight' : 'grid',
        spotlightId: showingGrid ? state.spotlightId : null,
      };
    }),

  openPanel: (sidePanel) => set({ sidePanel, isPanelOpen: true }),
  togglePanel: () => set((state) => ({ isPanelOpen: !state.isPanelOpen })),

  toggleVideoFit: () => {
    const videoFit = get().videoFit === 'fit' ? 'fill' : 'fit';
    persist(FIT_KEY, videoFit);
    set({ videoFit });
    return videoFit;
  },

  toggleSound: () => {
    const soundEnabled = !get().soundEnabled;
    persist(SOUND_KEY, soundEnabled);
    set({ soundEnabled });
    return soundEnabled;
  },

  toggleDiagnostics: () => set((state) => ({ diagnosticsOpen: !state.diagnosticsOpen })),
  closeDiagnostics: () => set({ diagnosticsOpen: false }),

  /** Transient status line. `null` clears it. */
  pushToast: (toast) => set({ toast: toast ? { ...toast, at: Date.now() } : null }),
}));

export default useUIStore;
