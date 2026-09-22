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
