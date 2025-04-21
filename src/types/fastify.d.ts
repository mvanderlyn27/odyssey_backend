import { SupabaseClient, User } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { FastifyRequest, FastifyReply, FastifyInstance as OriginalFastifyInstance } from "fastify";

// Extend Fastify interfaces globally
declare module "fastify" {
  interface FastifyInstance extends OriginalFastifyInstance {
    // Decorator added by src/plugins/gemini.ts
    gemini: GoogleGenerativeAI | null; // Allow null if initialization fails

    // Decorators added by src/plugins/supabaseAuth.ts
    supabase: SupabaseClient | null; // Add Supabase client decorator type
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }

  interface FastifyRequest {
    // Property added by src/plugins/supabaseAuth.ts hook
    user?: User;
  }
}

// This empty export ensures the file is treated as a module.
export {};
