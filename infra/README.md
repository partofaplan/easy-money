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
| Firebase project + web app | Registers the browser app; its public config is baked into the build |
| Identity Platform config | Email + password sign-in; the Cloud Run host is an authorised domain |
| Firestore database `(default)` | Each account's profiles and budgets, under `users/{uid}/...` |
| Firestore rules (`firestore.rules`) | An account can read and write only its own `users/{uid}` tree |

## One-time setup

1. **Install and sign in to gcloud.** `brew install --cask google-cloud-sdk`, then
   `gcloud auth login`, `gcloud auth application-default login` (Terraform uses this one) and
   `gcloud auth application-default set-quota-project <project-id>`. The account you use needs
   the **Owner** role on the project: Terraform grants IAM roles, which Editor cannot do.
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
   On a brand-new project the very first `apply` can fail while Google finishes enabling the
   APIs it just turned on; run `terraform apply` again and it completes.
   Note the outputs: `workload_identity_provider`, `deployer_service_account`, `service_url`.
4. **Tell GitHub how to deploy.** Repository → Settings → Secrets and variables → Actions → *Variables*:
   - `GCP_PROJECT_ID` = your project id
   - `GCP_REGION` = `us-central1` (or what you chose)
   - `GCP_WORKLOAD_IDENTITY_PROVIDER` = the `workload_identity_provider` output
   - `GCP_DEPLOYER_SERVICE_ACCOUNT` = the `deployer_service_account` output
   Or from a terminal: `gh variable set GCP_PROJECT_ID --body your-project-id` (and so on).
5. **Tell GitHub the Firebase config.** `terraform output firebase_web_config` prints four public
   values; set them as repository variables `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`,
   `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`. They are baked into the build and are safe to
   expose; the Firestore rules are what protect the data.
6. **Deploy.** Merge to `main`, or run the *Deploy to Cloud Run* workflow by hand. The
   workflow prints the URL; `terraform output service_url` shows it too.

Until the first deploy the service runs Google's placeholder "hello" container.

## Accounts and data

Sign-in is email + password through Firebase Authentication (Identity Platform). Each account
owns a document tree in Firestore: `users/{uid}` holds the profile list, and
`users/{uid}/budgets/{profileId}` holds one profile's budget. The rules in `firestore.rules`
allow only the signed-in owner to read or write that tree. Rule changes deploy with
`terraform apply`.

Without the `VITE_FIREBASE_*` variables (for example `npm run dev` with no `.env.local`) the app
runs in **local mode**: no sign-in, device profiles in localStorage. Copy the values from
`terraform output firebase_web_config` into `.env.local` to run against the real project.

Password-reset emails are sent by Firebase from its default sender; a custom domain and
templates can be set in the Firebase console later.

## Day to day

- Every push to `main` runs tests, builds the image, pushes it tagged with the commit
  SHA, deploys it, and smoke-tests `/health` and a deep link.
- Pull requests run typecheck, tests and build (`ci.yml`).
- Roll back by redeploying an older image: `gcloud run deploy easy-money --image <older tag> --region us-central1`.
  Use an image the workflow built. An image built on an Apple Silicon Mac is arm64 and will not
  start on Cloud Run, which runs amd64.

## Who can deploy

Workload Identity Federation only accepts tokens from this repository **and** the `main`
branch (`deploy_branch` variable). A manual run of the deploy workflow works from `main`;
from any other branch it is refused. Nothing else in GitHub can obtain the deployer identity.

## Tearing down

`terraform destroy` removes everything. Two things to know: a deleted Workload Identity
pool keeps its id reserved for 30 days, so set `wif_pool_id` to a new value if you re-create
within that window; and the Artifact Registry repo is deleted with its images.

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
curl localhost:8080/health
```
