/**
 * @seeder AdminSeeder
 *
 * Responsabilidade única: garantir que o usuário administrador padrão exista no banco.
 *
 * Segurança (OWASP A2 / CWE-547):
 *   - ZERO credenciais hardcoded — nem em produção, nem em desenvolvimento.
 *   - A senha SEMPRE vem de SENHA_PADRAO_ADMIN (variável de ambiente).
 *   - Se a variável estiver ausente em qualquer ambiente, o seeder falha com
 *     uma mensagem de erro clara que instrui o desenvolvedor a configurar o .env.
 *   - A senha nunca é logada — apenas o username é exibido no console.
 *
 * Configuração rápida em desenvolvimento:
 *   1. Copie o arquivo de exemplo:  cp .env.example .env
 *   2. Defina no .env:              SENHA_PADRAO_ADMIN=SuaSenhaLocal123!
 *   3. Execute:                     npx prisma db seed
 *
 * Idempotência:
 *   - Usa upsert com `update: {}` — reexecutar o seed nunca sobrescreve
 *     uma senha já alterada em produção.
 *
 * Troca de senha obrigatória no primeiro login:
 *   - Novas instalações: `precisaTrocarSenha: true` é definido no `create`.
 *   - Bancos legados: o seeder detecta se a senha ainda é a padrão (via bcrypt)
 *     e ativa o flag automaticamente, sem resetar a senha.
 *   - Após a instituição personalizar a senha, o flag é limpo pelo AuthService
 *     e o seeder passa a ser um no-op (idempotente).
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

/** OWASP recomenda mínimo 10 rounds; 12 é o padrão seguro atual. */
const BCRYPT_ROUNDS = 12;

/**
 * Lê a senha do admin exclusivamente de variável de ambiente.
 * Falha de forma explícita se não configurada — sem fallback inseguro.
 */
function resolverSenhaAdmin(): string {
  const senhaEnv = process.env.SENHA_PADRAO_ADMIN;

  if (senhaEnv && senhaEnv.trim().length > 0) {
    return senhaEnv.trim();
  }

  throw new Error(
    '\n[AdminSeeder] SENHA_PADRAO_ADMIN não está definida.\n' +
    'Configure esta variável de ambiente antes de executar o seed:\n' +
    '  → Copie o template:   cp .env.example .env\n' +
    '  → Defina no .env:     SENHA_PADRAO_ADMIN=SuaSenha123!\n' +
    '  → Execute novamente:  npx prisma db seed\n',
  );
}

export async function seedAdmin(prisma: PrismaClient): Promise<void> {
  console.log('👤 [AdminSeeder] Garantindo usuário administrador...');

  const senhaPlana = resolverSenhaAdmin();
  const senhaHash  = await bcrypt.hash(senhaPlana, BCRYPT_ROUNDS);

  // ── Passo 1: Garantir que o admin existe ──────────────────────────────────
  // update: {} — reexecutar o seed nunca sobrescreve uma senha já alterada.
  // create: precisaTrocarSenha: true — novas instalações obrigam troca no 1º login.
  const admin = await prisma.user.upsert({
    where:  { username: 'admin' },
    update: {},
    create: {
      nome:               'Suporte do Sistema',
      username:           'admin',
      email:              'admin@braille.com',
      senha:              senhaHash,
      role:               'ADMIN',
      statusAtivo:        true,
      precisaTrocarSenha: true, // Obriga a troca de senha no primeiro login da instituição
    },
    select: { id: true, username: true, role: true, senha: true, precisaTrocarSenha: true },
  });

  // ── Passo 2: Bancos legados — ativar o flag se a senha ainda é a padrão ──
  // Quando o admin já existia (upsert não disparou o create), verificamos se a
  // senha atual ainda bate com SENHA_PADRAO_ADMIN. Se bater, a instituição ainda
  // não personalizou a senha: ativamos precisaTrocarSenha sem resetar a senha.
  // Se a senha já foi trocada, não fazemos nada (idempotência preservada).
  if (!admin.precisaTrocarSenha) {
    const senhaAindaEhPadrao = await bcrypt.compare(senhaPlana, admin.senha);
    if (senhaAindaEhPadrao) {
      await prisma.user.update({
        where: { id: admin.id },
        data:  { precisaTrocarSenha: true },
      });
      console.log('⚠️  [AdminSeeder] Senha padrão detectada — flag de troca obrigatória ativado.');
    } else {
      console.log('ℹ️  [AdminSeeder] Senha já personalizada — nenhuma alteração necessária.');
    }
  }

  console.log(`✅ [AdminSeeder] Administrador garantido: "${admin.username}" (${admin.role})`);
}

