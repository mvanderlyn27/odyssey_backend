#!/bin/bash

# Script to tear down shared GCP infrastructure for the Odyssey Backend application.
# This includes deleting the Artifact Registry, IAM Service Account, and revoking roles.

set -e # Exit immediately if a command exits with a non-zero status.
set -u # Treat unset variables as an error when substituting.
set -o pipefail # Return value of a pipeline is the value of the last command to exit with a non-zero status

# --- Configuration ---
PROJECT_ID="aura-fitness-457121"
REGION="us-central1"
ARTIFACT_REGISTRY_NAME="odyssey-backend-images" # As planned
SERVICE_ACCOUNT_NAME="github-actions-deployer" # As planned
KEY_FILE_NAME="github-actions-key.json" # Key file that might have been generated

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

echo_red "Starting SHARED infrastructure teardown for project: $PROJECT_ID"
echo_red "WARNING: This is a destructive operation and will remove core components."
echo_red "Ensure that Staging and Production Cloud Run services are already torn down if they depend on these resources."

read -p "Are you absolutely sure you want to tear down the SHARED infrastructure? (yes/N): " confirmation
if [[ "$confirmation" != "yes" ]]; then
  echo_yellow "Teardown aborted by user."
  exit 0
fi

# 1. Delete Service Account Keys (Instruct user, as keys are downloaded)
echo_yellow "\nStep 1: Managing Service Account Keys for '$SERVICE_ACCOUNT_EMAIL'..."
echo_yellow "This script cannot delete keys that were downloaded to local machines (like '$KEY_FILE_NAME')."
echo_yellow "Please ensure you manually delete any downloaded .json key files for this service account ($SERVICE_ACCOUNT_EMAIL) from your local system and from GitHub secrets."
echo_yellow "You can also manage/delete keys from the GCP Console: IAM & Admin > Service Accounts > $SERVICE_ACCOUNT_EMAIL > Keys."
# Optional: List keys to help user identify them
# gcloud iam service-accounts keys list --iam-account="$SERVICE_ACCOUNT_EMAIL" --project="$PROJECT_ID" --managed-by=USER


# 2. Remove IAM Roles from the Service Account
echo_yellow "\nStep 2: Removing IAM roles from Service Account '$SERVICE_ACCOUNT_EMAIL'..."
ROLES=(
  "roles/artifactregistry.writer"
  "roles/run.admin"
  "roles/iam.serviceAccountUser"
)
SA_EXISTS=$(gcloud iam service-accounts describe "$SERVICE_ACCOUNT_EMAIL" --project="$PROJECT_ID" --format="value(name)" 2>/dev/null || echo "")
if [ -n "$SA_EXISTS" ]; then
  for ROLE in "${ROLES[@]}"; do
    echo "Removing $ROLE..."
    # Check if binding exists before trying to remove
    if gcloud projects get-iam-policy "$PROJECT_ID" --flatten="bindings[].members" --format='value(bindings.role)' --filter="bindings.members:serviceAccount:$SERVICE_ACCOUNT_EMAIL AND bindings.role:$ROLE" | grep -q "$ROLE"; then
      gcloud projects remove-iam-policy-binding "$PROJECT_ID" \
        --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
        --role="$ROLE" \
        --condition=None --quiet || echo_yellow "Warning: Failed to remove role $ROLE. It might have already been removed or a condition is present that wasn't specified."
    else
      echo_yellow "Role $ROLE not found for $SERVICE_ACCOUNT_EMAIL or already removed."
    fi
  done
  echo_green "IAM roles removed/checked for Service Account '$SERVICE_ACCOUNT_EMAIL'."
else
  echo_yellow "Service Account '$SERVICE_ACCOUNT_EMAIL' not found. Skipping role removal."
fi


# 3. Delete IAM Service Account
echo_yellow "\nStep 3: Deleting IAM Service Account '$SERVICE_ACCOUNT_NAME'..."
if [ -n "$SA_EXISTS" ]; then
  read -p "Are you sure you want to delete the IAM Service Account '$SERVICE_ACCOUNT_NAME'? (yes/N): " sa_confirmation
  if [[ "$sa_confirmation" == "yes" ]]; then
    gcloud iam service-accounts delete "$SERVICE_ACCOUNT_EMAIL" --project="$PROJECT_ID" --quiet
    echo_green "Service Account '$SERVICE_ACCOUNT_NAME' deleted successfully."
  else
    echo_yellow "Service Account deletion aborted by user."
  fi
else
  echo_yellow "Service Account '$SERVICE_ACCOUNT_NAME' not found. Skipping deletion."
fi


# 4. Delete Artifact Registry Docker Repository
echo_yellow "\nStep 4: Deleting Artifact Registry repository '$ARTIFACT_REGISTRY_NAME' in region '$REGION'..."
echo_red "WARNING: This will delete the repository and all images within it."
if gcloud artifacts repositories describe "$ARTIFACT_REGISTRY_NAME" --location="$REGION" --project="$PROJECT_ID" &>/dev/null; then
  read -p "Are you sure you want to delete the Artifact Registry repository '$ARTIFACT_REGISTRY_NAME' AND ALL ITS IMAGES? (yes/N): " ar_confirmation
  if [[ "$ar_confirmation" == "yes" ]]; then
    gcloud artifacts repositories delete "$ARTIFACT_REGISTRY_NAME" \
      --location="$REGION" \
      --project="$PROJECT_ID" --quiet
    echo_green "Artifact Registry repository '$ARTIFACT_REGISTRY_NAME' deleted successfully."
  else
    echo_yellow "Artifact Registry deletion aborted by user."
  fi
else
  echo_yellow "Artifact Registry repository '$ARTIFACT_REGISTRY_NAME' not found. Skipping deletion."
fi

# Note: Disabling APIs is generally not part of a teardown unless specifically required.
# echo_yellow "\nStep 5: APIs will remain enabled. You can disable them manually in the GCP console if needed."

echo_green "\nShared infrastructure teardown script completed."
echo_yellow "Remember to manually remove any downloaded service account keys and update GitHub secrets."
