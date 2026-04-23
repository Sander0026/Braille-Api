/**
 * @seeder SiteConfigSeeder
 *
 * Responsabilidade única: garantir que as configurações padrão do CMS existam no banco.
 *
 * Idempotência:
 *   - Usa `createMany({ skipDuplicates: true })` pois `update: {}` seria um no-op.
 *     Esta abordagem é mais performática que N upserts individuais e garante que
 *     configurações personalizadas (editadas via admin) NÃO sejam sobrescritas.
 *
 * Extensibilidade:
 *   - Para adicionar novas configs, basta adicionar uma entrada ao array CONFIGS_PADRAO.
 *     Sem alterar lógica de persistência.
 */

import { PrismaClient } from '@prisma/client';

interface SiteConfigEntry {
  chave:    string;
  valor:    string;
  tipo:     string;
  descricao: string;
}

const CONFIGS_PADRAO: readonly SiteConfigEntry[] = [
  {
    chave:    'siteNome',
    valor:    'Instituto Luiz Braille',
    tipo:     'texto',
    descricao: 'Nome exibido no portal principal',
  },
  {
    chave:    'corPrimaria',
    valor:    '#f5c800',
    tipo:     'cor',
    descricao: 'Amarelo ILBES Oficial',
  },
  {
    chave:    'contatoEmail',
    valor:    'contato@braille.org',
    tipo:     'texto',
    descricao: 'E-mail para mensagens/formulário de contato',
  },
  {
    chave:    'contatoTelefone',
    valor:    '(27) 3000-0000',
    tipo:     'texto',
    descricao: 'Telefone para exibição no rodapé',
  },
] as const;

export async function seedSiteConfig(prisma: PrismaClient): Promise<void> {
  console.log(`🎨 [SiteConfigSeeder] Carregando ${CONFIGS_PADRAO.length} configuração(s) padrão...`);

  const resultado = await prisma.siteConfig.createMany({
    data: [...CONFIGS_PADRAO],
    skipDuplicates: true, // Idempotente: configs já existentes não são sobrescritas
  });

  if (resultado.count > 0) {
    console.log(`✅ [SiteConfigSeeder] ${resultado.count} configuração(s) nova(s) inserida(s).`);
  } else {
    console.log('✅ [SiteConfigSeeder] Todas as configurações já existiam. Nenhuma alteração feita.');
  }
}
