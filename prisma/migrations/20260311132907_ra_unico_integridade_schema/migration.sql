-- DropIndex
DROP INDEX "MatriculaOficina_alunoId_turmaId_key";

-- AlterTable
ALTER TABLE "Frequencia" ALTER COLUMN "dataAula" DROP DEFAULT,
ALTER COLUMN "dataAula" SET DATA TYPE DATE;

-- AlterTable
ALTER TABLE "Turma" ADD COLUMN     "professorAuxiliarId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "refreshToken" TEXT;
