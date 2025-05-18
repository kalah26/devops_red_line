
resource "kubernetes_deployment" "backend" {
  metadata {
    name      = "backend"
    namespace = kubernetes_namespace.app_ns.metadata[0].name
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        app = "backend"
      }
    }

    template {
      metadata {
        labels = {
          app = "backend"
        }
      }

      spec {
        container {
          name  = "backend"
          image = "genecodo/backend_red_line:latest"

          image_pull_policy = "Always"

          port {
            container_port = 8000
          }

          resources {
            requests = {
              memory = "128Mi"
              cpu    = "150m"
            }
            limits = {
              memory = "256Mi"
              cpu    = "500m"
            }
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "backend" {
  metadata {
    name      = "backend"
    namespace = kubernetes_namespace.app_ns.metadata[0].name
  }

  spec {
    selector = {
      app = "backend"
    }

    type = "NodePort"

    port {
      port        = 8000
      target_port = 8000
      node_port   = 30519
    }
  }
}
