/**
 * ArenaManager — tracks which entries belong to which arena.
 * When all entries in an arena complete, it marks the arena as COMPLETED and assigns ranks.
 */

import { prisma } from "../db.js";

interface ArenaTracking {
  arenaId: string;
  entryRunIds: Set<string>; // runIds for each entry
  completedRunIds: Set<string>;
}

class ArenaManager {
  private arenas = new Map<string, ArenaTracking>();
  private runToArena = new Map<string, string>(); // runId -> arenaId

  /**
   * Register an arena and its entry run IDs for tracking.
   */
  track(arenaId: string, runIds: string[]): void {
    const tracking: ArenaTracking = {
      arenaId,
      entryRunIds: new Set(runIds),
      completedRunIds: new Set(),
    };
    this.arenas.set(arenaId, tracking);
    for (const runId of runIds) {
      this.runToArena.set(runId, arenaId);
    }
  }

  /**
   * Called when a run completes. Checks if the arena is done.
   */
  async onRunComplete(runId: string): Promise<void> {
    const arenaId = this.runToArena.get(runId);
    if (!arenaId) return;

    const tracking = this.arenas.get(arenaId);
    if (!tracking) return;

    tracking.completedRunIds.add(runId);

    if (tracking.completedRunIds.size >= tracking.entryRunIds.size) {
      await this.completeArena(arenaId);
    }
  }

  /**
   * Mark arena as completed and assign ranks based on netPnl.
   */
  private async completeArena(arenaId: string): Promise<void> {
    try {
      const entries = await prisma.arenaEntry.findMany({
        where: { arenaId },
        include: { botRun: { select: { netPnl: true } } },
      });

      // Sort by netPnl descending
      entries.sort((a, b) => b.botRun.netPnl - a.botRun.netPnl);

      // Assign ranks
      for (let i = 0; i < entries.length; i++) {
        await prisma.arenaEntry.update({
          where: { id: entries[i].id },
          data: { rank: i + 1 },
        });
      }

      await prisma.arena.update({
        where: { id: arenaId },
        data: { status: "COMPLETED", stoppedAt: new Date() },
      });

      // Cleanup tracking
      const tracking = this.arenas.get(arenaId);
      if (tracking) {
        for (const runId of tracking.entryRunIds) {
          this.runToArena.delete(runId);
        }
      }
      this.arenas.delete(arenaId);
    } catch (err) {
      console.error(`[ArenaManager] Failed to complete arena ${arenaId}:`, err);
    }
  }

  /**
   * Stop all runs in an arena.
   */
  async stopArena(arenaId: string): Promise<void> {
    const tracking = this.arenas.get(arenaId);
    if (tracking) {
      for (const runId of tracking.entryRunIds) {
        this.runToArena.delete(runId);
      }
      this.arenas.delete(arenaId);
    }
  }

  /**
   * Check if a run belongs to an arena.
   */
  isArenaRun(runId: string): boolean {
    return this.runToArena.has(runId);
  }
}

export const arenaManager = new ArenaManager();
