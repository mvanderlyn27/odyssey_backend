#!/bin/bash

# Script to tear down the Staging Cloud Run service for the Odyssey Backend application.

set -e # Exit immediately if a command exits with a non-zero status.
set -u # Treat unset variables as an error when substituting.
set -o pipefail # Return value of a pipeline is the value of the last command to exit with a non-zero status

# --- Configuration ---
PROJECT_ID="aura-fitness-457121"
REGION="us-central1"
CLOUD_RUN_STAGING_SERVICE="odyssey-backend-staging" # As planned

# --- Helper Functions ---
echo_green() {
  echo -e "\033[0;32m$1\033[0m"
}

echo_yellow() {
  echo -e "\033[0;33m$1\033[0m"
}

echo_red() {
  echo -e "\033[0;31m$1\033[0m"
}

# --- Main Logic ---

echo_red "Starting Staging Cloud Run service teardown: '$CLOUD_RUN_STAGING_SERVICE' in project '$PROJECT_ID', region '$REGION'"

# 1. Delete the Staging Cloud Run service
echo_yellow "\nStep 1: Deleting Staging Cloud Run service '$CLOUD_RUN_STAGING_SERVICE'..."
echo_red "WARNING: This action is irreversible."

read -p "Are you sure you want to delete the Cloud Run service '$CLOUD_RUN_STAGING_SERVICE'? (yes/N): " confirmation
if [[ "$confirmation" != "yes" ]]; then
  echo_yellow "Teardown aborted by user."
  exit 0
fi

if gcloud run services describe "$CLOUD_RUN_STAGING_SERVICE" --platform managed --region "$REGION" --project "$PROJECT_ID" &>/dev/null; then
  gcloud run services delete "$CLOUD_RUN_STAGING_SERVICE" \
    --platform=managed \
    --region="$REGION" \
    --project="$PROJECT_ID" \
    --quiet
  echo_green "Cloud Run service '$CLOUD_RUN_STAGING_SERVICE' deleted successfully."
else
  echo_yellow "Cloud Run service '$CLOUD_RUN_STAGING_SERVICE' not found. Skipping deletion."
fi

echo_green "\nStaging Cloud Run service teardown script completed for '$CLOUD_RUN_STAGING_SERVICE'."
