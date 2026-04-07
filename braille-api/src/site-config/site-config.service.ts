import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditAcao } from '@prisma/client';
import { AuditUser } from '../common/interfaces/audit-user.interface';

// Valores padrão usados como fallback quando nao ha registro no banco
export const SITE_CONFIG_DEFAULTS: Record<string, string> = {
  nomeInstituto: 'Instituto Luiz Braille',
  slogan: 'Instituto de Educação Inclusiva',
  corPrimaria: '#f5c800',
  corTexto: '#1a1a00',
  logo: '',
  statAlunos: '300+',
  statAnos: '30+',
  statOficinas: '6',
};

export const SECAO_DEFAULTS: Record<string, Record<string, string>> = {
  hero: {
    titulo: 'Mais do que inclusão — transformação',
    tituloDestaque: 'transformação',
    descricao:
      'Há mais de 30 anos o Instituto Luiz Braille oferece educação, autonomia e oportunidades para pessoas com deficiência visual em nossa comunidade.',
    btnPrimario: 'Fale Conosco',
    btnSecundario: 'Conheça o Instituto',
  },
  missao: {
    titulo: 'Nossa Missão',
    paragrafo1:
      'O Instituto Luiz Braille é uma entidade sem fins lucrativos dedicada à reabilitação, educação e inclusão social de pessoas com deficiência visual. Oferecemos serviços gratuitos de qualidade, com profissionais especializados e compromisso com a dignidade de cada pessoa que nos procura.',
    paragrafo2:
      'Acreditamos que toda pessoa, independentemente de sua condição visual, tem o direito a uma vida plena, produtiva e com autonomia. Nosso trabalho é tornar esse direito real.',
    valores: JSON.stringify([
      { icon: '♿', titulo: 'Inclusão', desc: 'Ambientes e materiais 100% acessíveis para todos.' },
      { icon: '🤝', titulo: 'Gratuidade', desc: 'Todos os serviços são totalmente gratuitos.' },
      { icon: '🎓', titulo: 'Qualidade', desc: 'Professores qualificados e metodologias modernas.' },
      { icon: '❤️', titulo: 'Humanização', desc: 'Atendimento individual, respeitando cada história de vida.' },
    ]),
  },
  oficinas: {
    titulo: 'Nossas Oficinas',
    subtitulo: 'Atividades gratuitas para pessoas com deficiência visual de todas as idades.',
    cards: JSON.stringify([
      { icon: '⌨️', titulo: 'Informática Adaptada', desc: 'Uso de leitores de tela, Dosvox e acessibilidade digital.' },
      {
        icon: '📚',
        titulo: 'Alfabetização Braille',
        desc: 'Leitura e escrita no sistema braille para todas as idades.',
      },
      { icon: '🎵', titulo: 'Musicoterapia', desc: 'Desenvolvimento motor e emocional através da música.' },
      { icon: '🧶', titulo: 'Artesanato', desc: 'Tricô, crochê e marcenaria adaptados.' },
      { icon: '🧘', titulo: 'Atividade Física', desc: 'Yoga, pilates e caminhadas orientadas.' },
      { icon: '🎭', titulo: 'Teatro Inclusivo', desc: 'Expressão artística e desenvolvimento da autoestima.' },
    ]),
  },
  depoimentos: {
    titulo: 'O que nossos alunos dizem',
    items: JSON.stringify([
      {
        texto: 'O instituto mudou minha vida. Aprendi a usar computador e hoje trabalho numa empresa de tecnologia.',
        nome: 'Ana Claudia',
        idade: '34',
      },
      {
        texto: 'Aqui encontrei amigos, aprendi braille e recuperei minha independência depois de perder a visão.',
        nome: 'Roberto Lima',
        idade: '52',
      },
      {
        texto: 'As oficinas de música me deram confiança. Hoje toco em apresentações e me sinto realizada.',
        nome: 'Marcia Santos',
        idade: '28',
      },
    ]),
  },
  cta: {
    titulo: 'Pronto para começar?',
    descricao:
      'A inscrição é gratuita e pode ser feita online. Nossa equipe entrará em contato para agendar uma visita.',
    btnPrimario: 'Fale com a Secretaria',
    btnSecundario: 'Saiba Mais',
  },
};

