#!/bin/bash

# Script to set up the Production Cloud Run service for the Odyssey Backend application.

set -e # Exit immediately if a command exits with a non-zero status.
set -u # Treat unset variables as an error when substituting.
set -o pipefail # Return value of a pipeline is the value of the last command to exit with a non-zero status

# --- Configuration ---
PROJECT_ID="aura-fitness-457121"
REGION="us-central1"
CLOUD_RUN_PROD_SERVICE="odyssey-backend-prod" # As planned
# Using a small, universally available placeholder image for initial service creation.
# The actual application image will be deployed by the CI/CD pipeline.
PLACEHOLDER_IMAGE="gcr.io/google-containers/pause"
# The service account the Cloud Run service will run as.
# RUN_AS_SERVICE_ACCOUNT_EMAIL="${PROJECT_ID}@appspot.gserviceaccount.com" # Example: Default App Engine SA
# Or, if you created a dedicated SA for Cloud Run services:
# RUN_AS_SERVICE_ACCOUNT_EMAIL="your-cloud-run-runtime-sa@${PROJECT_ID}.iam.gserviceaccount.com"

# --- Helper Functions ---
echo_green() {
  echo -e "\033[0;32m$1\033[0m"
}

echo_yellow() {
  echo -e "\033[0;33m$1\033[0m"
}

# --- Main Logic ---

echo_green "Starting Production Cloud Run service setup: '$CLOUD_RUN_PROD_SERVICE' in project '$PROJECT_ID', region '$REGION'"

# 1. Deploy a placeholder Cloud Run service for Production
echo_green "\nStep 1: Deploying placeholder Production Cloud Run service '$CLOUD_RUN_PROD_SERVICE'..."
echo_yellow "This will create the service with a basic image. The actual application will be deployed via GitHub Actions."

# Check if the service already exists
if gcloud run services describe "$CLOUD_RUN_PROD_SERVICE" --platform managed --region "$REGION" --project "$PROJECT_ID" &>/dev/null; then
  echo_yellow "Cloud Run service '$CLOUD_RUN_PROD_SERVICE' already exists. Skipping initial creation."
  echo_yellow "The GitHub Actions workflow will update this service with the application image and environment variables."
else
  gcloud run deploy "$CLOUD_RUN_PROD_SERVICE" \
    --image="$PLACEHOLDER_IMAGE" \
    --platform=managed \
    --region="$REGION" \
    --project="$PROJECT_ID" \
    --allow-unauthenticated \
    --port=8080 `# Default port, will be overridden by PORT env var from your app` \
    `# --service-account="$RUN_AS_SERVICE_ACCOUNT_EMAIL" # Uncomment and set if you want to specify a runtime service account` \
    --quiet
  echo_green "Placeholder Production Cloud Run service '$CLOUD_RUN_PROD_SERVICE' deployed successfully."
  echo_yellow "It is currently running a placeholder image. GitHub Actions will deploy your application to it."
fi

echo_green "\nProduction Cloud Run service setup script completed for '$CLOUD_RUN_PROD_SERVICE'."
echo_yellow "The service is ready to be updated by the GitHub Actions deployment workflow for the 'main' branch."
