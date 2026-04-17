import { FastifyInstance, FastifyPluginOptions } from "fastify";
import { SmartCreateWorkoutBodySchema, SmartCreateWorkoutBody } from "./smart-create.schemas";
import { createSmartWorkout } from "./smart-create.service";

export default async function (fastify: FastifyInstance, opts: FastifyPluginOptions) {
  fastify.post<{ Body: SmartCreateWorkoutBody }>(
    "/workout",
    {
      schema: {
        body: SmartCreateWorkoutBodySchema,
      },
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const { targetMuscles, equipment, duration, intensity, userId } = request.body;

      if (request.user?.id !== userId) {
        return reply.status(403).send({ error: "Unauthorized" });
      }

      try {
        const result = await createSmartWorkout(fastify, {
          targetMuscles,
          equipment,
          duration,
          intensity,
          userId,
        });
        return reply.send(result);
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(500).send({ error: error.message });
      }
    }
  );
}