@Injectable()
export class SiteConfigService {
  private readonly logger = new Logger(SiteConfigService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditLogService,
  ) {}

  // ── Configs gerais ──────────────────────────────────────
  async getAll(): Promise<Record<string, string>> {
    const rows = await this.prisma.siteConfig.findMany();
    const result = { ...SITE_CONFIG_DEFAULTS };
    for (const row of rows) result[row.chave] = row.valor;
    return result;
  }

  async updateMany(dados: Record<string, string>, auditUser: AuditUser): Promise<void> {
    const oldState = await this.getAll();
    const chaves = Object.keys(dados);

    try {
      await this.prisma.$transaction([
        this.prisma.siteConfig.deleteMany({ where: { chave: { in: chaves } } }),
        this.prisma.siteConfig.createMany({
          data: Object.entries(dados).map(([chave, valor]) => ({ chave, valor })),
        }),
      ]);
    } catch (error: any) {
      this.logger.error(
        `[Data Leak Guard] Falha catastrófica ao atualizar SiteConfig no BD: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Não foi possível atualizar as configurações gerais do site. Contate o suporte.',
      );
    }

    const newState = await this.getAll();

    this.auditService
      .registrar({
        entidade: 'ConteudoSite',
        registroId: 'ConfigGeral',
        acao: AuditAcao.ATUALIZAR,
        autorId: auditUser.sub,
        autorNome: auditUser.nome,
        autorRole: auditUser.role,
        ip: auditUser.ip,
        userAgent: auditUser.userAgent,
        oldValue: oldState,
        newValue: newState,
      })
      .catch((e) => this.logger.warn(`Falha na auditoria ao atualizar configs: ${e.message}`));
  }

  // ── Conteúdo das seções ─────────────────────────────────
  async getSecoes(): Promise<Record<string, Record<string, string>>> {
    const rows = await this.prisma.conteudoSecao.findMany();
    const result: Record<string, Record<string, string>> = {};

    // Inicializa com defaults
    for (const [secao, campos] of Object.entries(SECAO_DEFAULTS)) {
      result[secao] = { ...campos };
    }
    // Sobrescreve com valores do banco
    for (const row of rows) {
      if (!result[row.secao]) result[row.secao] = {};
      result[row.secao][row.chave] = row.valor;
    }
    return result;
  }

  async getSecao(secao: string): Promise<Record<string, string>> {
    const secoes = await this.getSecoes();
    return secoes[secao] ?? {};
  }

  async updateSecao(secao: string, dados: Record<string, string>, auditUser: AuditUser): Promise<void> {
    const oldState = await this.getSecao(secao);

    try {
      await this.prisma.$transaction([
        this.prisma.conteudoSecao.deleteMany({ where: { secao } }),
        this.prisma.conteudoSecao.createMany({
          data: Object.entries(dados).map(([chave, valor]) => ({ secao, chave, valor })),
        }),
      ]);
    } catch (error: any) {
      this.logger.error(
        `[Data Leak Guard] Falha na transação ao atualizar Seção ${secao}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Falha ao injetar a seção ${secao} no banco de dados. Transação abortada.`,
      );
    }

    const newState = await this.getSecao(secao);

    this.auditService
      .registrar({
        entidade: 'ConteudoSecao',
        registroId: secao,
        acao: AuditAcao.ATUALIZAR,
        autorId: auditUser.sub,
        autorNome: auditUser.nome,
        autorRole: auditUser.role,
        ip: auditUser.ip,
        userAgent: auditUser.userAgent,
        oldValue: oldState,
        newValue: newState,
      })
      .catch((e) => this.logger.warn(`Falha na auditoria da seção ${secao}: ${e.message}`));
  }
}
