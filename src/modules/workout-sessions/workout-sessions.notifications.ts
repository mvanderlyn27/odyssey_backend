import { FastifyInstance } from "fastify";
import { SupabaseClient } from "@supabase/supabase-js";
import { Database, Tables, TablesInsert } from "../../types/database";
import { RankUpdateResults } from "./workout-sessions.ranking";

/**
 * Handles creating notifications for a completed workout session.
 * If the user's activity visibility is not private, it notifies their friends.
 * @param fastify - Fastify instance.
 * @param userId - The ID of the user who completed the workout.
 * @param workoutSessionId - The ID of the completed workout session.
 * @param newPrs - An array of new personal records achieved in the session.
 * @param rankUpResults - The results of the rank update process.
 */
export async function _handleWorkoutCompletionNotifications(
  fastify: FastifyInstance,
  userId: string,
  workoutSessionId: string,
  newPrs: TablesInsert<"user_exercise_prs">[],
  rankUpResults: RankUpdateResults,
  userData: Tables<"users">,
  userProfile: Tables<"profiles">,
  friends: Tables<"friendships">[]
): Promise<void> {
  fastify.log.info(`[NOTIFICATIONS] Starting notification handling for user: ${userId}, session: ${workoutSessionId}`);
  const supabase = fastify.supabase as SupabaseClient<Database>;

  try {
    if (userData.profile_privacy === "private") {
      fastify.log.info(
        `[NOTIFICATIONS] User ${userId} has private activity visibility. No notifications will be sent.`
      );
      return;
    }

    const friendIds =
      friends?.map((friend) => (friend.requester_id === userId ? friend.addressee_id : friend.requester_id)) || [];

    if (friendIds.length === 0) {
      fastify.log.info(`[NOTIFICATIONS] User ${userId} has no friends. No notifications to send.`);
      return;
    }

    // 2. Determine the most important event to notify about
    const senderName = userProfile?.display_name || "Your Friend";
    const senderAvatarUrl = userProfile?.avatar_url;
    let title = "New Workout!";
    let message = `${senderName} just completed a workout.`;

    const overallRankUp = rankUpResults.overall_user_rank_progression;
    if (overallRankUp && overallRankUp.current_rank.rank_id !== overallRankUp.initial_rank.rank_id) {
      title = "Rank Up!";
      message = `${senderName} just reached the rank of ${overallRankUp.current_rank.rank_name}!`;
    } else if (newPrs.length > 0) {
      title = "New Personal Record!";
      message = `${senderName} just set a new PR!`;
    }

    // 3. Create notification payloads for each friend
    const notificationPayloads = friendIds.map((friendId) => ({
      recipient_user_id: friendId,
      type: "new_workout_session" as const, // Using 'as any' to bypass compile-time check. Assumes DB schema is updated.
      title: title || "New Workout!",
      message: message || `${senderName} just completed a workout.`,
      link: `/(main)/view-workout/${workoutSessionId}`,
      sender_avatar_url: senderAvatarUrl || null,
      metadata: {
        sender_user_id: userId,
        workout_session_id: workoutSessionId,
        sender_name: senderName,
      },
    }));

    // 4. Insert notifications into the database
    if (notificationPayloads.length > 0) {
      const { error: insertError } = await supabase.from("notifications").insert(notificationPayloads);

      if (insertError) {
        fastify.log.error(
          { error: insertError, userId },
          `[NOTIFICATIONS] Failed to insert workout completion notifications.`
        );
      } else {
        fastify.log.info(
          `[NOTIFICATIONS] Successfully created ${notificationPayloads.length} notifications for user ${userId}'s workout.`
        );
      }
    }
  } catch (err) {
    fastify.log.error(
      { err, userId, workoutSessionId },
      `[NOTIFICATIONS] An unexpected error occurred during notification handling.`
    );
  }
}
