/*
Comando para executar o seed:

  npx prisma db seed

  dentro da pasta raiz do projeto da api

*/

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
      nome: 'Suporte do Sistema',
      username: 'admin',
      email: 'admin@braille.com',
      senha: hashedPassword,
      role: 'ADMIN',
      statusAtivo: true,
    },
  });

  const comunicacao = await prisma.user.upsert({
    where: { username: 'comunicacao' },
    update: {},
    create: {
      nome: 'comunicacao',
      username: 'comunicacao',
      email: 'comunicacao@braille.com',
      senha: hashedPassword,
      role: 'COMUNICACAO',
      statusAtivo: true,
    },
  });

  const secretaria = await prisma.user.upsert({
    where: { username: 'secretaria' },
    update: {},
    create: {
      nome: 'secretaria',
      username: 'secretaria',
      email: 'secretaria@braille.com',
      senha: hashedPassword,
      role: 'SECRETARIA',
      statusAtivo: true,
    },
  });

  const professor = await prisma.user.upsert({
    where: { username: 'professor' },
    update: {},
    create: {
      nome: 'professor',
      username: 'professor',
      email: 'professor@braille.com',
      senha: hashedPassword,
      role: 'PROFESSOR',
      statusAtivo: true,
    },
  });

  console.log('🌱 Seed executado com sucesso! Usuário criado:', admin.username);
  console.log('🌱 Seed executado com sucesso! Usuário criado:', comunicacao.username);
  console.log('🌱 Seed executado com sucesso! Usuário criado:', secretaria.username);
  console.log('🌱 Seed executado com sucesso! Usuário criado:', professor.username);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });