import { SupabaseClient, User } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { FastifyRequest, FastifyReply } from "fastify"; // Import base types

// Extend Fastify interfaces globally
declare module "fastify" {
  interface FastifyInstance {
    // Decorator added by src/plugins/gemini.ts
    gemini: GoogleGenerativeAI;
    // Decorator added by src/plugins/supabaseAuth.ts
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }

  interface FastifyRequest {
    // Property added by src/plugins/supabaseAuth.ts hook
    user?: User;
    // Property added by src/plugins/supabaseAuth.ts hook
    supabase?: SupabaseClient;
  }
}

// This empty export ensures the file is treated as a module.
export {};
