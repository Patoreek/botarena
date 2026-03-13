/**
 * RunManager — singleton that tracks all active BotRunner instances.
 * Provides start/pause/resume/stop operations by runId.
 */

import { BotRunner, type RunnerConfig } from "./runner.js";

class RunManager {
  private runners = new Map<string, BotRunner>();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Periodically clean up completed runners from the map
    this.cleanupTimer = setInterval(() => this.cleanup(), 10_000);
  }

  /**
   * Remove finished runners from the map so they can be GC'd.
   */
  private cleanup(): void {
    for (const [runId, runner] of this.runners) {
      if (runner.isStopped) {
        this.runners.delete(runId);
      }
    }
  }

  /**
   * Start a new bot runner for the given run.
   */
  start(config: RunnerConfig): BotRunner {
    // Stop any existing runner for this run
    this.stop(config.runId);

    const runner = new BotRunner(config);
    this.runners.set(config.runId, runner);
    runner.start();
    return runner;
  }

  /**
   * Pause a running bot.
   */
  pause(runId: string): boolean {
    const runner = this.runners.get(runId);
    if (!runner || runner.isStopped) return false;
    runner.pause();
    return true;
  }

  /**
   * Resume a paused bot.
   */
  resume(runId: string): boolean {
    const runner = this.runners.get(runId);
    if (!runner || runner.isStopped) return false;
    runner.resume();
    return true;
  }

  /**
   * Stop a bot runner and remove it from tracking.
   */
  async stop(runId: string): Promise<boolean> {
    const runner = this.runners.get(runId);
    if (!runner) return false;
    await runner.stop();
    this.runners.delete(runId);
    return true;
  }

  /**
   * Check if a run is being actively managed.
   */
  has(runId: string): boolean {
    return this.runners.has(runId);
  }

  /**
   * Get status of a runner.
   */
  getStatus(runId: string): "running" | "paused" | "stopped" | "unknown" {
    const runner = this.runners.get(runId);
    if (!runner) return "unknown";
    if (runner.isStopped) return "stopped";
    if (runner.isPaused) return "paused";
    return "running";
  }

  /**
   * Get count of active runners.
   */
  get activeCount(): number {
    let count = 0;
    for (const runner of this.runners.values()) {
      if (!runner.isStopped) count++;
    }
    return count;
  }
}

// Singleton instance
export const runManager = new RunManager();
