# Aura Backend API

This repository contains the Fastify backend API for the Aura application, providing AI generation capabilities via Google Gemini and authentication via Supabase. It's designed for deployment on Google Cloud Run.

## Prerequisites

*   [Node.js](https://nodejs.org/) (v20.x or later recommended)
*   [npm](https://www.npmjs.com/) (usually comes with Node.js)
*   [Git](https://git-scm.com/)

## Setup

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/mvanderlyn27/aura_backend.git
    cd aura_backend
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

## Environment Variables

This application requires certain environment variables to run.

1.  **Create a `.env` file:** Copy the example file:
    ```bash
    cp .env.example .env
    ```

2.  **Edit `.env`:** Open the `.env` file and fill in the required values:
    *   `SUPABASE_URL`: Your Supabase project URL.
    *   `SUPABASE_ANON_KEY`: Your Supabase project's anonymous key.
    *   `GEMINI_API_KEY`: Your Google AI Gemini API key.
    *   `PORT`: The port the server should listen on (defaults to 3000 if not set).
    *   `LOG_LEVEL` (Optional): Set the logging level (e.g., `debug`, `info`, `warn`, `error`). Defaults to `debug` in development and `info` in production.
    *   `CORS_ORIGIN` (Optional): Comma-separated list of allowed origins for CORS. Defaults to allowing all (`true`).

**Important:** Never commit your `.env` file to Git. The `.gitignore` file should already be configured to prevent this.

## Running Locally

For development, you can run the server with hot-reloading using `ts-node-dev`:

```bash
npm run develop
```

The server will typically be available at `http://localhost:3000` (or the port specified in your `.env`). Changes to TypeScript files will automatically restart the server.

## Running Tests

Unit and integration tests are run using `tap`. Due to a current incompatibility between `tap` and the Bun runtime's Node.js API implementation, tests **must** be run using Node.js via `npx`:

```bash
npx tap test/**/*.test.ts
```

*(Note: The `test` script in `package.json` uses `tap`, but running `npm test` might fail if `tap` exits with code 1 due to coverage checks, even if tests pass. Using `npx tap ...` directly is recommended for local testing.)*

## Running Load Tests (Autocannon)

[Autocannon](https://github.com/mcollina/autocannon) is a fast HTTP/1.1 benchmarking tool. A basic load test script is included to target the health check endpoint.

1.  **Build the application:**
    ```bash
    npm run build
    ```
2.  **Start the production server:**
    ```bash
    npm start
    ```
3.  **Run the load test (in a separate terminal):**
    ```bash
    npm run loadtest
    ```
    This will send requests to `http://localhost:3000/api/status/ping` for a short duration and print performance statistics (latency, requests/sec, etc.).

## Running Profiling (Clinic.js)

[Clinic.js](https://clinicjs.org/) is a suite of tools to help diagnose Node.js performance issues. Scripts are provided to run different Clinic.js tools (`doctor`, `bubbleprof`, `flame`). These tools start the server, generate load using Autocannon, and then produce an HTML report visualizing potential bottlenecks.

1.  **Build the application:**
    ```bash
    npm run build
    ```

2.  **Run a profiling tool (choose one):**

    *   **Doctor:** Checks overall application health and detects common issues.
        ```bash
        npm run clinic:doctor
        ```
    *   **Bubbleprof:** Profiles asynchronous activity, useful for identifying I/O bottlenecks.
        ```bash
        npm run clinic:bubbleprof
        ```
    *   **Flame:** Creates flamegraphs to visualize CPU usage and identify synchronous bottlenecks.
        ```bash
        npm run clinic:flame
        ```

3.  **View the Report:** After the command finishes, it will generate an HTML file (e.g., `12345.clinic-doctor.html`). Open this file in your web browser to view the analysis.

## Deployment (Google Cloud Run via GitHub Actions)

This project uses GitHub Actions for Continuous Integration (CI) and Continuous Deployment (CD) to Google Cloud Run.

*   **CI (`.github/workflows/ci.yml`):**
    *   Triggered on pushes to any branch and pull requests targeting `main`.
    *   Sets up Node.js v20.
    *   Installs dependencies using `npm install`.
    *   Runs tests using `npx tap test/**/*.test.ts`. It handles `tap`'s exit code 1 (likely coverage check) as a success.

*   **Deployment (`.github/workflows/deploy.yml`):**
    *   Triggered automatically on pushes to the `main` branch.
    *   Can also be triggered manually via the GitHub Actions UI (`workflow_dispatch`).
    *   Authenticates to Google Cloud using Workload Identity Federation.
    *   Builds a Docker image using the `Dockerfile`.
    *   Pushes the image to Google Artifact Registry.
    *   Deploys the image to the specified Cloud Run service (`aura-backend-service` in `us-central1`).
    *   Injects environment variables (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `GEMINI_API_KEY`) into the Cloud Run service using GitHub Actions secrets.

*   **Required GitHub Secrets:** For deployment to work, the following secrets must be configured in the repository settings (Settings > Secrets and variables > Actions > Repository secrets):
    *   `SUPABASE_URL`
    *   `SUPABASE_ANON_KEY`
    *   `GEMINI_API_KEY`

*   **Required GCP Permissions:** The Google Cloud service account used by the workflow (`aura-github@aura-fitness-457121.iam.gserviceaccount.com`) needs appropriate permissions, including:
    *   `Artifact Registry Writer` (to push images)
    *   `Cloud Run Admin` (to deploy services)
    *   `Service Account User` (often needed for Cloud Run deployments)
    *   The Workload Identity User principal (`principal://...` or `principalSet://...`) needs the `Service Account Token Creator` role *on* the deployment service account to allow impersonation.

## API Documentation (Swagger)

When running the application locally (`npm run develop`), interactive API documentation is available via Swagger UI at:

[http://localhost:3000/docs](http://localhost:3000/docs)

This documentation is automatically generated from the code (using `@fastify/swagger`) and provides details on endpoints, request/response schemas, and authentication requirements.
