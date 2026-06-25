variable "account_id" {
  description = "Cloudflare Account ID"
  sensitive   = true
  type        = string
}

variable "bucket_name" {
  description = "R2 bucket name for Terraform state"
  type        = string
}

variable "location" {
  description = "R2 bucket location hint (honored only on first creation)"
  type        = string
  default     = "weur"
}
