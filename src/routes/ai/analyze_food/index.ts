import { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply, RouteGenericInterface } from "fastify";
import fp from "fastify-plugin";
import { FromSchema } from "json-schema-to-ts";
import { GeminiService } from "../../../services/geminiService";
import { BuildAppOptions } from "../../../app"; // For mockServices type

// Define expected nutritional data structure
const nutritionDataSchema = {
  type: "object",
  properties: {
    calories: { type: "number", description: "Estimated calories" },
    fatGrams: { type: "number", description: "Estimated fat in grams" },
    carbGrams: { type: "number", description: "Estimated carbohydrates in grams" },
    proteinGrams: { type: "number", description: "Estimated protein in grams" },
  },
  required: ["calories", "fatGrams", "carbGrams", "proteinGrams"],
  additionalProperties: false, // Ensure only these properties are present
} as const; // Use 'as const' for stricter type inference with FromSchema

// Type generated from the schema
type NutritionData = FromSchema<typeof nutritionDataSchema>;

// Define the schema for the response
const analyzeFoodResponseSchema = {
  200: {
    description: "Successful analysis, returning nutritional data.",
    ...nutritionDataSchema, // Spread the nutrition data schema here
  },
  400: {
    description: "Bad Request - Missing image, invalid image format, or Gemini failed to return valid JSON.",
    type: "object",
    properties: {
      statusCode: { type: "integer" },
      error: { type: "string" },
      message: { type: "string" },
    },
  },
  401: {
    description: "Unauthorized - Missing or invalid authentication token.",
    type: "object",
    properties: {
      statusCode: { type: "integer" },
      error: { type: "string" },
      message: { type: "string" },
    },
  },
  500: {
    description: "Internal Server Error - Failed to process image or communicate with AI.",
    type: "object",
    properties: {
      error: { type: "string" },
      message: { type: "string" },
    },
  },
};

// Interface for the route, specifying that the body is multipart
interface AnalyzeFoodRoute extends RouteGenericInterface {
  // Body will be handled by multipart plugin, not standard JSON schema
  Reply: NutritionData | { error: string; message: string }; // Define possible reply types
}

// Plugin options interface (similar to chat)
export interface AnalyzeFoodRoutesOptions extends FastifyPluginOptions {
  geminiService?: GeminiService;
  mockServices?: BuildAppOptions["mockServices"];
}

async function analyzeFoodRoutes(fastify: FastifyInstance, opts: AnalyzeFoodRoutesOptions) {
  // Resolve GeminiService instance (similar to chat routes)
  let geminiService: GeminiService | undefined | null = null;
  if (opts.mockServices?.geminiService) {
    fastify.log.info("Using provided mock GeminiService instance via mockServices for analyze_food.");
    geminiService = opts.mockServices.geminiService;
  } else if (opts.geminiService) {
    fastify.log.info("Using provided GeminiService instance via direct options for analyze_food.");
    geminiService = opts.geminiService;
  } else {
    fastify.log.info("Instantiating new GeminiService for analyze_food routes.");
    try {
      geminiService = new GeminiService(fastify);
    } catch (error) {
      fastify.log.error(error, "Failed to instantiate GeminiService in analyzeFoodRoutes.");
      throw new Error("GeminiService instantiation failed for analyze_food.");
    }
  }
  if (!geminiService) {
    fastify.log.error("GeminiService is not available, cannot register analyze_food routes.");
    throw new Error("Cannot register analyze_food routes without a valid GeminiService.");
  }

  // Define the route handler
  fastify.post<AnalyzeFoodRoute>(
    "/", // Path relative to the autoload prefix (/api/ai/analyze_food)
    {
      preHandler: [fastify.authenticate], // Ensure user is authenticated
      schema: {
        description: "Analyzes an uploaded food image to estimate nutritional information.",
        tags: ["AI Analysis"], // Add a new tag or reuse existing
        summary: "Analyze Food Image for Nutrition",
        consumes: ["multipart/form-data"], // Indicate expected request content type
        // Removed schema.body as validation happens in handler for multipart
        response: analyzeFoodResponseSchema,
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const userId = request.user?.id;
      if (!userId) {
        // Should ideally be caught by preHandler, but good practice to check
        return reply.status(401).send({ error: "Unauthorized", message: "User ID not found after authentication." });
      }

      let fileData: Buffer | undefined;
      let mimeType: string | undefined;

      try {
        // Process the uploaded file
        const data = await request.file(); // Use request.file() for single file upload

        if (!data) {
          return reply.status(400).send({ error: "Bad Request", message: "Missing image file in request." });
        }

        // Basic MIME type validation (adjust as needed)
        const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];
        if (!allowedMimeTypes.includes(data.mimetype)) {
          return reply.status(400).send({
            error: "Bad Request",
            message: `Invalid image format. Allowed types: ${allowedMimeTypes.join(", ")}`,
          });
        }

        fileData = await data.toBuffer();
        mimeType = data.mimetype;
        fastify.log.info(
          { userId, filename: data.filename, mimeType: data.mimetype, size: fileData.length },
          "Received image for food analysis"
        );
      } catch (err: any) {
        // Handle errors during file processing (e.g., file too large if limits are set)
        fastify.log.error(err, "Error processing uploaded file");
        return reply.status(400).send({ error: "Bad Request", message: `Error processing file: ${err.message}` });
      }

      // Ensure file data was processed correctly
      if (!fileData || !mimeType) {
        // Should not happen if await request.file() succeeded without error, but belt-and-suspenders
        return reply
          .status(500)
          .send({ error: "Internal Server Error", message: "Failed to read file data after upload." });
      }

      // Construct the prompt for Gemini
      const prompt = `Analyze the food item(s) prominent in this image. Respond ONLY with a valid JSON object containing your best estimate for the total nutritional values for the item(s) shown. The JSON object should strictly follow this format: { "itemName": string, "itemQuantity": number, "itemQuantityUnit": string, "calories": number, "fatGrams": number, "carbGrams": number, "proteinGrams": number }. Do not include any other text, explanations, or markdown formatting.`;

      try {
        // Call the refactored Gemini service method
        const nutritionResult = await geminiService.getNutritionFromPhoto({
          prompt: prompt,
          imageData: { buffer: fileData, mimeType: mimeType },
          // Optionally specify model: modelName: 'gemini-pro-vision' or 'gemini-1.5-flash'
        });

        // No parsing needed here, the service method returns the structured object
        // Validation also happens within the service method's parsing block

        fastify.log.info({ userId, nutritionData: nutritionResult }, "Successfully analyzed food image");
        return reply.status(200).send(nutritionResult); // Send the structured data directly
      } catch (error: any) {
        fastify.log.error({ userId, error: error.message }, "Error during food image analysis call or processing");
        return reply
          .status(500)
          .send({ error: "Internal Server Error", message: error.message || "Failed to analyze image." });
      }
    }
  );
}

export default analyzeFoodRoutes;
