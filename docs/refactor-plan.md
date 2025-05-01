# Refactoring Plan: Centralized TypeBox Schemas

This document tracks the progress of refactoring the API routes to use centralized TypeBox schemas for improved structure, maintainability, and type safety.

**Legend:**
- [ ] To Do
- [x] Done

## 1. Setup

- [ ] Create `docs/refactor-plan.md` (This file).
- [ ] Install dependencies: `@fastify/type-provider-typebox`, `@sinclair/typebox`.
- [ ] Configure Fastify instance in `src/app.ts` to use `TypeBoxTypeProvider`.
- [ ] Create `src/schemas/` directory.
- [ ] Define common schemas (`ErrorResponseSchema`, `UuidParamsSchema`, etc.) in `src/schemas/commonSchemas.ts`.
- [ ] Register common schemas in `src/app.ts`.

## 2. Module Refactoring (Iterative)

- [x] **ai-coach-messages:**
    - [x] Define schemas in `src/schemas/aiCoachMessagesSchemas.ts`.
    - [x] Register schemas in `src/app.ts`.
    - [x] Refactor `src/modules/ai-coach-messages/ai-coach-messages.routes.ts`.
- [x] **body-measurements:**
    - [x] Define schemas in `src/schemas/bodyMeasurementsSchemas.ts`.
    - [x] Register schemas in `src/app.ts`.
    - [x] Refactor `src/modules/body-measurements/body-measurements.routes.ts`.
- [x] **equipment:**
    - [x] Define schemas in `src/schemas/equipmentSchemas.ts`. // Already existed
    - [x] Register schemas in `src/app.ts`. // Already registered
    - [x] Refactor `src/modules/equipment/equipment.routes.ts`.
- [x] **exercises:**
    - [x] Define schemas in `src/schemas/exercisesSchemas.ts`.
    - [x] Register schemas in `src/app.ts`.
    - [x] Refactor `src/modules/exercises/exercises.routes.ts`.
- [x] **onboarding:**
    - [x] Define schemas in `src/schemas/onboardingSchemas.ts`.
    - [x] Register schemas in `src/app.ts`.
    - [x] Refactor `src/modules/onboarding/onboarding.routes.ts`.
- [x] **profile:**
    - [x] Define schemas in `src/schemas/profileSchemas.ts`.
    - [x] Register schemas in `src/app.ts`.
    - [x] Refactor `src/modules/profile/profile.routes.ts`.
- [x] **stats:**
    - [x] Define schemas in `src/schemas/statsSchemas.ts`.
    - [x] Register schemas in `src/app.ts`.
    - [x] Refactor `src/modules/stats/stats.routes.ts`.
- [x] **streaks:**
    - [x] Define schemas in `src/schemas/streaksSchemas.ts`.
    - [x] Register schemas in `src/app.ts`.
    - [x] Refactor `src/modules/streaks/streaks.routes.ts`.
- [x] **user-goals:**
    - [x] Define schemas in `src/schemas/userGoalsSchemas.ts`.
    - [x] Register schemas in `src/app.ts`.
    - [x] Refactor `src/modules/user-goals/user-goals.routes.ts`.
- [x] **workout-plans:**
    - [x] Define schemas in `src/schemas/workoutPlansSchemas.ts`.
    - [x] Register schemas in `src/app.ts`.
    - [x] Refactor `src/modules/workout-plans/workout-plans.routes.ts`.
- [x] **workout-sessions:**
    - [x] Define schemas in `src/schemas/workoutSessionsSchemas.ts`.
    - [x] Register schemas in `src/app.ts`.
    - [x] Refactor `src/modules/workout-sessions/workout-sessions.routes.ts`.

## 3. Cleanup

- [x] Review `src/modules/**/*.types.ts` and `src/types/*.ts` files.
- [x] Remove redundant type definitions now covered by TypeBox schemas.
