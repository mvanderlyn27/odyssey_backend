# CI/CD and GCP Infrastructure Setup Guide

This guide outlines the steps to finalize the setup of your CI/CD pipeline for deploying the Fastify API to Google Cloud Run, along with managing the GCP infrastructure using the provided scripts.

## 1. Make Infrastructure Scripts Executable

Before running any of the `gcloud` scripts, you need to make them executable. Open your terminal in the project root directory (`odyssey_backend`) and run:

```bash
chmod +x scripts/gcp/*.sh
```

## 2. Run GCP Infrastructure Setup Scripts

Execute the setup scripts in the following order. These scripts will provision the necessary shared resources and the placeholder Cloud Run services for your staging and production environments.

```bash
./scripts/gcp/01_setup_shared_infra.sh
```
This script will:
*   Enable required GCP APIs.
*   Create a Google Artifact Registry repository named `odyssey-backend-images`.
*   Create an IAM service account named `github-actions-deployer@aura-fitness-457121.iam.gserviceaccount.com`.
*   Grant necessary IAM roles to this service account.
*   Attempt to create a JSON key file named `github-actions-key.json` in the directory where you run the script. **Secure this file if created, as its content might be needed for GitHub secrets if Workload Identity Federation setup encounters issues.**

Then run:
```bash
./scripts/gcp/02_setup_staging_env.sh
```
This script will:
*   Create a Cloud Run service named `odyssey-backend-staging` using a placeholder image.

And finally:
```bash
./scripts/gcp/03_setup_prod_env.sh
```
This script will:
*   Create a Cloud Run service named `odyssey-backend-prod` using a placeholder image.

## 3. Set Up Workload Identity Federation (Recommended)

Workload Identity Federation allows GitHub Actions to securely authenticate to Google Cloud without needing long-lived service account keys. The following script automates this entire process.

```bash
./scripts/gcp/04_setup_workload_identity.sh
```

This script will:
*   Prompt you for your GitHub organization/username and repository name.
*   Enable the necessary IAM Credentials API.
*   Create a Workload Identity Pool named `github-actions-pool`.
*   Create an OIDC Provider in the pool configured for your GitHub repository.
*   Grant the `github-actions-deployer` service account the `Workload Identity User` role, allowing it to be impersonated by GitHub Actions.
*   Output the exact values you need to set as GitHub secrets.

## 4. Set Up GitHub Secrets

Navigate to your `odyssey_backend` GitHub repository > **Settings** > **Secrets and variables** > **Actions**. Click **New repository secret** for each:

*   `GCP_PROJECT_ID`: `aura-fitness-457121`
*   `GCP_REGION`: `us-central1`
*   `GCP_ARTIFACT_REGISTRY_REPO_NAME`: `odyssey-backend-images`
*   `CLOUD_RUN_SERVICE_STAGING`: `odyssey-backend-staging`
*   `CLOUD_RUN_SERVICE_PROD`: `odyssey-backend-prod`

*   **Application-Specific Secrets (Example):**
    *   `STAGING_SUPABASE_URL`: (Your Supabase URL for staging)
    *   `STAGING_SUPABASE_ANON_KEY`: (Your Supabase anon key for staging)
    *   `STAGING_GEMINI_API_KEY`: (Your Gemini API key for staging)
    *   `PROD_SUPABASE_URL`: (Your Supabase URL for production)
    *   `PROD_SUPABASE_ANON_KEY`: (Your Supabase anon key for production)
    *   `PROD_GEMINI_API_KEY`: (Your Gemini API key for production)
    *   *(Add any other environment variables your application needs for each environment)*

*   **Workload Identity Federation Secrets:**
    *   `GCP_WORKLOAD_IDENTITY_PROVIDER`: The value for this is printed at the end of the `./scripts/gcp/04_setup_workload_identity.sh` script.
    *   `GCP_SERVICE_ACCOUNT_EMAIL`: `github-actions-deployer@aura-fitness-457121.iam.gserviceaccount.com`

*   **(Alternative - If NOT using Workload Identity Federation - Less Secure):**
    *   If you are unable to set up Workload Identity Federation, you would uncomment the `credentials_json` lines and comment out the `workload_identity_provider` lines in the `.github/workflows/deploy.yml` file.
    *   Then, create this secret:
        *   `GCP_SA_KEY`: The entire JSON content of the `github-actions-key.json` file generated by `./scripts/gcp/01_setup_shared_infra.sh`. **Handle this secret with extreme care as it's a long-lived credential.**

## 5. Commit and Push Changes

Commit all the new files (`scripts/gcp/*.sh` and `.github/workflows/deploy.yml`, and this `docs/CI_CD_Setup_Guide.md`) to your GitHub repository:

```bash
git add scripts/gcp/
git add .github/workflows/
git add docs/CI_CD_Setup_Guide.md
git commit -m "feat: Add GCP infrastructure scripts and GitHub Actions CI/CD workflow"
git push
```

Once pushed, pushes to your `staging` and `main` branches should automatically trigger the build and deployment process. You can monitor the workflow runs under the "Actions" tab in your GitHub repository.

## 6. Teardown (If Needed)

To remove the GCP resources created by these scripts, run the teardown scripts in reverse order of dependency (services first, then shared infra, then workload identity):

```bash
./scripts/gcp/11_teardown_staging_env.sh
./scripts/gcp/12_teardown_prod_env.sh
./scripts/gcp/14_teardown_workload_identity.sh
./scripts/gcp/13_teardown_shared_infra.sh
```
Each script will ask for confirmation before deleting resources. Note that the `13_teardown_shared_infra.sh` script is run last as it deletes the service account that the workload identity federation depends on.

This completes the setup guide. Your CI/CD pipeline should now be operational.
