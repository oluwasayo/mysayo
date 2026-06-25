# Align cloudflare_pages_project with the recommended Wrangler-first bootstrap:
# https://github.com/cloudflare/terraform-provider-cloudflare/issues/5928#issuecomment-3660180957
# Requires the Pages project to exist before the first plan (create with wrangler first).
data "cloudflare_pages_project" "current" {
  account_id   = var.account_id
  project_name = var.project_name
}

locals {
  preview_compat = try(
    data.cloudflare_pages_project.current.deployment_configs.preview.compatibility_date,
    null,
  )
  production_compat = try(
    data.cloudflare_pages_project.current.deployment_configs.production.compatibility_date,
    null,
  )
  pages_deployment_configs = (
    local.preview_compat != null && local.preview_compat != ""
    && local.production_compat != null && local.production_compat != ""
    ) ? {
    preview = {
      compatibility_date  = local.preview_compat
      compatibility_flags = []
      fail_open           = false
      placement           = {}
    }
    production = {
      compatibility_date  = local.production_compat
      compatibility_flags = []
      fail_open           = false
      placement           = {}
    }
  } : null
}

resource "cloudflare_pages_project" "web" {
  account_id        = var.account_id
  name              = var.project_name
  production_branch = var.production_branch

  build_config = var.build_config != null ? {
    build_caching       = false
    build_command       = lookup(var.build_config, "build_command", null)
    destination_dir     = lookup(var.build_config, "destination_dir", null)
    root_dir            = lookup(var.build_config, "root_dir", null)
    web_analytics_tag   = data.cloudflare_pages_project.current.build_config.web_analytics_tag
    web_analytics_token = data.cloudflare_pages_project.current.build_config.web_analytics_token
  } : null

  deployment_configs = local.pages_deployment_configs
}

resource "cloudflare_pages_domain" "custom" {
  depends_on   = [cloudflare_pages_project.web]
  for_each     = toset(var.custom_domains)
  account_id   = var.account_id
  name         = each.value
  project_name = cloudflare_pages_project.web.name
}
