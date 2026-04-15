output "swa_default_hostname" {
  description = "Default SWA hostname — use this as the CNAME target at your registrar: neopixels.viralcoder.net CNAME <this value>"
  value       = azurerm_static_web_app.main.default_host_name
}

output "deployment_api_token" {
  description = "Deployment token — add to GitHub Secrets as AZURE_STATIC_WEB_APPS_API_TOKEN"
  value       = azurerm_static_web_app.main.api_key
  sensitive   = true
}
