
resource "kubernetes_secret" "postgres_credentials" {
  metadata {
    name      = "postgres-credentials"
    namespace = kubernetes_namespace.app_ns.metadata[0].name
  }

  type = "Opaque"

  data = {
    POSTGRES_USER     = base64encode("odc")
    POSTGRES_PASSWORD = base64encode("odc123")
    POSTGRES_DB       = base64encode("odcdb")
  }
}
