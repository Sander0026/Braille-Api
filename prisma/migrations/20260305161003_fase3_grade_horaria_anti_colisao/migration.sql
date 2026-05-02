-- CreateEnum
CREATE TYPE "DiaSemana" AS ENUM ('SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB', 'DOM');

-- CreateTable
CREATE TABLE "GradeHoraria" (
    "id" TEXT NOT NULL,
    "dia" "DiaSemana" NOT NULL,
    "horaInicio" INTEGER NOT NULL,
    "horaFim" INTEGER NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "turmaId" TEXT NOT NULL,

    CONSTRAINT "GradeHoraria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GradeHoraria_turmaId_idx" ON "GradeHoraria"("turmaId");

-- CreateIndex
CREATE UNIQUE INDEX "GradeHoraria_turmaId_dia_key" ON "GradeHoraria"("turmaId", "dia");

-- AddForeignKey
ALTER TABLE "GradeHoraria" ADD CONSTRAINT "GradeHoraria_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "Turma"("id") ON DELETE CASCADE ON UPDATE CASCADE;
