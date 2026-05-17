UPDATE "Turma"
SET "statusAtivo" = false
WHERE "status" IN ('CONCLUIDA', 'CANCELADA')
  AND "statusAtivo" = true;
