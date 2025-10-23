# Logging Refactor and Best Practices Guide

This document outlines the plan to refactor our logging implementation to ensure consistency, clarity, and utility.

## 1. Guiding Principles

-   **Consistency**: Logs should follow a consistent format and structure across all modules.
-   **Clarity**: Log messages should be easy to understand and provide meaningful information.
-   **Utility**: Logs should be useful for debugging, monitoring, and analytics.

## 2. Standardized Log Levels

-   **`INFO`**: For high-level, informational messages that are useful for tracking the application's lifecycle.
-   **`DEBUG`**: For detailed, verbose information that is useful for debugging.
-   **`WARN`**: For potential issues that do not prevent the application from functioning but should be investigated.
-   **`ERROR`**: For critical errors that prevent the application from functioning as expected.

## 3. Contextual Logging

All logs should include the following contextual information:

-   `module`: The name of the module where the log originated (e.g., "onboard", "rank-calculator").
-   `userId`: The ID of the user who initiated the request.
-   `sessionId`: The ID of the current session, if applicable.
-   `requestId`: A unique identifier for each request.

## 4. Refactoring Plan

The refactoring process will be carried out in the following steps:

1.  **Review and Update Log Levels**: Audit all existing log statements to ensure they are using the appropriate log level.
2.  **Enrich Logs with Context**: Add the required contextual information to all log statements.
3.  **Remove Redundant Logs**: Identify and remove any unnecessary or duplicate log entries.
4.  **Promote Structured Logging**: Convert all log messages to a structured format.

## 5. Implementation Details

The refactoring will be implemented on a module-by-module basis.

### `src/modules/onboard` (Status: Completed)

-   All log statements have been updated to include the `module: "onboard"` property and other relevant context.
-   Log messages have been standardized.

### `src/modules/rank-calculator` (Status: Completed)

-   All log statements have been updated to include the `module: "rank-calculator"` property and other relevant context.
-   Log messages have been standardized.

### `src/modules/workout-sessions` (Status: Pending)

-   **`workout-sessions.cycle.ts`**:
    -   Change `fastify.log.error` to include a structured object with `error`, `userId`, and `sessionPlanId`.
    -   Add `userId` and `planId` to the `INFO` log.
-   **`workout-sessions.data.ts`**:
    -   Change `fastify.log.error` to include a structured object with `userId` and `error`.
    -   Change `fastify.log.debug` to include `userId` where it's missing.
-   **`workout-sessions.feed.ts`**:
    -   Change `fastify.log.error` to include a structured object with `error`, `userId`, and `sessionId`.
    -   Add `userId` and `sessionId` to the `INFO` log.
-   **`workout-sessions.lastWorked.ts`**:
    -   Change `fastify.log.error` to include a structured object with `error`, `userId`, and `sessionId`.
    -   Add `userId` and `sessionId` to the `INFO` log.
-   **`workout-sessions.notes.ts`**:
    -   Change `fastify.log.error` to include a structured object with `error` and `workoutSessionId`.
    -   Add `userId` and `workoutSessionId` to the `INFO` log.
-   **`workout-sessions.notifications.ts`**:
    -   Change `fastify.log.error` to include a structured object with `error`, `userId`, and `workoutSessionId`.
    -   Add `userId` and `sessionId` to the `INFO` log.
-   **`workout-sessions.progression.ts`**:
    -   Change `fastify.log.error` to include a structured object with `error` and `workoutPlanDayId`.
    -   Add `workoutPlanDayId` to the `INFO` log.
-   **`workout-sessions.prs.ts`**:
    -   Change `fastify.log.error` to include a structured object with `error` and `userId`.
    -   Add `userId` to the `INFO` log.
-   **`workout-sessions.ranking.ts`**:
    -   Change `fastify.log.error` to include a structured object with `error` and `userId`.
    -   Add `userId` to the `INFO` log.
-   **`workout-sessions.routes.ts`**:
    -   Change `fastify.log.error` to include a structured object with the error and a message.
-   **`workout-sessions.service.ts`**:
    -   Change `fastify.log.error` to include structured objects with context.
    -   Add `userId` to `INFO` logs.
-   **`workout-sessions.xp.ts`**:
    -   Change `fastify.log.error` to include a structured object with `error`, `userId`, and `awardedXp`.
    -   Add `userId` to the `INFO` log.

### `src/shared` (Status: Pending)

-   **`prs/prs.service.ts`**:
    -   Change `fastify.log.error` to include a structured object with `error` and `userId`.
    -   Add `userId` to the `INFO` log.
-   **`ranking/ranking.helpers.ts`**:
    -   Change `fastify.log.error` to include a structured object with `error`.
    -   Add context to the `DEBUG` log.
-   **`ranking/ranking.service.ts`**:
    -   Change `fastify.log.error` to include a structured object with `error`, `userId`, and `source`.
    -   Add `userId` and `source` to the `INFO` log.
