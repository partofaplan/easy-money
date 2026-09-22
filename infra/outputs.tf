output "service_url" {
  description = "Where the app is served."
  value       = google_cloud_run_v2_service.app.uri
}

output "image_repository" {
  description = "Artifact Registry path the workflow pushes to."
  value       = local.image_repo
}

output "workload_identity_provider" {
  description = "Set as the GCP_WORKLOAD_IDENTITY_PROVIDER repository variable in GitHub."
  value       = google_iam_workload_identity_pool_provider.github.name
}

output "deployer_service_account" {
  description = "Set as the GCP_DEPLOYER_SERVICE_ACCOUNT repository variable in GitHub."
  value       = google_service_account.deployer.email
}

# Public browser configuration. Set as VITE_FIREBASE_* repository variables in GitHub.
output "firebase_web_config" {
  description = "Values for VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_APP_ID."
  value = {
    api_key     = data.google_firebase_web_app_config.app.api_key
    auth_domain = data.google_firebase_web_app_config.app.auth_domain
    project_id  = var.project_id
    app_id      = google_firebase_web_app.app.app_id
  }
}
