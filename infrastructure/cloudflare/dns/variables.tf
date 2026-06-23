variable "domain" {
  description = "The domain to manage DNS records for"
  type        = string
}

variable "zone_id" {
  description = "Cloudflare Zone ID for the domain"
  type        = string
}

variable "pages_hostname" {
  description = "Cloudflare Pages hostname (project.pages.dev)"
  type        = string
}
