resource "aws_db_instance" "example" {
  identifier          = "scopeforge-fixture"
  engine              = "postgres"
  publicly_accessible = false
}
