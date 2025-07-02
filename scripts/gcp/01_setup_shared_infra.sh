#!/bin/bash

# Script to set up shared GCP infrastructure for the Odyssey Backend application.
# This includes enabling APIs, creating an Artifact Registry, and setting up an IAM Service Account.

set -e # Exit immediately if a command exits with a non-zero status.
set -u # Treat unset variables as an error when substituting.
set -o pipefail # Return value of a pipeline is the value of the last command to exit with a non-zero status

# --- Configuration ---
PROJECT_ID="aura-fitness-457121"
REGION="us-central1"
ARTIFACT_REGISTRY_NAME="odyssey-backend-images" # As planned
SERVICE_ACCOUNT_NAME="github-actions-deployer" # As planned
SERVICE_ACCOUNT_DISPLAY_NAME="GitHub Actions Deployer for Odyssey Backend"
KEY_FILE_NAME="github-actions-key.json" # Output key file

SERVICE_ACCOUNT_EMAIL="${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

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

echo_green "Starting shared infrastructure setup for project: $PROJECT_ID"

# 1. Enable necessary APIs
echo_green "\nStep 1: Enabling necessary GCP APIs..."
gcloud services enable \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  run.googleapis.com \
  iam.googleapis.com \
  --project="$PROJECT_ID" --quiet

echo_green "APIs enabled successfully."

# 2. Create Artifact Registry Docker Repository
echo_green "\nStep 2: Creating Artifact Registry repository '$ARTIFACT_REGISTRY_NAME' in region '$REGION'..."
if gcloud artifacts repositories describe "$ARTIFACT_REGISTRY_NAME" --location="$REGION" --project="$PROJECT_ID" &>/dev/null; then
  echo_yellow "Artifact Registry repository '$ARTIFACT_REGISTRY_NAME' already exists. Skipping creation."
else
  gcloud artifacts repositories create "$ARTIFACT_REGISTRY_NAME" \
    --repository-format=docker \
    --location="$REGION" \
    --description="Docker repository for Odyssey Backend images" \
    --project="$PROJECT_ID" --quiet
  echo_green "Artifact Registry repository '$ARTIFACT_REGISTRY_NAME' created successfully."
fi

# 3. Create IAM Service Account
echo_green "\nStep 3: Creating IAM Service Account '$SERVICE_ACCOUNT_NAME'..."
if gcloud iam service-accounts describe "$SERVICE_ACCOUNT_EMAIL" --project="$PROJECT_ID" &>/dev/null; then
  echo_yellow "Service Account '$SERVICE_ACCOUNT_NAME' already exists. Skipping creation."
else
  gcloud iam service-accounts create "$SERVICE_ACCOUNT_NAME" \
    --display-name="$SERVICE_ACCOUNT_DISPLAY_NAME" \
    --project="$PROJECT_ID" --quiet
  echo_green "Service Account '$SERVICE_ACCOUNT_NAME' created successfully."
fi

# 4. Grant IAM Roles to the Service Account
echo_green "\nStep 4: Granting IAM roles to Service Account '$SERVICE_ACCOUNT_EMAIL'..."

ROLES=(
  "roles/artifactregistry.writer"
  "roles/run.admin"
  "roles/iam.serviceAccountUser"
)

for ROLE in "${ROLES[@]}"; do
  echo "Granting $ROLE..."
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
    --role="$ROLE" \
    --condition=None --quiet # Added --condition=None to avoid issues if a condition is already set
done
echo_green "IAM roles granted successfully."

# 5. Generate a JSON Key for the Service Account
echo_green "\nStep 5: Generating JSON key for Service Account '$SERVICE_ACCOUNT_EMAIL'..."
echo_yellow "This key will be saved as '$KEY_FILE_NAME' in the current directory."
echo_yellow "IMPORTANT: Secure this key file. You will need to copy its JSON content"
echo_yellow "and add it as a GitHub secret named 'GCP_SA_KEY' in your repository settings."

# Check if key file already exists to avoid overwriting without notice
if [ -f "$KEY_FILE_NAME" ]; then
  echo_red "Key file '$KEY_FILE_NAME' already exists. To generate a new key, please remove or rename the existing file and re-run this step/script."
  echo_yellow "Alternatively, you can manually create a new key from the GCP console for the service account."
else
  gcloud iam service-accounts keys create "$KEY_FILE_NAME" \
    --iam-account="$SERVICE_ACCOUNT_EMAIL" \
    --project="$PROJECT_ID"
  echo_green "JSON key file '$KEY_FILE_NAME' created successfully."
  echo_green "Please copy the content of '$KEY_FILE_NAME' and store it as a GitHub secret named 'GCP_SA_KEY'."
fi

echo_green "\nShared infrastructure setup script completed."
echo_yellow "Next steps:"
echo_yellow "1. Ensure '$KEY_FILE_NAME' is secured and its content added to GitHub secrets as 'GCP_SA_KEY'."
echo_yellow "2. You can now run scripts to set up specific environments (staging, production)."
