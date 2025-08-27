import { FastifyInstance } from "fastify";
import fp from "fastify-plugin";

export enum CACHE_KEYS {
  ALL_RANKS = "allRanks",
  ALL_MUSCLES = "allMuscles",
  ALL_EXERCISE_MUSCLES = "allExerciseMuscles",
  ALL_MUSCLE_GROUPS = "allMuscleGroups",
  ALL_CUSTOM_EXERCISE_MUSCLES = "allCustomExerciseMuscles",
  ALL_EXERCISES = "allExercises",
  ALL_LEVEL_DEFINITIONS = "allLevelDefinitions",
  MUSCLE_RANK_BENCHMARKS_MALE = "muscle_rank_benchmarks_male",
  MUSCLE_RANK_BENCHMARKS_FEMALE = "muscle_rank_benchmarks_female",
  MUSCLE_GROUP_RANK_BENCHMARKS_MALE = "muscle_group_rank_benchmarks_male",
  MUSCLE_GROUP_RANK_BENCHMARKS_FEMALE = "muscle_group_rank_benchmarks_female",
  OVERALL_RANK_BENCHMARKS_MALE = "overall_rank_benchmarks_male",
  OVERALL_RANK_BENCHMARKS_FEMALE = "overall_rank_benchmarks_female",
  EXERCISE_BENCHMARKS_MALE = "exercise_benchmarks_male",
  EXERCISE_BENCHMARKS_FEMALE = "exercise_benchmarks_female",
}

// A simple in-memory cache store
const cache = new Map<string, { data: any; expiresAt: number }>();

