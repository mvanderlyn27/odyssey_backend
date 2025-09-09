import { FastifyInstance } from "fastify";
import { ProfileUpdate } from "./onboard.types";

// Expanded + tuned word lists
const wordLists = {
  adjectives: [
    "Aesthetic",
    "Anabolic",
    "Alpha",
    "Beta",
    "Sigma",
    "Bulking",
    "Cutting",
    "Caffeinated",
    "Decaf",
    "DryScooped",
    "Sleeveless",
    "Mirin",
    "Overtrained",
    "Pumped",
    "Sweaty",
    "Juicy",
    "Juiced",
    "DirtyBulk",
    "Natty",
    "NotNatty",
    "Shredded",
    "Plateaued",
    "PRless",
    "Underslept",
    "Overcooked",
    "Chalky",
    "WheyPowered",
    "Delusional",
    "FakeNatty",
    "Elite",
  ],
  personNouns: [
    "Beast",
    "Bro",
    "Coach",
    "Connoisseur",
    "Enthusiast",
    "Fiend",
    "Goblin",
    "Gremlin",
    "GymBro",
    "GymRat",
    "Intern",
    "Journeyman",
    "Lifter",
    "Meathead",
    "Menace",
    "NPC",
    "Powerbuilder",
    "Rizzler",
    "Spotter",
    "Chad",
    "Sigma",
    "GymDaddy",
    "OHPEnjoyer",
  ],
  objectNouns: [
    "Barbell",
    "Bench",
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
    "OHP",
    "Plate",
    "PreWorkout",
    "Pump",
    "Quad",
    "Shaker",
    "SmithMachine",
    "Straps",
    "TankTop",
    "Tricep",
    "FoamRoller",
    "Chalk",
    "ResistanceBand",
    "InclineBench",
    "EZBar",
  ],
  personSuffixes: [
    "Advocate",
    "Champion",
    "Collector",
    "Defender",
    "Enjoyer",
    "Enthusiast",
    "Goblin",
    "Hater",
    "King",
    "Lord",
    "Merchant",
    "Specialist",
    "Whisperer",
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
    "Failing",
    "Filming",
    "Flexing",
    "Forgetting",
    "Grinding",
    "Ignoring",
    "Losing",
    "Mirin",
    "Overtraining",
    "Posing",
    "Racking",
    "Reracking",
    "Repping",
    "Skipping",
    "Snapping",
    "Spotting",
    "Staring",
    "Training",
    "Unracking",
  ],
  ironicTitles: [
    "CEO of",
    "Chief of",
    "Founder of",
    "King of",
    "Lord of",
    "Master of",
    "President of",
    "Prophet of",
    "Uncle of",
    "Minister of",
    "The Final",
  ],
  problemNouns: [
    "Bad Form",
    "Bad Spotters",
    "Calf Cramps",
    "Cardio",
    "Chicken Legs",
    "DOMS",
    "Ego Lifting",
    "Elbow Tendonitis",
    "Empty Bar",
    "Full Racks",
    "Gym Anxiety",
    "The Gym Crush",
    "Leg Day",
    "Preworkout Crash",
    "The Smith Machine",
    "Stairs",
    "T-Rex Arms",
    "Sweaty Bench",
    "Lost Gains",
    "Skipped Warmup",
    "Broken Cable",
  ],
  statefulTropes: [
    "is Crying",
    "is Leaking",
    "is Missing",
    "Forgot Leg Day",
    "Needs a Spot",
    "Can’t Bench",
    "Needs Chalk",
    "Is Natty",
    "Isn’t Natty",
  ],
  possessivePrefixes: ["My", "Your", "The"],
  adverbialPrefixes: ["Always", "Chronic", "Endless", "Eternal", "Forever", "Just", "Perpetual"],
};

// Random picker
function getRandomItem<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

// Username uniqueness check
async function isUsernameTaken(fastify: FastifyInstance, username: string): Promise<boolean> {
  if (!fastify.supabase) {
    throw new Error("Supabase client not available");
  }
  const { data, error } = await fastify.supabase.from("profiles").select("username").eq("username", username).single();

  if (error && error.code !== "PGRST116") {
    fastify.log.error({ error }, `Error checking if username '${username}' is taken.`);
    throw error;
  }
  return !!data;
}

