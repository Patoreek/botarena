/**
 * Strategy registry — maps strategy slugs to factory functions.
 * Strategies self-register on import.
 */

import type { IStrategy, StrategyMetadata } from "./types.js";

type StrategyFactory = (config: unknown) => IStrategy;

class StrategyRegistry {
  private factories = new Map<string, StrategyFactory>();
  private metadataMap = new Map<string, StrategyMetadata>();

  register(slug: string, factory: StrategyFactory, metadata: StrategyMetadata): void {
    this.factories.set(slug, factory);
    this.metadataMap.set(slug, metadata);
  }

  create(slug: string, config: unknown): IStrategy {
    const factory = this.factories.get(slug);
    if (!factory) {
      throw new Error(`Unknown strategy: "${slug}". Registered: [${this.listSlugs().join(", ")}]`);
    }
    return factory(config);
  }

  getMetadata(slug: string): StrategyMetadata | undefined {
    return this.metadataMap.get(slug);
  }

  listSlugs(): string[] {
    return Array.from(this.factories.keys());
  }

  listMetadata(): StrategyMetadata[] {
    return Array.from(this.metadataMap.values());
  }

  has(slug: string): boolean {
    return this.factories.has(slug);
  }
}

export const strategyRegistry = new StrategyRegistry();
