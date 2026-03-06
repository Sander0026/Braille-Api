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

  // 3. Cadastra ou atualiza as configurações do Site Padrão (CMS)
  const configsPadrao = [
    { chave: 'siteNome', valor: 'Instituto Luiz Braille', tipo: 'texto', descricao: 'Nome exibido no portal principal' },
    { chave: 'corPrimaria', valor: '#f5c800', tipo: 'cor', descricao: 'Amarelo ILBES Oficial' },
    { chave: 'contatoEmail', valor: 'contato@braille.org', tipo: 'texto', descricao: 'E-mail para mensagens/formulário' },
    { chave: 'contatoTelefone', valor: '(27) 3000-0000', tipo: 'texto', descricao: 'Telefone para exibição no rodapé' }
  ];

  for (const conf of configsPadrao) {
    await prisma.siteConfig.upsert({
      where: { chave: conf.chave },
      update: {},
      create: conf,
    });
  }

  console.log('🌱 Seed executado com sucesso! Usuário criado:', admin.username);
  console.log('🎨 Configurações de layout carregadas ({ keys: ' + configsPadrao.length + ' })');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });