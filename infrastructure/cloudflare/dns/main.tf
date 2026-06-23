# Static site DNS: apex and www point at Cloudflare Pages.
# Add subdomains, MX, and TXT resources here when email or other services are needed.

resource "cloudflare_dns_record" "root" {
  content = var.pages_hostname
  name    = "@"
  proxied = true
  ttl     = 1
  type    = "CNAME"
  zone_id = var.zone_id
}

resource "cloudflare_dns_record" "www" {
  content = var.pages_hostname
  name    = "www"
  proxied = true
  ttl     = 1
  type    = "CNAME"
  zone_id = var.zone_id
}
