variable "account_id" {
  description = "Cloudflare Account ID"
  type        = string
}

variable "project_name" {
  description = "Name of the Cloudflare Pages project"
  type        = string
}

variable "production_branch" {
  description = "Production branch for the Pages deployment"
  type        = string
}

variable "build_config" {
  description = "Optional build configuration for the Pages project"
  type        = any
  default     = null
}

variable "custom_domains" {
  description = "Custom domains for the Pages project"
  type        = list(string)
  default     = []
}
