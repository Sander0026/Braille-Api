import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // Criptografa a senha antes de salvar
  const senhaCriptografada = await bcrypt.hash('senha123', 10);

  // O 'upsert' cria o usuário se ele não existir, ou ignora se já estiver lá
  const admin = await prisma.user.upsert({
    where: { email: 'admin@brailli.com' },
    update: {},
    create: {
      nome: 'Administrador Brailli',
      email: 'admin@brailli.com',
      senha: senhaCriptografada,
      role: 'ADMIN',
    },
  });

  console.log('✅ Usuário Admin criado com sucesso:', admin.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });