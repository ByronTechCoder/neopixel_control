terraform {
  required_version = ">= 1.3.0"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.90"
    }
  }
}

provider "azurerm" {
  features {}
}

resource "azurerm_resource_group" "main" {
  name     = var.resource_group_name
  location = var.location
}

resource "azurerm_static_web_app" "main" {
  name                = var.app_name
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  sku_tier            = "Free"
  sku_size            = "Free"

  app_settings = {
    AIO_USERNAME = var.aio_username
    AIO_KEY      = var.aio_key
    AIO_FEED     = var.aio_feed
  }
}

# Add this resource AFTER setting the CNAME at your registrar.
# Run `terraform apply -target=azurerm_static_web_app.main` first,
# note the `swa_default_hostname` output, set the CNAME, then run
# `terraform apply` to create the custom domain association.
resource "azurerm_static_web_app_custom_domain" "main" {
  static_web_app_id = azurerm_static_web_app.main.id
  domain_name       = var.custom_domain
  validation_type   = "cname-delegation"
}
