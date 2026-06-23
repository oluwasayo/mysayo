terraform {
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5"
    }
  }
  required_version = ">= 1.11"

  # Cloudflare R2 via the S3-compatible remote backend.
  # Pass bucket, endpoint, and credentials with -backend-config (see backend.hcl.example).
  backend "s3" {
    key                         = "infrastructure/terraform.tfstate"
    region                      = "auto"
    skip_credentials_validation = true
    skip_metadata_api_check     = true
    skip_region_validation      = true
    skip_requesting_account_id  = true
    skip_s3_checksum            = true
    use_lockfile                = true
    use_path_style              = true
  }
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

locals {
  terraform_state_bucket = "${var.project}-${var.environment}-terraform-state"
}

# Bootstrap once with `wrangler r2 bucket create ...`, then import:
# terraform import 'module.terraform_state[0].cloudflare_r2_bucket.state' '<account_id>/<bucket>/default'
module "terraform_state" {
  count  = var.cloudflare_api_token != null ? 1 : 0
  source = "./cloudflare/r2-terraform-state"

  account_id  = var.cloudflare_account_id
  bucket_name = local.terraform_state_bucket
  location    = var.terraform_state_location
}

module "cloudflare_pages" {
  count  = var.cloudflare_api_token != null ? 1 : 0
  source = "./cloudflare/pages"

  account_id = var.cloudflare_account_id
  build_config = {
    build_command   = "npm run build"
    destination_dir = "dist"
    root_dir        = "code/app/web"
  }
  custom_domains    = var.site_custom_domains
  production_branch = "main"
  project_name      = var.pages_project_name
}

module "cloudflare_dns" {
  count  = var.cloudflare_api_token != null ? 1 : 0
  source = "./cloudflare/dns"

  domain         = var.domain
  pages_hostname = "${var.pages_project_name}.pages.dev"
  zone_id        = var.cloudflare_zone_id
}

module "cloudflare_zone_settings" {
  count  = var.cloudflare_api_token != null ? 1 : 0
  source = "./cloudflare/zone-settings"

  zone_id = var.cloudflare_zone_id
}

output "pages_project_name" {
  description = "Cloudflare Pages project name"
  value       = var.pages_project_name
}

output "terraform_state_bucket" {
  description = "R2 bucket used for Terraform state"
  value       = local.terraform_state_bucket
}
