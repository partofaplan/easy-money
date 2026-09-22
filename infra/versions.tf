terraform {
  required_version = ">= 1.6"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 6.0"
    }
  }
  # Remote state: uncomment once the bucket exists (see README).
  # backend "gcs" {
  #   bucket = "REPLACE-easy-money-tfstate"
  #   prefix = "easy-money"
  # }
}

# Some APIs (Identity Platform) need a quota project when Terraform runs with a
# person's credentials; bill those calls to the project being managed.
provider "google" {
  project               = var.project_id
  region                = var.region
  user_project_override = true
  billing_project       = var.project_id
}

provider "google-beta" {
  project               = var.project_id
  region                = var.region
  user_project_override = true
  billing_project       = var.project_id
}
