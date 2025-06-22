import { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { PostHog } from "posthog-node";
import config from "../config";

/**
 * This plugin adds a PostHog client to the Fastify instance.
 *
 * @see https://posthog.com/docs/libraries/node
 */
async function posthogPlugin(fastify: FastifyInstance) {
  const { posthogApiKey, posthogHost } = config;

  if (posthogApiKey && posthogHost) {
    const posthog = new PostHog(posthogApiKey, {
      host: posthogHost,
    });
    fastify.decorate("posthog", posthog);

    fastify.addHook("onClose", (instance, done) => {
      if (instance.posthog) {
        instance.posthog.shutdown();
      }
      done();
    });
  } else {
    fastify.log.warn("PostHog API key or host not found, PostHog plugin not initialized.");
  }
}

export default fp(posthogPlugin);
