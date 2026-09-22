# Sign-in and per-user storage: Firebase Authentication (email + password) and
# Cloud Firestore, with rules so an account can only read and write its own data.

locals {
  firebase_apis = [
    "firebase.googleapis.com",
    "firestore.googleapis.com",
    "identitytoolkit.googleapis.com",
    "firebaserules.googleapis.com",
  ]
  cloud_run_host = trimprefix(google_cloud_run_v2_service.app.uri, "https://")
}

resource "google_project_service" "firebase_apis" {
  for_each           = toset(local.firebase_apis)
  service            = each.value
  disable_on_destroy = false
}

resource "google_firebase_project" "default" {
  provider   = google-beta
  project    = var.project_id
  depends_on = [google_project_service.firebase_apis]
}

# The browser app's registration; its config is public and goes into the build.
resource "google_firebase_web_app" "app" {
  provider        = google-beta
  project         = var.project_id
  display_name    = "Easy Money"
  deletion_policy = "DELETE"
  depends_on      = [google_firebase_project.default]
}

data "google_firebase_web_app_config" "app" {
  provider   = google-beta
  project    = var.project_id
  web_app_id = google_firebase_web_app.app.app_id
}

# People's budgets live here: protected from deletion, with point-in-time
# recovery as the undo for accidental overwrites. Terraform leaves it in place on destroy.
resource "google_firestore_database" "default" {
  project                           = var.project_id
  name                              = "(default)"
  location_id                       = var.region
  type                              = "FIRESTORE_NATIVE"
  delete_protection_state           = "DELETE_PROTECTION_ENABLED"
  point_in_time_recovery_enablement = "POINT_IN_TIME_RECOVERY_ENABLED"
  deletion_policy                   = "ABANDON"
  depends_on                        = [google_firebase_project.default]

  lifecycle {
    prevent_destroy = true
  }
}

# Email + password sign-in. The Cloud Run host must be authorised for the
# browser SDK to complete sign-in and password-reset links from it.
resource "google_identity_platform_config" "auth" {
  project = var.project_id
  sign_in {
    email {
      enabled           = true
      password_required = true
    }
  }
  authorized_domains = [
    "localhost",
    "${var.project_id}.firebaseapp.com",
    "${var.project_id}.web.app",
    local.cloud_run_host,
  ]
  depends_on = [google_firebase_project.default]
}

resource "google_firebaserules_ruleset" "firestore" {
  provider = google-beta
  project  = var.project_id
  source {
    files {
      name    = "firestore.rules"
      content = file("${path.module}/firestore.rules")
    }
  }
  depends_on = [google_firestore_database.default]
}

resource "google_firebaserules_release" "firestore" {
  provider     = google-beta
  project      = var.project_id
  name         = "cloud.firestore"
  ruleset_name = google_firebaserules_ruleset.firestore.name
  lifecycle {
    replace_triggered_by = [google_firebaserules_ruleset.firestore]
  }
}
