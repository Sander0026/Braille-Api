import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { ComunicadosController } from './comunicados.controller';
import { ComunicadosService } from './comunicados.service';
import type { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';

// ── Mock do service — controller não deve ter lógica própria para testar ──────

const mockService = {
  create:  jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  update:  jest.fn(),
  remove:  jest.fn(),
};

// ── Fixture de request autenticado para simular o AuthGuard ──────────────────

const mockReq = {
  user:    { sub: 'user-uuid-1', nome: 'Admin Teste', role: Role.SECRETARIA },
  headers: { 'user-agent': 'jest/test' },
  socket:  { remoteAddress: '127.0.0.1' },
} as unknown as AuthenticatedRequest;

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('ComunicadosController', () => {
  let controller: ComunicadosController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ComunicadosController],
      providers:   [{ provide: ComunicadosService, useValue: mockService }],
    }).compile();

    controller = module.get<ComunicadosController>(ComunicadosController);
    jest.clearAllMocks();
  });

  it('deve ser instanciado', () => {
    expect(controller).toBeDefined();
  });

  // ── Rotas de escrita ─────────────────────────────────────────────────────────

  describe('create()', () => {
    it('deve delegar ao service com o DTO e o auditUser corretos', async () => {
      const dto = { titulo: 'Teste', conteudo: 'Conteúdo' };
      mockService.create.mockResolvedValue({ id: 'uuid-1', ...dto });

      await controller.create(dto as any, mockReq);

      expect(mockService.create).toHaveBeenCalledTimes(1);
      expect(mockService.create).toHaveBeenCalledWith(
        dto,
        expect.objectContaining({ sub: 'user-uuid-1' }),
      );
    });
  });

  describe('update()', () => {
    it('deve delegar ao service com o ID, DTO e auditUser corretos', async () => {
      const id  = 'uuid-comunicado-1';
      const dto = { titulo: 'Título Editado' };
      mockService.update.mockResolvedValue({ id, ...dto });

      await controller.update(id, dto as any, mockReq);

      expect(mockService.update).toHaveBeenCalledWith(
        id,
        dto,
        expect.objectContaining({ sub: 'user-uuid-1' }),
      );
    });
  });

  describe('remove()', () => {
    it('deve delegar ao service com o ID e o auditUser corretos', async () => {
      const id = 'uuid-comunicado-1';
      mockService.remove.mockResolvedValue({ id });

      await controller.remove(id, mockReq);

      expect(mockService.remove).toHaveBeenCalledWith(
        id,
        expect.objectContaining({ sub: 'user-uuid-1' }),
      );
    });
  });

  // ── Rotas públicas ───────────────────────────────────────────────────────────

  describe('findAll()', () => {
    it('deve delegar ao service com os parâmetros de query', async () => {
      mockService.findAll.mockResolvedValue({ data: [], total: 0, totalPages: 0 });

      await controller.findAll({ page: 2, limit: 5 });

      expect(mockService.findAll).toHaveBeenCalledWith({ page: 2, limit: 5 });
    });
  });

  describe('findOne()', () => {
    it('deve delegar ao service com o ID correto', async () => {
      const id = 'uuid-comunicado-1';
      mockService.findOne.mockResolvedValue({ id });

      await controller.findOne(id);

      expect(mockService.findOne).toHaveBeenCalledWith(id);
    });
  });
});
