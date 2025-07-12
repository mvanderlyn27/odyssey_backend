import { FastifyInstance } from "fastify";

// Word lists remain the same as the previous version.
const wordLists = {
  adjectives: [
    "Aesthetic",
    "Anabolic",
    "Asymmetric",
    "Barely",
    "Bulking",
    "Caffeinated",
    "Certified",
    "Chronic",
    "Clueless",
    "Cutting",
    "Dehydrated",
    "Delusional",
    "Eccentric",
    "Elite",
    "Giga",
    "GuestPass",
    "HighCarb",
    "Isometric",
    "Legendary",
    "LowCarb",
    "Maximal",
    "Peak",
    "Professional",
    "Questionable",
    "Renegade",
    "Shredded",
    "Sore",
    "Subpar",
    "Sweaty",
    "Unilateral",
    "Unmotivated",
  ],
  personNouns: [
    "Beast",
    "Connoisseur",
    "Enthusiast",
    "Fiend",
    "Goblin",
    "Gremlin",
    "Intern",
    "Journeyman",
    "Lifter",
    "Menace",
    "NPC",
    "Rizzlord",
  ],
  objectNouns: [
    "Barbell",
    "Bicep",
    "Cable",
    "Calf",
    "Creatine",
    "Deadlift",
    "Delt",
    "Dumbbell",
    "Glute",
    "Kettlebell",
    "LastRep",
    "Lat",
    "LegPress",
    "Plate",
    "PreWorkout",
    "Pump",
    "Quad",
    "Shaker",
    "Tricep",
  ],
  personSuffixes: [
    "Advocate",
    "Champion",
    "Defender",
    "Enjoyer",
    "Enthusiast",
    "Hater",
    "King",
    "Lord",
    "Skipper",
    "Specialist",
  ],
  gymVerbs: [
    "Arching",
    "Chasing",
    "Chugging",
    "Counting",
    "Curling",
    "Dropping",
    "DryScooping",
    "EgoLifting",
    "Filming",
    "Forgetting",
    "Ignoring",
    "Losing",
    "Posing",
    "Racking",
    "Reracking",
    "Repping",
    "Skipping",
    "Spotting",
    "Staring",
    "Training",
    "Unracking",
  ],
  ironicTitles: ["CEO of", "Chief of", "Founder of", "King of", "Lord of", "Master of", "President of", "The Final"],
  problemNouns: [
    "Bad Form",
    "Bad Spotters",
    "Calf Cramps",
    "Cardio",
    "DOMS",
    "Ego Lifting",
    "Full Racks",
    "The Gym Crush",
    "Leg Day",
    "The Stairs",
  ],
  statefulTropes: ["is Crying", "is Leaking", "is Missing", "Needs a Spot"],
  possessivePrefixes: ["My", "Your", "The"],
  adverbialPrefixes: ["Always", "Chronic", "Endless", "Eternal", "Forever", "Just", "Perpetual"],
};

// Helper function to make code cleaner and avoid repetition
function getRandomItem<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

// isUsernameTaken function remains the same. It checks the lowercase, no-space username.
async function isUsernameTaken(fastify: FastifyInstance, username: string): Promise<boolean> {
  // ... your existing isUsernameTaken function remains the same ...
  if (!fastify.supabase) {
    throw new Error("Supabase client not available");
  }
  const { data, error } = await fastify.supabase.from("profiles").select("username").eq("username", username).single();

  if (error && error.code !== "PGRST116") {
    // PGRST116 = 'not found'
    fastify.log.error({ error }, `Error checking if username '${username}' is taken.`);
    throw error;
  }
  return !!data;
}

// The final, updated generator function
export async function generateUniqueUsername(
  fastify: FastifyInstance
): Promise<{ username: string; displayName: string }> {
  if (!fastify.supabase) {
    throw new Error("Supabase client not available");
  }
  // Formulas now generate human-readable strings WITH SPACES.
  const formulas = [
    () => `${getRandomItem(wordLists.adjectives)} ${getRandomItem(wordLists.personNouns)}`,
    () =>
      `${getRandomItem(wordLists.adjectives)} ${getRandomItem(wordLists.objectNouns)} ${getRandomItem(
        wordLists.personSuffixes
      )}`,
    () => `${getRandomItem(wordLists.ironicTitles)} ${getRandomItem(wordLists.problemNouns)}`,
    () =>
      `${getRandomItem(wordLists.possessivePrefixes)} ${getRandomItem(wordLists.objectNouns)} ${getRandomItem(
        wordLists.statefulTropes
      )}`,
    () =>
      `${getRandomItem(wordLists.adverbialPrefixes)} ${getRandomItem(wordLists.gymVerbs)} ${getRandomItem(
        wordLists.problemNouns
      )}`,
    () => `${getRandomItem(wordLists.gymVerbs)} ${getRandomItem(wordLists.objectNouns)}`,
  ];

  while (true) {
    const selectedFormula = getRandomItem(formulas);

    // 1. Generate the human-readable Display Name first.
    const baseDisplayName = selectedFormula();

    // 2. Derive the system-friendly Username from it.
    const baseUsername = baseDisplayName.replace(/ /g, "").toLowerCase();

    // 3. PERFORMANCE: Create a batch of potential USERNAMES to check.
    const batchSize = 5;
    const usernameBatch = [baseUsername];
    for (let i = 2; i <= batchSize; i++) {
      usernameBatch.push(`${baseUsername}${i}`);
    }

    // 4. Single database query to find all taken usernames within our batch.
    const { data: takenProfiles, error } = await fastify.supabase
      .from("profiles")
      .select("username")
      .in("username", usernameBatch);

    if (error) {
      fastify.log.error({ error }, `Error checking batch of usernames.`);
      throw error;
    }

    const takenUsernames = new Set(takenProfiles.map((p) => p.username));

    // 5. Find the first available name in our batch and construct the final pair.
    for (const finalUsername of usernameBatch) {
      if (!takenUsernames.has(finalUsername)) {
        // We found a unique username. Now, create the matching display name.
        let finalDisplayName = baseDisplayName;

        // If a number was added to the username, add it to the display name too.
        if (finalUsername !== baseUsername) {
          const numberSuffix = finalUsername.substring(baseUsername.length); // Extracts "2", "3", etc.
          finalDisplayName = `${baseDisplayName} ${numberSuffix}`;
        }

        // Return the final object.
        return { username: finalUsername, displayName: finalDisplayName };
      }
    }

    // If the entire batch was somehow taken, the `while(true)` loop will simply try again
    // with a completely new random base name.
  }
}
