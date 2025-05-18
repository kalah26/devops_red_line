
provider "kubernetes" {
  config_path = "~/.kube/config"
}

resource "kubernetes_namespace" "app_ns" {
  metadata {
    name = "app-namespace"
  }
}
