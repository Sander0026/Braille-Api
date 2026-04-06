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

  const admin = await prisma.user.upsert({
    where:  { username: 'admin' },
    update: {}, 
    create: {
      nome:        'Suporte do Sistema',
      username:    'admin',
      email:       'admin@braille.com',
      senha:       senhaHash,
      role:        'ADMIN',
      statusAtivo: true,
    },
    select: { username: true, role: true }, // Mínimo — hash de senha nunca trafega
  });

  console.log(`✅ [AdminSeeder] Administrador garantido: "${admin.username}" (${admin.role})`);
}
