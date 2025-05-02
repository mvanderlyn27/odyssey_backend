import { Type, Static } from "@sinclair/typebox";

// Define reusable enums if they aren't defined centrally
const GoalTypeEnum = Type.Union(
  [
    Type.Literal("lose_weight"),
    Type.Literal("gain_muscle"),
    Type.Literal("maintain"),
    Type.Literal("improve_strength"),
    Type.Literal("improve_endurance"),
    Type.Literal("general_fitness"),
    // Add other goal types as needed
  ],
  { $id: "GoalTypeEnum", description: "Type of fitness goal" }
);
export type GoalType = Static<typeof GoalTypeEnum>; // Export static type

// Base UserGoal Schema reflecting the database structure
export const UserGoalSchema = Type.Object(
  {
    id: Type.String({ format: "uuid" }),
    user_id: Type.String({ format: "uuid" }),
    goal_type: Type.Union([GoalTypeEnum, Type.Null()]), // Allow null based on DB
    target_weight_kg: Type.Union([Type.Number(), Type.Null()]),
    target_muscle_kg: Type.Union([Type.Number(), Type.Null()]), // Assuming this is target muscle gain
    start_date: Type.Union([Type.String({ format: "date" }), Type.Null()]), // Changed format to date
    target_date: Type.Union([Type.String({ format: "date" }), Type.Null()]), // Changed format to date
    estimated_completion_date: Type.Union([Type.String({ format: "date" }), Type.Null()]), // Changed format to date
    is_active: Type.Union([Type.Boolean(), Type.Null()]), // Allow null based on DB
    created_at: Type.String({ format: "date-time" }),
  },
  { $id: "UserGoalSchema", description: "User fitness goal data" }
);
export type UserGoal = Static<typeof UserGoalSchema>;

// Schema for the POST /goals request body
export const CreateUserGoalBodySchema = Type.Object(
  {
    goal_type: GoalTypeEnum, // Make goal_type required for creation
    target_weight_kg: Type.Optional(Type.Number()),
    target_muscle_kg: Type.Optional(Type.Number()),
    target_date: Type.Optional(Type.String({ format: "date" })),
    // start_date is likely set by the backend
  },
  { $id: "CreateUserGoalBodySchema", description: "Request body for creating a new user goal" }
);
export type CreateUserGoalBody = Static<typeof CreateUserGoalBodySchema>;
// Response for POST uses UserGoalSchema

// Schema for the GET /goals/current response
export const GetCurrentGoalResponseSchema = Type.Union([Type.Ref(UserGoalSchema), Type.Null()], {
  $id: "GetCurrentGoalResponseSchema",
  description: "The user's currently active goal, or null if none is active",
});
export type GetCurrentGoalResponse = Static<typeof GetCurrentGoalResponseSchema>;

// Schema for the GET /goals/history response
export const GetGoalHistoryResponseSchema = Type.Array(Type.Ref(UserGoalSchema), {
  $id: "GetGoalHistoryResponseSchema",
  description: "List of the user's past fitness goals",
});
export type GetGoalHistoryResponse = Static<typeof GetGoalHistoryResponseSchema>;
