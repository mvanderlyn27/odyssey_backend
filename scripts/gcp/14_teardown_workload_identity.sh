#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

# Load environment variables from .env file
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

# Check for required environment variables
if [ -z "$GCP_PROJECT_ID" ]; then
    echo "Error: GCP_PROJECT_ID is not set. Please set it in your .env file."
    exit 1
fi

# Variables
PROJECT_ID=$GCP_PROJECT_ID
SERVICE_ACCOUNT_EMAIL="github-actions-deployer@${PROJECT_ID}.iam.gserviceaccount.com"
POOL_ID="github-actions-pool"
PROVIDER_ID="github-provider"
LOCATION="global"

# Prompt for GitHub repository details
read -p "Enter your GitHub organization or username: " GITHUB_ORG_USERNAME
read -p "Enter your GitHub repository name (e.g., odyssey_backend): " GITHUB_REPO_NAME

if [ -z "$GITHUB_ORG_USERNAME" ] || [ -z "$GITHUB_REPO_NAME" ]; then
    echo "Error: GitHub organization/username and repository name are required."
    exit 1
fi

GITHUB_REPOSITORY="${GITHUB_ORG_USERNAME}/${GITHUB_REPO_NAME}"
WORKLOAD_IDENTITY_POOL_ID=$(gcloud iam workload-identity-pools describe $POOL_ID --project=$PROJECT_ID --location=$LOCATION --format='value(name)')

echo "--------------------------------------------------"
echo "Starting Workload Identity Federation Teardown for:"
echo "Project ID: $PROJECT_ID"
echo "Service Account: $SERVICE_ACCOUNT_EMAIL"
echo "GitHub Repository: $GITHUB_REPOSITORY"
echo "--------------------------------------------------"

# 1. Remove IAM policy binding
echo "Removing IAM policy binding..."
gcloud iam service-accounts remove-iam-policy-binding $SERVICE_ACCOUNT_EMAIL \
    --project=$PROJECT_ID \
    --role="roles/iam.workloadIdentityUser" \
    --member="principalSet://iam.googleapis.com/${WORKLOAD_IDENTITY_POOL_ID}/attribute.repository/${GITHUB_REPOSITORY}" \
    --quiet || echo "Policy binding not found or already removed."

# 2. Delete Workload Identity Provider
echo "Deleting Workload Identity Provider '$PROVIDER_ID'..."
gcloud iam workload-identity-pools providers delete $PROVIDER_ID \
    --project=$PROJECT_ID \
    --location=$LOCATION \
    --workload-identity-pool=$POOL_ID \
    --quiet || echo "Provider '$PROVIDER_ID' not found or already deleted."

# 3. Delete Workload Identity Pool
echo "Deleting Workload Identity Pool '$POOL_ID'..."
gcloud iam workload-identity-pools delete $POOL_ID \
    --project=$PROJECT_ID \
    --location=$LOCATION \
    --quiet || echo "Pool '$POOL_ID' not found or already deleted."

echo "--------------------------------------------------"
echo "✅ Workload Identity Federation teardown complete."
echo "--------------------------------------------------"
