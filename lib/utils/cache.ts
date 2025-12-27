/**
 * Simple in-memory cache utility for serverless environments
 *
 * Purpose: Reduce database queries for rarely-changing data (e.g., task lists)
 * Trade-off: Memory usage vs query performance
 *
 * Note: This is a process-local cache suitable for serverless functions.
 * For multi-instance deployments, consider Redis or similar distributed cache.
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  invalidations: number;
  size: number;
}

/**
 * Generic in-memory cache with TTL support
 */
export class InMemoryCache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    invalidations: 0,
    size: 0,
  };
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly ttlMs: number = 5 * 60 * 1000, // Default: 5 minutes
    private readonly maxSize: number = 1000, // Prevent memory leaks
    private readonly enableAutoCleanup: boolean = true
  ) {
    if (enableAutoCleanup) {
      // Clean up expired entries every minute
      this.cleanupInterval = setInterval(() => this.cleanup(), 60 * 1000);
      // Don't keep the process alive just for cleanup
      this.cleanupInterval.unref();
    }
  }

  /**
   * Get value from cache
   * @returns Cached value or undefined if not found/expired
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return undefined;
    }

    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      this.stats.size = this.cache.size;
      return undefined;
    }

    this.stats.hits++;
    return entry.data;
  }

  /**
   * Set value in cache with TTL
   */
  set(key: string, value: T, ttlMs?: number): void {
    // Enforce max size - remove oldest entry
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    const expiresAt = Date.now() + (ttlMs ?? this.ttlMs);
    this.cache.set(key, { data: value, expiresAt });
    this.stats.sets++;
    this.stats.size = this.cache.size;
  }

  /**
   * Invalidate (delete) specific key
   */
  invalidate(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.stats.invalidations++;
      this.stats.size = this.cache.size;
    }
    return deleted;
  }

  /**
   * Invalidate all keys matching a pattern
   * @param pattern - String to match (supports wildcards with regex)
   */
  invalidatePattern(pattern: string | RegExp): number {
    const regex =
      typeof pattern === 'string'
        ? new RegExp(pattern.replace(/\*/g, '.*'))
        : pattern;

    let count = 0;
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        count++;
      }
    }

    this.stats.invalidations += count;
    this.stats.size = this.cache.size;
    return count;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    this.stats.invalidations += size;
    this.stats.size = 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): Readonly<CacheStats> {
    return { ...this.stats };
  }

  /**
   * Get cache hit rate
   */
  getHitRate(): number {
    const total = this.stats.hits + this.stats.misses;
    return total === 0 ? 0 : this.stats.hits / total;
  }

  /**
   * Remove expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      this.stats.size = this.cache.size;
    }
  }

  /**
   * Destroy cache and stop cleanup interval
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.clear();
  }

  /**
   * Get or set pattern - fetch from cache or compute and cache
   */
  async getOrSet(
    key: string,
    fetchFn: () => Promise<T> | T,
    ttlMs?: number
  ): Promise<T> {
    const cached = this.get(key);
    if (cached !== undefined) {
      return cached;
    }

    const value = await fetchFn();
    this.set(key, value, ttlMs);
    return value;
  }
}

/**
 * Create a cache key from parts
 */
export function createCacheKey(
  ...parts: (string | number | undefined)[]
): string {
  return parts.filter((p) => p !== undefined).join(':');
}

/**
 * Cached data type definitions
 */
interface CachedTaskList {
  id: string;
  name: string;
  color: string;
  icon?: string | null;
  description?: string | null;
}

interface CachedCalendar {
  id: string;
  name: string;
  color: string;
  isVisible: boolean;
}

interface CachedApiResponse {
  data: unknown;
  timestamp: number;
}

/**
 * Global cache instances for common use cases
 * In production, consider using Redis or similar distributed cache
 */

// Cache for task lists (rarely change)
export const taskListCache = new InMemoryCache<CachedTaskList[]>(
  5 * 60 * 1000, // 5 minutes TTL
  500, // Max 500 user's task lists cached
  true // Enable auto-cleanup
);

// Cache for calendar metadata (rarely change)
export const calendarMetadataCache = new InMemoryCache<CachedCalendar[]>(
  5 * 60 * 1000, // 5 minutes TTL
  500, // Max 500 user's calendars cached
  true
);

// Generic short-term cache for API responses
export const apiResponseCache = new InMemoryCache<CachedApiResponse>(
  60 * 1000, // 1 minute TTL
  1000, // Max 1000 responses
  true
);

/**
 * Cleanup all caches on process exit
 */
if (typeof process !== 'undefined') {
  process.on('beforeExit', () => {
    taskListCache.destroy();
    calendarMetadataCache.destroy();
    apiResponseCache.destroy();
  });
}
