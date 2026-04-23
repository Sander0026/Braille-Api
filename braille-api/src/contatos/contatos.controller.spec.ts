import { Test, TestingModule } from '@nestjs/testing';
import { ContatosController } from './contatos.controller';
import { ContatosService } from './contatos.service';
import { CreateContatoDto } from './dto/create-contato.dto';
import { CacheInterceptor } from '@nestjs/cache-manager';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { QueryContatoDto } from './dto/query-contato.dto';
import { Role } from '@prisma/client';
import type { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';

// ── Mock do Service ───────────────────────────────────────────────────────────

const serviceMock = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  marcarComoLida: jest.fn(),
  remove: jest.fn(),
};

// ── Helpers de teste ──────────────────────────────────────────────────────────

function buildRequest(overrides?: Partial<AuthenticatedRequest>): AuthenticatedRequest {
  return {
    user: {
      sub: 'user-uuid-admin',
      nome: 'Admin Teste',
      role: Role.ADMIN,
      email: 'admin@test.com',
    },
    headers: { 'user-agent': 'jest', 'x-forwarded-for': '10.0.0.1' },
    socket: { remoteAddress: '127.0.0.1' } as never,
    auditOldValue: undefined,
    ...overrides,
  } as AuthenticatedRequest;
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('ContatosController', () => {
  let controller: ContatosController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ContatosController],
      providers: [{ provide: ContatosService, useValue: serviceMock }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .overrideInterceptor(CacheInterceptor)
      .useValue({ intercept: (context: any, next: any) => next.handle() })
      .compile();

    controller = module.get<ContatosController>(ContatosController);
  });

  it('deve ser instanciado corretamente', () => {
    expect(controller).toBeDefined();
  });

  // ── create ─────────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('deve delegar ao service e retornar o resultado', async () => {
      const dto: CreateContatoDto = {
        nome: 'Maria Souza',
        email: 'maria@test.com',
        assunto: 'Matrícula',
        mensagem: 'Como faço para matricular meu filho?',
      };
      const esperado = { id: 'uuid-001', ...dto, lida: false };
      serviceMock.create.mockResolvedValue(esperado);

      const result = await controller.create(dto);

      expect(serviceMock.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(esperado);
    });
  });

  // ── findAll ────────────────────────────────────────────────────────────────

  describe('findAll()', () => {
    it('deve delegar ao service com os parâmetros de query corretos', async () => {
      const query: QueryContatoDto = { page: 2, limit: 10, lida: false };
      serviceMock.findAll.mockResolvedValue({ data: [], meta: { total: 0 } });

      await controller.findAll(query);

      expect(serviceMock.findAll).toHaveBeenCalledWith(query);
    });
  });

  // ── findOne ────────────────────────────────────────────────────────────────

  describe('findOne()', () => {
    it('deve delegar ao service com o id correto', async () => {
      serviceMock.findOne.mockResolvedValue({ id: 'uuid-001', assunto: 'Teste' });
      await controller.findOne('uuid-001');
      expect(serviceMock.findOne).toHaveBeenCalledWith('uuid-001');
    });
  });

  // ── marcarComoLida ─────────────────────────────────────────────────────────

  describe('marcarComoLida()', () => {
    it('deve extrair o auditUser da request e delegar ao service', async () => {
      serviceMock.marcarComoLida.mockResolvedValue({ id: 'uuid-001', lida: true });
      const req = buildRequest();

      await controller.marcarComoLida('uuid-001', req);

      expect(serviceMock.marcarComoLida).toHaveBeenCalledWith(
        'uuid-001',
        expect.objectContaining({ sub: 'user-uuid-admin', role: Role.ADMIN }),
      );
    });

    it('deve resolver o IP corretamente a partir de x-forwarded-for', async () => {
      serviceMock.marcarComoLida.mockResolvedValue({ id: 'uuid-001', lida: true });
      const req = buildRequest({ headers: { 'x-forwarded-for': '192.168.1.1, 10.0.0.1' } as never });

      await controller.marcarComoLida('uuid-001', req);

      expect(serviceMock.marcarComoLida).toHaveBeenCalledWith(
        'uuid-001',
        expect.objectContaining({ ip: '192.168.1.1' }),
      );
    });
  });

  // ── remove ─────────────────────────────────────────────────────────────────

  describe('remove()', () => {
    it('deve extrair o auditUser da request e delegar ao service', async () => {
      serviceMock.remove.mockResolvedValue({ id: 'uuid-001' });
      const req = buildRequest();

      await controller.remove('uuid-001', req);

      expect(serviceMock.remove).toHaveBeenCalledWith('uuid-001', expect.objectContaining({ sub: 'user-uuid-admin' }));
    });
  });
});
