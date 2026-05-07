-- Fase 2 - Certificados: separacao de responsabilidades
-- Cria a estrutura V2 em paralelo ao modulo legado de ModeloCertificado/CertificadoEmitido.

DO $$ BEGIN
    CREATE TYPE "CertificateOrientation" AS ENUM ('LANDSCAPE', 'PORTRAIT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "CertificatePageSize" AS ENUM ('A4', 'LETTER', 'CUSTOM');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "CertificateTemplateMode" AS ENUM ('AUTOMATICO', 'EDITOR_VISUAL', 'HIBRIDO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "CertificateStatus" AS ENUM ('VALID', 'DRAFT', 'CANCELED', 'REISSUED', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "CertificateBatchStatus" AS ENUM ('PENDING', 'PROCESSING', 'FINISHED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "CertificateTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "backgroundImageUrl" TEXT NOT NULL,
    "backgroundMimeType" TEXT,
    "orientation" "CertificateOrientation" NOT NULL DEFAULT 'LANDSCAPE',
    "pageSize" "CertificatePageSize" NOT NULL DEFAULT 'A4',
    "mode" "CertificateTemplateMode" NOT NULL DEFAULT 'HIBRIDO',
    "width" DOUBLE PRECISION,
    "height" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CertificateTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CertificateLayout" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "elements" JSONB NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CertificateLayout_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CertificateSignature" (
    "id" TEXT NOT NULL,
    "responsibleName" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "signatureImageUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CertificateSignature_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Certificate" (
    "id" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "studentDocument" TEXT,
    "courseName" TEXT NOT NULL,
    "workload" TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validationCode" TEXT NOT NULL,
    "validationUrl" TEXT NOT NULL,
    "status" "CertificateStatus" NOT NULL DEFAULT 'VALID',
    "pdfUrl" TEXT,
    "imageUrl" TEXT,
    "templateId" TEXT NOT NULL,
    "layoutId" TEXT,
    "dataJson" JSONB NOT NULL,
    "renderedElements" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "previousCertificateId" TEXT,
    "canceledAt" TIMESTAMP(3),
    "canceledBy" TEXT,
    "cancelReason" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Certificate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CertificateHistory" (
    "id" TEXT NOT NULL,
    "certificateId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT,
    "oldData" JSONB,
    "newData" JSONB,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CertificateHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CertificateBatch" (
    "id" TEXT NOT NULL,
    "fileUrl" TEXT,
    "totalRecords" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "status" "CertificateBatchStatus" NOT NULL DEFAULT 'PENDING',
    "errorReportUrl" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CertificateBatch_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CertificateTemplate_isActive_idx" ON "CertificateTemplate"("isActive");
CREATE INDEX IF NOT EXISTS "CertificateTemplate_orientation_idx" ON "CertificateTemplate"("orientation");
CREATE INDEX IF NOT EXISTS "CertificateTemplate_pageSize_idx" ON "CertificateTemplate"("pageSize");
CREATE INDEX IF NOT EXISTS "CertificateTemplate_createdAt_idx" ON "CertificateTemplate"("createdAt");

CREATE INDEX IF NOT EXISTS "CertificateLayout_templateId_idx" ON "CertificateLayout"("templateId");
CREATE INDEX IF NOT EXISTS "CertificateLayout_templateId_isActive_idx" ON "CertificateLayout"("templateId", "isActive");
CREATE INDEX IF NOT EXISTS "CertificateLayout_templateId_isDefault_idx" ON "CertificateLayout"("templateId", "isDefault");

CREATE INDEX IF NOT EXISTS "CertificateSignature_isActive_idx" ON "CertificateSignature"("isActive");
CREATE INDEX IF NOT EXISTS "CertificateSignature_responsibleName_idx" ON "CertificateSignature"("responsibleName");

CREATE UNIQUE INDEX IF NOT EXISTS "Certificate_validationCode_key" ON "Certificate"("validationCode");
CREATE INDEX IF NOT EXISTS "Certificate_studentName_idx" ON "Certificate"("studentName");
CREATE INDEX IF NOT EXISTS "Certificate_courseName_idx" ON "Certificate"("courseName");
CREATE INDEX IF NOT EXISTS "Certificate_status_idx" ON "Certificate"("status");
CREATE INDEX IF NOT EXISTS "Certificate_templateId_idx" ON "Certificate"("templateId");
CREATE INDEX IF NOT EXISTS "Certificate_layoutId_idx" ON "Certificate"("layoutId");
CREATE INDEX IF NOT EXISTS "Certificate_createdAt_idx" ON "Certificate"("createdAt");

CREATE INDEX IF NOT EXISTS "CertificateHistory_certificateId_idx" ON "CertificateHistory"("certificateId");
CREATE INDEX IF NOT EXISTS "CertificateHistory_action_idx" ON "CertificateHistory"("action");
CREATE INDEX IF NOT EXISTS "CertificateHistory_createdAt_idx" ON "CertificateHistory"("createdAt");

CREATE INDEX IF NOT EXISTS "CertificateBatch_status_idx" ON "CertificateBatch"("status");
CREATE INDEX IF NOT EXISTS "CertificateBatch_createdAt_idx" ON "CertificateBatch"("createdAt");

DO $$ BEGIN
    ALTER TABLE "CertificateLayout"
      ADD CONSTRAINT "CertificateLayout_templateId_fkey"
      FOREIGN KEY ("templateId") REFERENCES "CertificateTemplate"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "Certificate"
      ADD CONSTRAINT "Certificate_templateId_fkey"
      FOREIGN KEY ("templateId") REFERENCES "CertificateTemplate"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "Certificate"
      ADD CONSTRAINT "Certificate_layoutId_fkey"
      FOREIGN KEY ("layoutId") REFERENCES "CertificateLayout"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "Certificate"
      ADD CONSTRAINT "Certificate_previousCertificateId_fkey"
      FOREIGN KEY ("previousCertificateId") REFERENCES "Certificate"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "CertificateHistory"
      ADD CONSTRAINT "CertificateHistory_certificateId_fkey"
      FOREIGN KEY ("certificateId") REFERENCES "Certificate"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
