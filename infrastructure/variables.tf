variable "cloudflare_account_id" {
  description = "Cloudflare Account ID"
  nullable    = true
  type        = string
  default     = null
}

variable "cloudflare_api_token" {
  description = "Cloudflare API Token"
  nullable    = true
  sensitive   = true
  type        = string
  default     = null
}

variable "cloudflare_zone_id" {
  description = "Cloudflare Zone ID for the domain"
  nullable    = true
  type        = string
  default     = null
}

variable "domain" {
  description = "Primary domain managed in Cloudflare"
  type        = string
  default     = "mysayo.com"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

variable "pages_project_name" {
  description = "Cloudflare Pages project name"
  type        = string
  default     = "mysayo-web"
}

variable "project" {
  description = "Project name used for resource naming"
  type        = string
  default     = "mysayo"
}

variable "site_custom_domains" {
  description = "Custom domains attached to the Pages project"
  type        = list(string)
  default     = ["mysayo.com", "www.mysayo.com"]
}

variable "terraform_state_location" {
  description = "R2 location for the Terraform state bucket"
  type        = string
  default     = "weur"
}
