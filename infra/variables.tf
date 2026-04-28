variable "resource_group_name" {
  description = "Name of the Azure Resource Group to create"
  type        = string
  default     = "neopixel-control-rg"
}

variable "location" {
  description = "Azure region for all resources"
  type        = string
  default     = "eastus2"
}

variable "app_name" {
  description = "Name of the Azure Static Web App resource"
  type        = string
  default     = "neopixel-control"
}

variable "custom_domain" {
  description = "Custom domain to attach (e.g. neopixels.viralcoder.net)"
  type        = string
  default     = "neopixels.viralcoder.net"
}

variable "aio_username" {
  description = "Adafruit IO username — set in terraform.tfvars (never commit)"
  type        = string
  sensitive   = true
}

variable "aio_key" {
  description = "Adafruit IO API key — set in terraform.tfvars (never commit)"
  type        = string
  sensitive   = true
}

variable "aio_feed" {
  description = "Adafruit IO feed name"
  type        = string
  default     = "neopixel-pattern"
}

variable "github_pat" {
  description = "GitHub fine-grained PAT with Contents read/write on this repo — used by schedule API routes"
  type        = string
  sensitive   = true
}
