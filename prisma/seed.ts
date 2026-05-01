/**
 * @deprecated ARQUIVO LEGADO — NÃO MODIFICAR
 *
 * Este arquivo foi substituído pela estrutura modular em `prisma/seed/`.
 * O novo ponto de entrada é `prisma/seed/index.ts`.
 *
 * Estrutura atual:
 *   prisma/seed/index.ts            ← Orquestrador (ponto de entrada do `npx prisma db seed`)
 *   prisma/seed/admin-seeder.ts     ← Cria/garante o usuário admin
 *   prisma/seed/site-config-seeder.ts ← Carrega configurações padrão do CMS
 *   prisma/seed/alunos-seeder.ts    ← Importa alunos de planilha Excel/CSV
 *
 * O campo "seed" no package.json já aponta para o novo caminho:
 *   "prisma": { "seed": "ts-node prisma/seed/index.ts" }
 *
 * Este arquivo pode ser removido com segurança após validação em produção.
 */