// Template system for funny gym names
const templates = [
  // Classic Enjoyer / Enthusiast
  () => `${getRandomItem(wordLists.objectNouns)} Enjoyer`,
  () => `${getRandomItem(wordLists.objectNouns)} Enthusiast`,
  () => `${getRandomItem(wordLists.personNouns)} Enjoyer`,

  // Adjective combos
  () => `${getRandomItem(wordLists.adjectives)} ${getRandomItem(wordLists.personNouns)}`,
  () => `${getRandomItem(wordLists.adjectives)} ${getRandomItem(wordLists.objectNouns)}`,

  // Verb actions
  () => `${getRandomItem(wordLists.gymVerbs)} ${getRandomItem(wordLists.objectNouns)}`,

  // Meme adjectives
  () => `${getRandomItem(["Alpha", "Beta", "Sigma"])} ${getRandomItem(wordLists.personNouns)}`,
  () => `${getRandomItem(["Alpha", "Beta"])} ${getRandomItem(wordLists.objectNouns)}`,
  () => `${getRandomItem(["Caffeinated", "Decaf"])} ${getRandomItem(wordLists.personNouns)}`,
  () => `${getRandomItem(["Caffeinated", "Decaf"])} ${getRandomItem(wordLists.objectNouns)}`,

  // Problem enjoyer/hater
  () => `${getRandomItem(wordLists.problemNouns)} ${getRandomItem(["Enjoyer", "Hater", "Advocate"])}`,

  // Ironic titles
  () => `${getRandomItem(wordLists.ironicTitles)} ${getRandomItem(wordLists.problemNouns)}`,
  () => `${getRandomItem(wordLists.ironicTitles)} ${getRandomItem(wordLists.objectNouns)}`,

  // Dual nouns
  () => `${getRandomItem(wordLists.personNouns)} of ${getRandomItem(wordLists.objectNouns)}`,
  () => `${getRandomItem(wordLists.personNouns)} of ${getRandomItem(wordLists.problemNouns)}`,

  // Absurd mashups
  () => `${getRandomItem(wordLists.objectNouns)} ${getRandomItem(wordLists.personSuffixes)}`,
  () => `${getRandomItem(wordLists.personNouns)} ${getRandomItem(wordLists.personSuffixes)}`,

  // // NEW: "Certified" / "Uncertified"
  // () =>
  //   `${getRandomItem(["Certified", "Uncertified"])} ${getRandomItem(wordLists.objectNouns)} ${getRandomItem([
  //     "Enjoyer",
  //     "Specialist",
  //     "Freak",
  //   ])}`,

  // // NEW: "Local" meme
  // () => `Local ${getRandomItem(wordLists.objectNouns)} ${getRandomItem(["Enjoyer", "Goblin", "Hater"])}`,

  // // NEW: "Father of X"
  // () => `Father of ${getRandomItem(wordLists.problemNouns)}`,

  // // NEW: "King of Skipping X"
  // () => `King of Skipping ${getRandomItem(["Leg Day", "Warmup", "Cardio"])}`,
];

// Final generator
export async function generateUniqueUsername(
  fastify: FastifyInstance
): Promise<{ username: string; displayName: string }> {
  if (!fastify.supabase) {
    throw new Error("Supabase client not available");
  }

  while (true) {
    const selectedFormula = getRandomItem(templates);

    const baseDisplayName = selectedFormula();
    const baseUsername = baseDisplayName.replace(/ /g, "").toLowerCase();

    // Batch check to reduce DB roundtrips
    const batchSize = 5;
    const usernameBatch = [baseUsername];
    for (let i = 2; i <= batchSize; i++) {
      usernameBatch.push(`${baseUsername}${i}`);
    }

    const { data: takenProfiles, error } = await fastify.supabase
      .from("profiles")
      .select("username")
      .in("username", usernameBatch);

    if (error) {
      fastify.log.error({ error }, `Error checking batch of usernames.`);
      throw error;
    }

    const takenUsernames = new Set(takenProfiles.map((p) => p.username));

    for (const finalUsername of usernameBatch) {
      if (!takenUsernames.has(finalUsername)) {
        let finalDisplayName = baseDisplayName;
        if (finalUsername !== baseUsername) {
          const numberSuffix = finalUsername.substring(baseUsername.length);
          finalDisplayName = `${baseDisplayName} ${numberSuffix}`;
        }
        return { username: finalUsername, displayName: finalDisplayName };
      }
    }
  }
}

export const rerollUsername = async (
  fastify: FastifyInstance,
  userId: string
): Promise<{ username: string; displayName: string }> => {
  if (!fastify.supabase) {
    throw new Error("Supabase client not available");
  }
  const supabase = fastify.supabase;

  const { username, displayName } = await generateUniqueUsername(fastify);
  const newAvatarUrl = `https://api.dicebear.com/9.x/avataaars-neutral/png?seed=${username}`;

  const profileUpdatePayload: ProfileUpdate = {
    updated_at: new Date().toISOString(),
    username: username,
    display_name: displayName,
    avatar_url: newAvatarUrl,
  };

  const { error: updateProfileError } = await supabase.from("profiles").update(profileUpdatePayload).eq("id", userId);

  if (updateProfileError) {
    fastify.log.error({ profileError: updateProfileError, userId }, "Error rerolling username");
    throw new Error(`Failed to reroll username: ${updateProfileError.message}`);
  }

  fastify.log.info({ userId, newUsername: username }, `[ONBOARD_HELPERS] Username rerolled`);
  return { username, displayName };
};
