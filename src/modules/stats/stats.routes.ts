// import { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from "fastify";
// import fp from "fastify-plugin";
// import { getExerciseStats, getSessionStats, getUserStats, getBodyStats, getMuscleStats } from "./stats.service";
// // Import TypeBox schemas and types
// import {
//   type GetExerciseStatsParams,
//   type GetExerciseStatsQuery,
//   type ExerciseStats,
//   type GetSessionStatsParams,
//   type SessionStats,
//   type GetUserStatsQuery,
//   type UserStats,
//   type GetBodyStatsQuery,
//   type BodyStats,
//   type GetMuscleStatsParams,
//   type GetMuscleStatsQuery,
//   type MuscleStats,
// } from "../../schemas/statsSchemas";
// // Import common schema types
// import { type ErrorResponse } from "../../schemas/commonSchemas";

// /**
//  * Encapsulates the routes for the Stats module.
//  * @param {FastifyInstance} fastify - Fastify instance.
//  * @param {FastifyPluginOptions} options - Plugin options.
//  */
// async function statsRoutes(fastify: FastifyInstance, options: FastifyPluginOptions): Promise<void> {
//   // --- GET /exercise/{id} ---
//   fastify.get<{
//     Params: GetExerciseStatsParams;
//     Querystring: GetExerciseStatsQuery;
//     Reply: ExerciseStats | ErrorResponse;
//   }>("/exercise/:id", {
//     preHandler: [fastify.authenticate],
//     schema: {
//       description: "Get performance statistics for a specific exercise for the user.",
//       tags: ["Stats"],
//       summary: "Get exercise stats",
//       security: [{ bearerAuth: [] }],
//       params: { $ref: "UuidParamsSchema#" }, // Re-uses common UuidParamsSchema
//       querystring: { $ref: "GetExerciseStatsQuerySchema#" },
//       response: {
//         200: { $ref: "ExerciseStatsSchema#" },
//         401: { $ref: "ErrorResponseSchema#" },
//         404: { $ref: "ErrorResponseSchema#" },
//         500: { $ref: "ErrorResponseSchema#" },
//       },
//     },
//     handler: async (
//       request: FastifyRequest<{ Params: GetExerciseStatsParams; Querystring: GetExerciseStatsQuery }>,
//       reply: FastifyReply
//     ) => {
//       const userId = request.user?.id;
//       const { id: exerciseId } = request.params;
//       // Provide default values if query params are optional in schema but required by service
//       const timePeriod = request.query.timePeriod ?? "all";
//       const grouping = request.query.grouping ?? "all"; // Assuming 'all' is a valid default if not grouped

//       if (!userId) {
//         return reply.code(401).send({ error: "Unauthorized", message: "User not authenticated." });
//       }
//       try {
//         // Call service with all required arguments
//         const stats = await getExerciseStats(fastify, userId, exerciseId, timePeriod, grouping);
//         return reply.send(stats);
//       } catch (error: any) {
//         fastify.log.error(error, `Failed getting stats for exercise ${exerciseId}`);
//         if (error.message.includes("not found")) {
//           return reply.code(404).send({ error: "Not Found", message: error.message });
//         }
//         return reply.code(500).send({ error: "Internal Server Error", message: "Failed to retrieve exercise stats." });
//       }
//     },
//   });

//   // --- GET /session/{id} ---
//   fastify.get<{ Params: GetSessionStatsParams; Reply: SessionStats | ErrorResponse }>("/session/:id", {
//     preHandler: [fastify.authenticate],
//     schema: {
//       description: "Get aggregated statistics for a completed workout session.",
//       tags: ["Stats"],
//       summary: "Get session stats",
//       security: [{ bearerAuth: [] }],
//       params: { $ref: "UuidParamsSchema#" }, // Re-uses common UuidParamsSchema
//       response: {
//         200: { $ref: "SessionStatsSchema#" },
//         401: { $ref: "ErrorResponseSchema#" },
//         404: { $ref: "ErrorResponseSchema#" },
//         500: { $ref: "ErrorResponseSchema#" },
//       },
//     },
//     handler: async (request: FastifyRequest<{ Params: GetSessionStatsParams }>, reply: FastifyReply) => {
//       // Note: Service function getSessionStats only needs sessionId, userId is implicit via auth/RLS
//       const { id: sessionId } = request.params;
//       // We still need userId for logging/potential checks, though service might not use it directly
//       const userId = request.user?.id;
//       if (!userId) {
//         return reply.code(401).send({ error: "Unauthorized", message: "User not authenticated." });
//       }

//       try {
//         // Call service with only sessionId as per its signature
//         const stats = await getSessionStats(fastify, sessionId);
//         // Service should throw if not found or not owned by user (due to RLS/query logic)
//         return reply.send(stats);
//       } catch (error: any) {
//         fastify.log.error(error, `Failed getting stats for session ${sessionId}`);
//         if (error.message.includes("not found")) {
//           return reply.code(404).send({ error: "Not Found", message: error.message });
//         }
//         return reply.code(500).send({ error: "Internal Server Error", message: "Failed to retrieve session stats." });
//       }
//     },
//   });

