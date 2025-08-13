resource "genesyscloud_flow" "flow" {
  filepath          = "./Exporter_Orchestrator.yaml"
  file_content_hash = filesha256("./Exporter_Orchestrator.yaml")

  substitutions = {
    division_name     = genesyscloud_auth_division.exporter_division.name
    mails         = var.mails
    function_name = var.function_name
    integration   = genesyscloud_integration.exporter_function_integration.config[0].name
  }
}

resource "genesyscloud_flow" "outbound_flow" {
  filepath          = "./Exporter_Outbound.yaml"
  file_content_hash = filesha256("./Exporter_Outbound.yaml")

  substitutions = {
    division_name     = genesyscloud_auth_division.exporter_division.name
    contact_list_name = genesyscloud_outbound_contact_list.contact-list.name
    wrapup_code_name  = genesyscloud_routing_wrapupcode.exporter_wrapup.name
  }
}
