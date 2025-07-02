#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

# Load environment variables from .env file
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi


# Variables
PROJECT_ID="aura-fitness-457121"
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

echo "--------------------------------------------------"
echo "Starting Workload Identity Federation Setup for:"
echo "Project ID: $PROJECT_ID"
echo "Service Account: $SERVICE_ACCOUNT_EMAIL"
echo "GitHub Repository: $GITHUB_REPOSITORY"
echo "--------------------------------------------------"

# 1. Enable IAM Service Account Credentials API
echo "Enabling IAM Service Account Credentials API..."
gcloud services enable iamcredentials.googleapis.com --project=$PROJECT_ID

# 2. Create a Workload Identity Pool
echo "Checking for existing Workload Identity Pool..."
if gcloud iam workload-identity-pools describe $POOL_ID --location=$LOCATION --project=$PROJECT_ID &>/dev/null; then
    echo "Workload Identity Pool '$POOL_ID' already exists. Skipping creation."
else
    echo "Creating Workload Identity Pool '$POOL_ID'..."
    gcloud iam workload-identity-pools create $POOL_ID \
        --project=$PROJECT_ID \
        --location=$LOCATION \
        --display-name="GitHub Actions Pool" \
        --description="Pool for authenticating GitHub Actions"
fi

# 3. Get the full ID of the Workload Identity Pool
WORKLOAD_IDENTITY_POOL_ID=$(gcloud iam workload-identity-pools describe $POOL_ID --project=$PROJECT_ID --location=$LOCATION --format='value(name)')
echo "Workload Identity Pool Full ID: $WORKLOAD_IDENTITY_POOL_ID"

# 4. Create a Workload Identity Provider in that pool
echo "Checking for existing Workload Identity Provider..."
if gcloud iam workload-identity-pools providers describe $PROVIDER_ID --workload-identity-pool=$POOL_ID --location=$LOCATION --project=$PROJECT_ID &>/dev/null; then
    echo "Workload Identity Provider '$PROVIDER_ID' already exists. Skipping creation."
else
    echo "Creating OIDC Provider '$PROVIDER_ID'..."
    gcloud iam workload-identity-pools providers create-oidc $PROVIDER_ID \
        --project=$PROJECT_ID \
        --location=$LOCATION \
        --workload-identity-pool=$POOL_ID \
        --display-name="GitHub OIDC Provider" \
        --issuer-uri="https://token.actions.githubusercontent.com" \
        --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository" \
        --attribute-condition="attribute.repository == '${GITHUB_REPOSITORY}'"
fi

# 5. Allow authentications from the Workload Identity Provider to impersonate the Service Account
echo "Binding IAM policy to allow the provider to impersonate the service account..."
gcloud iam service-accounts add-iam-policy-binding $SERVICE_ACCOUNT_EMAIL \
    --project=$PROJECT_ID \
    --role="roles/iam.workloadIdentityUser" \
    --member="principalSet://iam.googleapis.com/${WORKLOAD_IDENTITY_POOL_ID}/attribute.repository/${GITHUB_REPOSITORY}"

echo "--------------------------------------------------"
echo "✅ Workload Identity Federation setup complete."
echo "--------------------------------------------------"

# 6. Construct and display the values needed for GitHub Secrets
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')
WORKLOAD_IDENTITY_PROVIDER_RESOURCE_NAME="projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_ID}/providers/${PROVIDER_ID}"

echo "Please add the following secrets to your GitHub repository settings:"
echo ""
echo "GCP_WORKLOAD_IDENTITY_PROVIDER: ${WORKLOAD_IDENTITY_PROVIDER_RESOURCE_NAME}"
echo "GCP_SERVICE_ACCOUNT_EMAIL: ${SERVICE_ACCOUNT_EMAIL}"
echo ""
echo "--------------------------------------------------"
