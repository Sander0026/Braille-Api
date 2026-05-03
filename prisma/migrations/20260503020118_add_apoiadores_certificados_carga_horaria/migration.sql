-- CreateEnum
CREATE TYPE "TipoApoiador" AS ENUM ('VOLUNTARIO', 'EMPRESA', 'IMPRENSA', 'PROFISSIONAL_LIBERAL', 'ONG', 'OUTRO');

-- CreateEnum
CREATE TYPE "TipoCertificado" AS ENUM ('ACADEMICO', 'HONRARIA');

-- DropIndex
DROP INDEX "GradeHoraria_turmaId_dia_key";

-- AlterTable
ALTER TABLE "Turma" ADD COLUMN     "cargaHoraria" TEXT,
ADD COLUMN     "modeloCertificadoId" TEXT;

-- CreateTable
CREATE TABLE "Apoiador" (
    "id" TEXT NOT NULL,
    "tipo" "TipoApoiador" NOT NULL,
    "nomeRazaoSocial" TEXT NOT NULL,
    "nomeFantasia" TEXT,
    "cpfCnpj" TEXT,
    "contatoPessoa" TEXT,
    "telefone" TEXT,
    "email" TEXT,
    "cep" TEXT,
    "rua" TEXT,
    "numero" TEXT,
    "complemento" TEXT,
    "bairro" TEXT,
    "cidade" TEXT,
    "uf" TEXT,
    "atividadeEspecialidade" TEXT,
    "observacoes" TEXT,
    "logoUrl" TEXT,
    "exibirNoSite" BOOLEAN NOT NULL DEFAULT false,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Apoiador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcaoApoiador" (
    "id" TEXT NOT NULL,
    "dataEvento" DATE NOT NULL,
    "descricaoAcao" TEXT NOT NULL,
    "apoiadorId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcaoApoiador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModeloCertificado" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "arteBaseUrl" TEXT NOT NULL,
    "assinaturaUrl" TEXT NOT NULL,
    "textoTemplate" TEXT NOT NULL,
    "nomeAssinante" TEXT NOT NULL,
    "cargoAssinante" TEXT NOT NULL,
    "assinaturaUrl2" TEXT,
    "nomeAssinante2" TEXT,
    "cargoAssinante2" TEXT,
    "layoutConfig" JSONB,
    "tipo" "TipoCertificado" NOT NULL DEFAULT 'ACADEMICO',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModeloCertificado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CertificadoEmitido" (
    "id" TEXT NOT NULL,
    "codigoValidacao" TEXT NOT NULL,
    "dataEmissao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pdfUrl" TEXT,
    "alunoId" TEXT,
    "turmaId" TEXT,
    "apoiadorId" TEXT,
    "acaoId" TEXT,
    "motivoPersonalizado" TEXT,
    "modeloId" TEXT NOT NULL,

    CONSTRAINT "CertificadoEmitido_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AcaoApoiador_apoiadorId_idx" ON "AcaoApoiador"("apoiadorId");

-- CreateIndex
CREATE INDEX "AcaoApoiador_dataEvento_idx" ON "AcaoApoiador"("dataEvento");

-- CreateIndex
CREATE INDEX "ModeloCertificado_tipo_idx" ON "ModeloCertificado"("tipo");

-- CreateIndex
CREATE UNIQUE INDEX "CertificadoEmitido_codigoValidacao_key" ON "CertificadoEmitido"("codigoValidacao");

-- CreateIndex
CREATE INDEX "CertificadoEmitido_alunoId_idx" ON "CertificadoEmitido"("alunoId");

-- CreateIndex
CREATE INDEX "CertificadoEmitido_apoiadorId_idx" ON "CertificadoEmitido"("apoiadorId");

-- CreateIndex
CREATE INDEX "CertificadoEmitido_acaoId_idx" ON "CertificadoEmitido"("acaoId");

-- CreateIndex
CREATE INDEX "CertificadoEmitido_codigoValidacao_idx" ON "CertificadoEmitido"("codigoValidacao");

-- CreateIndex
CREATE INDEX "CertificadoEmitido_modeloId_idx" ON "CertificadoEmitido"("modeloId");

-- CreateIndex
CREATE INDEX "CertificadoEmitido_alunoId_turmaId_idx" ON "CertificadoEmitido"("alunoId", "turmaId");

-- CreateIndex
CREATE INDEX "GradeHoraria_turmaId_dia_idx" ON "GradeHoraria"("turmaId", "dia");

-- CreateIndex
CREATE INDEX "GradeHoraria_dia_horaInicio_horaFim_idx" ON "GradeHoraria"("dia", "horaInicio", "horaFim");

-- AddForeignKey
ALTER TABLE "Turma" ADD CONSTRAINT "Turma_modeloCertificadoId_fkey" FOREIGN KEY ("modeloCertificadoId") REFERENCES "ModeloCertificado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcaoApoiador" ADD CONSTRAINT "AcaoApoiador_apoiadorId_fkey" FOREIGN KEY ("apoiadorId") REFERENCES "Apoiador"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertificadoEmitido" ADD CONSTRAINT "CertificadoEmitido_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "Aluno"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertificadoEmitido" ADD CONSTRAINT "CertificadoEmitido_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "Turma"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertificadoEmitido" ADD CONSTRAINT "CertificadoEmitido_apoiadorId_fkey" FOREIGN KEY ("apoiadorId") REFERENCES "Apoiador"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertificadoEmitido" ADD CONSTRAINT "CertificadoEmitido_acaoId_fkey" FOREIGN KEY ("acaoId") REFERENCES "AcaoApoiador"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertificadoEmitido" ADD CONSTRAINT "CertificadoEmitido_modeloId_fkey" FOREIGN KEY ("modeloId") REFERENCES "ModeloCertificado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
