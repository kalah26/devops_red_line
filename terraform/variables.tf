
variable "namespace" {
  default = "app-namespace"
}

variable "postgres_user" {
  type    = string
  default = "odc"
}

variable "postgres_db" {
  type    = string
  default = "odcdb"
}

variable "postgres_password" {
  description = "PostgreSQL password. Pass via TF_VAR_postgres_password or a git-ignored *.tfvars file."
  type        = string
  sensitive   = true
}
