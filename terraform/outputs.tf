
output "frontend_nodeport" {
  value = kubernetes_service.frontend.spec[0].port[0].node_port
}
