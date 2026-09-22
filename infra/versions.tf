terraform {
  required_version = ">= 1.6"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }
  # Remote state: uncomment once the bucket exists (see README).
  # backend "gcs" {
  #   bucket = "REPLACE-easy-money-tfstate"
  #   prefix = "easy-money"
  # }
}

provider "google" {
  project = var.project_id
  region  = var.region
}
