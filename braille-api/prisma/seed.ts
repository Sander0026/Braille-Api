import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // 1. Gera a senha criptografada antes de salvar no banco
  const hashedPassword = await bcrypt.hash('Admin123!', 10);

  // 2. Cria ou atualiza o usuário Admin usando o username
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      nome: 'Administrador do Sistema',
      username: 'admin',
      email: 'admin@braille.com',
      senha: hashedPassword,
      role: 'ADMIN',
      statusAtivo: true,
    },
  });

  console.log('🌱 Seed executado com sucesso! Usuário criado:', admin.username);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });