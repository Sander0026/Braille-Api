import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ContatosService } from './contatos.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CreateContatoDto } from './dto/create-contato.dto';
import { QueryContatoDto } from './dto/query-contato.dto';
import { AuditAcao, Role } from '@prisma/client';
import type { AuditUser } from '../common/interfaces/audit-user.interface';

// ── Dados de fixture ──────────────────────────────────────────────────────────

const MENSAGEM_FIXTURE = {
  id: 'uuid-test-001',
  nome: 'Ana Lima',
  email: 'ana@test.com',
  telefone: null,
  assunto: 'Dúvida',
  lida: false,
  criadoEm: new Date('2026-01-01T10:00:00Z'),
};

const MENSAGEM_COM_TEXTO = { ...MENSAGEM_FIXTURE, mensagem: 'Gostaria de saber mais.' };

const AUDIT_USER: AuditUser = {
  sub: 'user-uuid-admin',
  nome: 'Admin Teste',
  role: Role.ADMIN,
  ip: '127.0.0.1',
  userAgent: 'jest',
};

// ── Mocks ─────────────────────────────────────────────────────────────────────

const prismaMock = {
  mensagemContato: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

const auditMock = { registrar: jest.fn().mockResolvedValue(undefined) };

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('ContatosService', () => {
  let service: ContatosService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContatosService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuditLogService, useValue: auditMock },
      ],
    }).compile();

    service = module.get<ContatosService>(ContatosService);
  });

  // ── create ─────────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('deve persistir a mensagem e retornar os campos de detalhe', async () => {
      prismaMock.mensagemContato.create.mockResolvedValue(MENSAGEM_COM_TEXTO);

      const dto: CreateContatoDto = {
        nome: 'Ana Lima',
        email: 'ana@test.com',
        assunto: 'Dúvida',
        mensagem: 'Gostaria de saber mais.',
      };

      const result = await service.create(dto);

      expect(prismaMock.mensagemContato.create).toHaveBeenCalledWith(expect.objectContaining({ data: dto }));
      expect(result).toEqual(MENSAGEM_COM_TEXTO);
    });
  });

  // ── findAll ────────────────────────────────────────────────────────────────

  describe('findAll()', () => {
    it('deve retornar dados paginados e meta', async () => {
      prismaMock.mensagemContato.findMany.mockResolvedValue([MENSAGEM_FIXTURE]);
      prismaMock.mensagemContato.count.mockResolvedValue(1);

      const query: QueryContatoDto = { page: 1, limit: 20 };
      const result = await service.findAll(query);

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({ total: 1, page: 1, limit: 20, lastPage: 1 });
    });

    it('deve aplicar filtro `lida` quando fornecido', async () => {
      prismaMock.mensagemContato.findMany.mockResolvedValue([]);
      prismaMock.mensagemContato.count.mockResolvedValue(0);

      const query: QueryContatoDto = { page: 1, limit: 10, lida: true };
      await service.findAll(query);

      expect(prismaMock.mensagemContato.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { lida: true } }),
      );
    });

    it('deve executar findMany e count em paralelo (Promise.all)', async () => {
      const findManyOrder: string[] = [];
      prismaMock.mensagemContato.findMany.mockImplementation(async () => {
        findManyOrder.push('findMany');
        return [];
      });
      prismaMock.mensagemContato.count.mockImplementation(async () => {
        findManyOrder.push('count');
        return 0;
      });

      await service.findAll({ page: 1, limit: 20 });

      // Ambas as chamadas devem ter ocorrido
      expect(findManyOrder).toContain('findMany');
      expect(findManyOrder).toContain('count');
    });
  });

  // ── findOne ────────────────────────────────────────────────────────────────

  describe('findOne()', () => {
    it('deve retornar a mensagem quando existe', async () => {
      prismaMock.mensagemContato.findUnique.mockResolvedValue(MENSAGEM_COM_TEXTO);
      const result = await service.findOne('uuid-test-001');
      expect(result).toEqual(MENSAGEM_COM_TEXTO);
    });

    it('deve lançar NotFoundException quando a mensagem não existe', async () => {
      prismaMock.mensagemContato.findUnique.mockResolvedValue(null);
      await expect(service.findOne('id-inexistente')).rejects.toThrow(NotFoundException);
    });
  });

  // ── marcarComoLida ─────────────────────────────────────────────────────────

  describe('marcarComoLida()', () => {
    it('deve atualizar e registrar auditoria quando mensagem estava não lida', async () => {
      prismaMock.mensagemContato.findUnique.mockResolvedValue(MENSAGEM_COM_TEXTO);
      prismaMock.mensagemContato.update.mockResolvedValue({ id: 'uuid-test-001', lida: true });

      const result = await service.marcarComoLida('uuid-test-001', AUDIT_USER);

      expect(prismaMock.mensagemContato.update).toHaveBeenCalledWith(expect.objectContaining({ data: { lida: true } }));
      expect(auditMock.registrar).toHaveBeenCalledWith(expect.objectContaining({ acao: AuditAcao.MUDAR_STATUS }));
      expect(result.lida).toBe(true);
    });

    it('deve retornar a mensagem sem chamar update quando já estava lida (idempotente)', async () => {
      const jaLida = { ...MENSAGEM_COM_TEXTO, lida: true };
      prismaMock.mensagemContato.findUnique.mockResolvedValue(jaLida);

      const result = await service.marcarComoLida('uuid-test-001', AUDIT_USER);

      expect(prismaMock.mensagemContato.update).not.toHaveBeenCalled();
      expect(auditMock.registrar).not.toHaveBeenCalled();
      expect(result.lida).toBe(true);
    });

    it('deve lançar NotFoundException se a mensagem não existe', async () => {
      prismaMock.mensagemContato.findUnique.mockResolvedValue(null);
      await expect(service.marcarComoLida('id-invalido', AUDIT_USER)).rejects.toThrow(NotFoundException);
    });
  });

  // ── remove ─────────────────────────────────────────────────────────────────

  describe('remove()', () => {
    it('deve excluir a mensagem e registrar auditoria', async () => {
      prismaMock.mensagemContato.findUnique.mockResolvedValue(MENSAGEM_FIXTURE);
      prismaMock.mensagemContato.delete.mockResolvedValue(MENSAGEM_FIXTURE);

      await service.remove('uuid-test-001', AUDIT_USER);

      expect(prismaMock.mensagemContato.delete).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'uuid-test-001' } }),
      );
      expect(auditMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          acao: AuditAcao.EXCLUIR,
          oldValue: MENSAGEM_FIXTURE,
        }),
      );
    });

    it('deve lançar NotFoundException se a mensagem não existe', async () => {
      prismaMock.mensagemContato.findUnique.mockResolvedValue(null);
      await expect(service.remove('id-invalido', AUDIT_USER)).rejects.toThrow(NotFoundException);
    });
  });
});