//   // --- GET /user ---
//   fastify.get<{ Querystring: GetUserStatsQuery; Reply: UserStats | ErrorResponse }>("/user", {
//     preHandler: [fastify.authenticate],
//     schema: {
//       description: "Get overall user performance statistics.",
//       tags: ["Stats"],
//       summary: "Get user stats",
//       security: [{ bearerAuth: [] }],
//       querystring: { $ref: "GetUserStatsQuerySchema#" },
//       response: {
//         200: { $ref: "UserStatsSchema#" },
//         401: { $ref: "ErrorResponseSchema#" },
//         500: { $ref: "ErrorResponseSchema#" },
//       },
//     },
//     handler: async (request: FastifyRequest<{ Querystring: GetUserStatsQuery }>, reply: FastifyReply) => {
//       const userId = request.user?.id;
//       // Provide defaults for service function
//       const timePeriod = request.query.timePeriod ?? "all";
//       const grouping = request.query.grouping ?? "all";

//       if (!userId) {
//         return reply.code(401).send({ error: "Unauthorized", message: "User not authenticated." });
//       }
//       try {
//         // Call service with all required arguments
//         const stats = await getUserStats(fastify, userId, timePeriod, grouping);
//         return reply.send(stats);
//       } catch (error: any) {
//         fastify.log.error(error, "Failed getting user stats");
//         return reply.code(500).send({ error: "Internal Server Error", message: "Failed to retrieve user stats." });
//       }
//     },
//   });

//   // --- GET /body ---
//   fastify.get<{ Querystring: GetBodyStatsQuery; Reply: BodyStats | ErrorResponse }>("/body", {
//     preHandler: [fastify.authenticate],
//     schema: {
//       description: "Get statistics related to body measurements and muscle groups.",
//       tags: ["Stats"],
//       summary: "Get body stats",
//       security: [{ bearerAuth: [] }],
//       querystring: { $ref: "GetBodyStatsQuerySchema#" }, // Note: timePeriod from query isn't used by current service logic
//       response: {
//         200: { $ref: "BodyStatsSchema#" },
//         401: { $ref: "ErrorResponseSchema#" },
//         500: { $ref: "ErrorResponseSchema#" },
//       },
//     },
//     handler: async (request: FastifyRequest<{ Querystring: GetBodyStatsQuery }>, reply: FastifyReply) => {
//       const userId = request.user?.id;
//       if (!userId) {
//         return reply.code(401).send({ error: "Unauthorized", message: "User not authenticated." });
//       }
//       try {
//         // Call service with only userId as per its signature
//         const stats = await getBodyStats(fastify, userId);
//         return reply.send(stats);
//       } catch (error: any) {
//         fastify.log.error(error, "Failed getting body stats");
//         return reply.code(500).send({ error: "Internal Server Error", message: "Failed to retrieve body stats." });
//       }
//     },
//   });

//   // --- GET /muscle/{muscleGroupName} ---
//   fastify.get<{ Params: GetMuscleStatsParams; Querystring: GetMuscleStatsQuery; Reply: MuscleStats | ErrorResponse }>(
//     "/muscle/:muscleGroupName",
//     {
//       preHandler: [fastify.authenticate],
//       schema: {
//         description: "Get performance statistics aggregated by primary muscle group.",
//         tags: ["Stats"],
//         summary: "Get muscle group stats",
//         security: [{ bearerAuth: [] }],
//         params: { $ref: "GetMuscleStatsParamsSchema#" },
//         querystring: { $ref: "GetMuscleStatsQuerySchema#" },
//         response: {
//           200: { $ref: "MuscleStatsSchema#" },
//           401: { $ref: "ErrorResponseSchema#" },
//           404: { $ref: "ErrorResponseSchema#" }, // If muscle group name is invalid
//           500: { $ref: "ErrorResponseSchema#" },
//         },
//       },
//       handler: async (
//         request: FastifyRequest<{ Params: GetMuscleStatsParams; Querystring: GetMuscleStatsQuery }>,
//         reply: FastifyReply
//       ) => {
//         const userId = request.user?.id;
//         const { muscleGroupName } = request.params;
//         // Provide default for timePeriod
//         const timePeriod = request.query.timePeriod ?? "all";

//         if (!userId) {
//           return reply.code(401).send({ error: "Unauthorized", message: "User not authenticated." });
//         }
//         try {
//           // Call service with all required arguments
//           const stats = await getMuscleStats(fastify, userId, muscleGroupName, timePeriod);
//           // Service should throw if muscle group not found
//           return reply.send(stats);
//         } catch (error: any) {
//           fastify.log.error(error, `Failed getting stats for muscle group ${muscleGroupName}`);
//           if (error.message.includes("not found")) {
//             // Check for specific error from service
//             return reply.code(404).send({ error: "Not Found", message: error.message });
//           }
//           return reply.code(500).send({ error: "Internal Server Error", message: "Failed to retrieve muscle stats." });
//         }
//       },
//     }
//   );
// }

// export default statsRoutes;
