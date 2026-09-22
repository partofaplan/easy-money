# Deploying Easy Money to Google Cloud

The app is a static single-page site, so it runs as a tiny nginx container on
**Cloud Run** (scales to zero, HTTPS for free, custom domains later). Terraform
in this folder creates everything once; **GitHub Actions** builds and deploys
every push to `main`, authenticating through Workload Identity Federation
(no downloaded keys).

## What gets created

| Resource | Purpose |
| --- | --- |
| Cloud Run service `easy-money` | Serves the site, public, 0 to 3 instances |
| Artifact Registry repo `easy-money` | Holds built images, keeps the last 10 / 30 days |
| Service account `easy-money-run` | Identity the service runs as (needs nothing today) |
| Service account `easy-money-deployer` | What GitHub Actions becomes when deploying |
| Workload Identity pool + provider `github` | Trusts GitHub's OIDC tokens for this repo only |
| IAM bindings | Deployer can push images and update the service; everyone can invoke it |

## One-time setup

1. **Install and sign in to gcloud.** `brew install --cask google-cloud-sdk`, then
   `gcloud auth login` and `gcloud auth application-default login` (Terraform uses the second).
2. **Have a project with billing.** Either use an existing one or:
   ```sh
   gcloud projects create easy-money-poc --name="Easy Money"
   gcloud billing projects link easy-money-poc --billing-account=XXXXXX-XXXXXX-XXXXXX
   ```
3. **Apply the infrastructure.**
   ```sh
   cd infra
   cp terraform.tfvars.example terraform.tfvars   # set project_id
   terraform init
   terraform apply
   ```
   Note the outputs: `workload_identity_provider`, `deployer_service_account`, `service_url`.
4. **Tell GitHub how to deploy.** Repository → Settings → Secrets and variables → Actions → *Variables*:
   - `GCP_PROJECT_ID` = your project id
   - `GCP_REGION` = `us-central1` (or what you chose)
   - `GCP_WORKLOAD_IDENTITY_PROVIDER` = the `workload_identity_provider` output
   - `GCP_DEPLOYER_SERVICE_ACCOUNT` = the `deployer_service_account` output
   Or from a terminal: `gh variable set GCP_PROJECT_ID --body your-project-id` (and so on).
5. **Deploy.** Merge to `main`, or run the *Deploy to Cloud Run* workflow by hand. The
   workflow prints the URL; `terraform output service_url` shows it too.

Until the first deploy the service runs Google's placeholder "hello" container.

## Day to day

- Every push to `main` runs tests, builds the image, pushes it tagged with the commit
  SHA, deploys it, and smoke-tests `/healthz` and a deep link.
- Pull requests run typecheck, tests and build (`ci.yml`).
- Roll back by redeploying an older image: `gcloud run deploy easy-money --image <older tag> --region us-central1`.

## Remote Terraform state (recommended once more than one person applies)

Create a bucket and uncomment the `backend "gcs"` block in `versions.tf`:
```sh
gsutil mb -l us-central1 gs://<unique-name>-easy-money-tfstate
gsutil versioning set on gs://<unique-name>-easy-money-tfstate
terraform init -migrate-state
```

## Costs

Cloud Run bills per request and instance-second; a low-traffic static site sits within
the free tier. Artifact Registry storage is a few cents a month with the cleanup policy.

## Local check

```sh
docker build -t easy-money .
docker run --rm -p 8080:8080 easy-money
curl localhost:8080/healthz
```