// Default TTL: 24 hours. We can make this configurable if needed.
const DEFAULT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export class CacheService {
  private fastify: FastifyInstance;

  constructor(fastify: FastifyInstance) {
    this.fastify = fastify;
  }

  /**
   * Retrieves an item from the cache. If it's missing or expired, it fetches, caches, and returns it.
   * @param key The key for the cache entry.
   * @param fetcher A function that returns a promise to fetch the data if not in cache.
   * @param ttlMs Optional Time-To-Live in milliseconds for this specific key.
   */
  async get<T>(key: string, fetcher: () => Promise<T>, ttlMs: number = DEFAULT_CACHE_TTL_MS): Promise<T> {
    const now = Date.now();
    const existing = cache.get(key);

    if (existing && now < existing.expiresAt) {
      this.fastify.log.info(`[CACHE_HIT] Returning cached data for key: ${key}`);
      return existing.data as T;
    }

    this.fastify.log.info(`[CACHE_MISS] Fetching fresh data for key: ${key}`);
    const freshData = await fetcher();
    const expiresAt = now + ttlMs;

    cache.set(key, { data: freshData, expiresAt });

    return freshData;
  }

  /**
   * Manually sets a value in the cache.
   * @param key The key for the cache entry.
   * @param value The value to store.
   * @param ttlMs Optional Time-To-Live in milliseconds.
   */
  set<T>(key: string, value: T, ttlMs: number = DEFAULT_CACHE_TTL_MS): void {
    const now = Date.now();
    const expiresAt = now + ttlMs;
    cache.set(key, { data: value, expiresAt });
    this.fastify.log.info(`[CACHE_SET] Manually set cache for key: ${key}`);
  }

  async prewarmCache() {
    this.fastify.log.info("[CACHE_PREWARM] Starting cache prewarming...");
    const supabase = this.fastify.supabase;
    if (!supabase) {
      this.fastify.log.error("[CACHE_PREWARM] Supabase client not available. Aborting prewarm.");
      return;
    }

    const cacheJobs = [
      this.get(CACHE_KEYS.ALL_RANKS, async () => {
        const { data, error } = await supabase.from("ranks").select("id, rank_name, min_score").neq("id", 0);
        if (error) throw error;
        return data || [];
      }),
      this.get(CACHE_KEYS.ALL_MUSCLES, async () => {
        const { data, error } = await supabase.from("muscles").select("id, name, muscle_group_id, muscle_group_weight");
        if (error) throw error;
        return data || [];
      }),
      this.get(CACHE_KEYS.ALL_EXERCISE_MUSCLES, async () => {
        const { data, error } = await supabase
          .from("exercise_muscles")
          .select("exercise_id, muscle_id, muscle_intensity, exercise_muscle_weight");
        if (error) throw error;
        return data || [];
      }),
      this.get(CACHE_KEYS.ALL_MUSCLE_GROUPS, async () => {
        const { data, error } = await supabase.from("muscle_groups").select("id, name, overall_weight");
        if (error) throw error;
        return data || [];
      }),
      this.get(CACHE_KEYS.ALL_CUSTOM_EXERCISE_MUSCLES, async () => {
        const { data, error } = await supabase
          .from("custom_exercise_muscles")
          .select("custom_exercise_id, muscle_id, muscle_intensity");
        if (error) throw error;
        return data || [];
      }),
      this.get(CACHE_KEYS.ALL_EXERCISES, async () => {
        const { data, error } = await supabase.from("v_full_exercises").select("id, exercise_type, source_type");
        if (error) throw error;
        return data || [];
      }),
      this.get(CACHE_KEYS.ALL_LEVEL_DEFINITIONS, async () => {
        const { data, error } = await supabase.from("level_definitions").select("*");
        if (error) throw error;
        return data || [];
      }),
      this.get(CACHE_KEYS.MUSCLE_RANK_BENCHMARKS_MALE, async () => {
        const { data, error } = await supabase.from("muscle_rank_benchmarks").select("*").eq("gender", "male");
        if (error) throw error;
        return data || [];
      }),
      this.get(CACHE_KEYS.MUSCLE_RANK_BENCHMARKS_FEMALE, async () => {
        const { data, error } = await supabase.from("muscle_rank_benchmarks").select("*").eq("gender", "female");
        if (error) throw error;
        return data || [];
      }),
      this.get(CACHE_KEYS.MUSCLE_GROUP_RANK_BENCHMARKS_MALE, async () => {
        const { data, error } = await supabase.from("muscle_group_rank_benchmarks").select("*").eq("gender", "male");
        if (error) throw error;
        return data || [];
      }),
      this.get(CACHE_KEYS.MUSCLE_GROUP_RANK_BENCHMARKS_FEMALE, async () => {
        const { data, error } = await supabase.from("muscle_group_rank_benchmarks").select("*").eq("gender", "female");
        if (error) throw error;
        return data || [];
      }),
      this.get(CACHE_KEYS.OVERALL_RANK_BENCHMARKS_MALE, async () => {
        const { data, error } = await supabase.from("overall_rank_benchmarks").select("*").eq("gender", "male");
        if (error) throw error;
        return data || [];
      }),
      this.get(CACHE_KEYS.OVERALL_RANK_BENCHMARKS_FEMALE, async () => {
        const { data, error } = await supabase.from("overall_rank_benchmarks").select("*").eq("gender", "female");
        if (error) throw error;
        return data || [];
      }),
      this.get(CACHE_KEYS.EXERCISE_BENCHMARKS_MALE, async () => {
        const { data, error } = await supabase.from("exercise_rank_benchmarks").select("*").eq("gender", "male");
        if (error) throw error;
        return data || [];
      }),
      this.get(CACHE_KEYS.EXERCISE_BENCHMARKS_FEMALE, async () => {
        const { data, error } = await supabase.from("exercise_rank_benchmarks").select("*").eq("gender", "female");
        if (error) throw error;
        return data || [];
      }),
    ];

    try {
      await Promise.all(cacheJobs);
      this.fastify.log.info("[CACHE_PREWARM] Cache prewarming completed successfully.");
    } catch (error) {
      this.fastify.log.error({ error }, "[CACHE_PREWARM] Error during cache prewarming.");
    }
  }
}

// Fastify plugin to decorate the instance with our cache service
export default fp(async function (fastify: FastifyInstance) {
  const cacheService = new CacheService(fastify);
  fastify.decorate("appCache", cacheService);

  // Use 'after' to ensure that this code runs after all plugins are loaded,
  // including the Supabase plugin that the prewarmCache method depends on.
  fastify.after((err) => {
    if (err) {
      fastify.log.error(err, "Error in cache service plugin registration.");
      return;
    }
    // No need to await this, let it run in the background
    cacheService.prewarmCache().catch((prewarmErr) => {
      fastify.log.error(prewarmErr, "Failed to pre-warm cache on startup.");
    });
  });
});
