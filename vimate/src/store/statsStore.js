import { create } from 'zustand';
import { EMPTY_STATS } from '../lib/rtc/stats.js';

/**
 * Connection telemetry, updated on its own cadence (twice a second) and kept
 * away from the stores the video grid subscribes to.
 *
 * Only the quality badge and the diagnostics drawer read this, so a bitrate
 * sample costs a handful of tiny re-renders instead of rebuilding the grid.
 */
export const useStatsStore = create((set) => ({
  /** @type {Record<string, import('../lib/rtc/stats.js').PeerStats>} */
  byPeer: {},

  update: (id, stats) =>
    set((state) => ({ byPeer: { ...state.byPeer, [id]: stats } })),

  updateMany: (entries) =>
    set((state) => {
      if (entries.length === 0) return {};
      const byPeer = { ...state.byPeer };
      for (const [id, stats] of entries) byPeer[id] = stats;
      return { byPeer };
    }),

  drop: (id) =>
    set((state) => {
      if (!(id in state.byPeer)) return {};
      const byPeer = { ...state.byPeer };
      delete byPeer[id];
      return { byPeer };
    }),

  reset: () => set({ byPeer: {} }),
}));

export const makeSelectStats = (id) => (state) => state.byPeer[id] ?? EMPTY_STATS;

export default useStatsStore;
