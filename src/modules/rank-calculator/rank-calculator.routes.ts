import { FastifyInstance } from "fastify";
import { Static, Type } from "@sinclair/typebox";
import { calculateRankForEntry, InsufficientBalanceError } from "./rank-calculator.service";

const RankEntrySchema = Type.Object({
  exercise_id: Type.String({ format: "uuid" }),
  weight: Type.Number(),
  reps: Type.Number(),
});

export type RankEntryType = Static<typeof RankEntrySchema>;

export default async function (fastify: FastifyInstance) {
  fastify.post<{ Body: RankEntryType }>(
    "/",
    {
      schema: {
        body: RankEntrySchema,
        // TODO: Add response schema
      },
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      if (!request.user) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      const userId = request.user.id;
      const entry = request.body;

      try {
        const result = await calculateRankForEntry(fastify, userId, entry);
        return reply.send(result);
      } catch (error) {
        if (error instanceof InsufficientBalanceError) {
          return reply.status(403).send({ error: error.message });
        }
        fastify.log.error({ module: "rank-calculator", error, userId }, `Error calculating rank for user ${userId}`);
        return reply.status(500).send({ error: "Internal Server Error" });
      }
    }
  );
}
