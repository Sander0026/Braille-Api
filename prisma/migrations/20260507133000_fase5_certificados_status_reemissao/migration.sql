-- Fase 5 - Certificados: status, cancelamento e reemissao no fluxo legado.

ALTER TABLE "CertificadoEmitido"
  ADD COLUMN IF NOT EXISTS "status" "CertificateStatus" NOT NULL DEFAULT 'VALID',
  ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "matriculaImpresso" TEXT,
  ADD COLUMN IF NOT EXISTS "nomeImpresso" TEXT,
  ADD COLUMN IF NOT EXISTS "cursoImpresso" TEXT,
  ADD COLUMN IF NOT EXISTS "cargaHorariaImpresso" TEXT,
  ADD COLUMN IF NOT EXISTS "dadosManuais" JSONB,
  ADD COLUMN IF NOT EXISTS "canceledAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "canceledBy" TEXT,
  ADD COLUMN IF NOT EXISTS "cancelReason" TEXT,
  ADD COLUMN IF NOT EXISTS "previousCertificadoId" TEXT;

CREATE INDEX IF NOT EXISTS "CertificadoEmitido_status_idx" ON "CertificadoEmitido"("status");
CREATE INDEX IF NOT EXISTS "CertificadoEmitido_previousCertificadoId_idx" ON "CertificadoEmitido"("previousCertificadoId");

DO $$ BEGIN
    ALTER TABLE "CertificadoEmitido"
      ADD CONSTRAINT "CertificadoEmitido_previousCertificadoId_fkey"
      FOREIGN KEY ("previousCertificadoId") REFERENCES "CertificadoEmitido"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
