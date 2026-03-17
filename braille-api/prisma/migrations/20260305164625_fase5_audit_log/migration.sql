-- CreateEnum
CREATE TYPE "AuditAcao" AS ENUM ('CRIAR', 'ATUALIZAR', 'EXCLUIR', 'ARQUIVAR', 'RESTAURAR', 'LOGIN', 'LOGOUT', 'MATRICULAR', 'DESMATRICULAR', 'FECHAR_DIARIO', 'REABRIR_DIARIO', 'MUDAR_STATUS');

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "registroId" TEXT,
    "acao" "AuditAcao" NOT NULL,
    "autorId" TEXT,
    "autorNome" TEXT,
    "autorRole" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "oldValue" JSONB,
    "newValue" JSONB,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_entidade_registroId_idx" ON "AuditLog"("entidade", "registroId");

-- CreateIndex
CREATE INDEX "AuditLog_autorId_idx" ON "AuditLog"("autorId");

-- CreateIndex
CREATE INDEX "AuditLog_criadoEm_idx" ON "AuditLog"("criadoEm");

-- CreateIndex
CREATE INDEX "AuditLog_acao_idx" ON "AuditLog"("acao");
