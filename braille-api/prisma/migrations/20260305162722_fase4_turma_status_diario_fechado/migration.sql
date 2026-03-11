-- CreateEnum
CREATE TYPE "TurmaStatus" AS ENUM ('PREVISTA', 'ANDAMENTO', 'CONCLUIDA', 'CANCELADA');

-- AlterTable
ALTER TABLE "Frequencia" ADD COLUMN     "fechado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "fechadoEm" TIMESTAMP(3),
ADD COLUMN     "fechadoPor" TEXT;

-- AlterTable
ALTER TABLE "Turma" ADD COLUMN     "status" "TurmaStatus" NOT NULL DEFAULT 'ANDAMENTO';
