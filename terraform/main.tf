variable "oauthclient_id" { default = "" }
variable "oauthclient_secret" { default = "" }
variable "aws_region" { default = "" }
variable "function_name" { default = "" }
variable "mails" { default = "" }
variable "edge_group_name" { default = "" }

terraform {
  required_providers {
    genesyscloud = {
      source  = "mypurecloud/genesyscloud"
      version = "~> 1.65.0"
    }
  }
}

provider "genesyscloud" {
  oauthclient_id     = var.oauthclient_id
  oauthclient_secret = var.oauthclient_secret
  aws_region         = var.aws_region
}
