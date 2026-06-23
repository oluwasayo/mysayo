terraform {
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5"
    }
  }
}

resource "cloudflare_r2_bucket" "state" {
  account_id    = var.account_id
  jurisdiction  = "default"
  location      = var.location
  name          = var.bucket_name
  storage_class = "Standard"

  lifecycle {
    prevent_destroy = true
  }
}

output "bucket_name" {
  value = cloudflare_r2_bucket.state.name
}
