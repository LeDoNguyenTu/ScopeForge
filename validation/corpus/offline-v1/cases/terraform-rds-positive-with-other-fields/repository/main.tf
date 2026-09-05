resource "aws_db_instance" "example" {
  identifier              = "scopeforge-fixture"
  allocated_storage       = 20
  engine                  = "postgres"
  instance_class          = "db.t3.micro"
  publicly_accessible     = true
  deletion_protection     = true
  skip_final_snapshot     = false
}
