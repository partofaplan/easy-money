variable "project_id" {
  description = "GCP project that hosts the app. Billing must be enabled."
  type        = string
}

variable "region" {
  description = "Region for Cloud Run and Artifact Registry."
  type        = string
  default     = "us-central1"
}

variable "service_name" {
  description = "Cloud Run service name."
  type        = string
  default     = "easy-money"
}

variable "github_repository" {
  description = "GitHub repo allowed to deploy, as owner/name."
  type        = string
  default     = "partofaplan/easy-money"
}
