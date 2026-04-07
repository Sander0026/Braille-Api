import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { ComunicadosService } from './comunicados.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { UploadService } from '../upload/upload.service';
import { AuditUser } from '../common/interfaces/audit-user.interface';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MOCK_AUDIT_USER: AuditUser = {
  sub:       'user-uuid-1',
  nome:      'Admin Teste',
  role:      Role.SECRETARIA,
  ip:        '127.0.0.1',
  userAgent: 'jest/test',
};

const MOCK_COMUNICADO = {
  id:           'uuid-comunicado-1',
  titulo:       'Comunicado Teste',
  conteudo:     'Conteúdo do comunicado',
  categoria:    null,
  fixado:       false,
  imagemCapa:   null,
  autorId:      'user-uuid-1',
  criadoEm:     new Date('2024-01-01'),
  atualizadoEm: new Date('2024-01-01'),
  autor:        { nome: 'Admin Teste' },
};

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockPrisma = {
  comunicado: {
    create:     jest.fn(),
    findMany:   jest.fn(),
    findUnique: jest.fn(),
    count:      jest.fn(),
    update:     jest.fn(),
    delete:     jest.fn(),
  },
};

const mockAuditService  = { registrar:   jest.fn().mockResolvedValue(undefined) };
const mockUploadService = { deleteFile: jest.fn().mockResolvedValue(undefined) };

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('ComunicadosService', () => {
  let service: ComunicadosService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ComunicadosService,
        { provide: PrismaService,   useValue: mockPrisma },
        { provide: AuditLogService, useValue: mockAuditService },
        { provide: UploadService,   useValue: mockUploadService },
      ],
    }).compile();

    service = module.get<ComunicadosService>(ComunicadosService);
    jest.clearAllMocks();
  });

  it('deve ser instanciado', () => {
    expect(service).toBeDefined();
  });

  // ── create() ────────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('deve criar o comunicado com o autorId do auditUser', async () => {
      mockPrisma.comunicado.create.mockResolvedValue(MOCK_COMUNICADO);

      const result = await service.create(
        { titulo: 'Teste', conteudo: 'Conteúdo' },
        MOCK_AUDIT_USER,
      );

      expect(mockPrisma.comunicado.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.comunicado.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ autorId: MOCK_AUDIT_USER.sub }),
        }),
      );
      expect(result.id).toBe(MOCK_COMUNICADO.id);
    });
  });

  // ── findAll() ───────────────────────────────────────────────────────────────

  describe('findAll()', () => {
    it('deve retornar dados paginados com totais corretos', async () => {
      mockPrisma.comunicado.findMany.mockResolvedValue([MOCK_COMUNICADO]);
      mockPrisma.comunicado.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it('deve calcular totalPages corretamente', async () => {
      mockPrisma.comunicado.findMany.mockResolvedValue([]);
      mockPrisma.comunicado.count.mockResolvedValue(25);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.totalPages).toBe(3);
    });
  });

  // ── findOne() ───────────────────────────────────────────────────────────────

  describe('findOne()', () => {
    it('deve retornar o comunicado quando encontrado', async () => {
      mockPrisma.comunicado.findUnique.mockResolvedValue(MOCK_COMUNICADO);

      const result = await service.findOne('uuid-comunicado-1');

      expect(result).toEqual(MOCK_COMUNICADO);
    });

    it('deve lançar NotFoundException quando o ID não existe', async () => {
      mockPrisma.comunicado.findUnique.mockResolvedValue(null);

      await expect(service.findOne('uuid-inexistente')).rejects.toThrow(NotFoundException);
    });
  });

  // ── update() ────────────────────────────────────────────────────────────────

  describe('update()', () => {
    it('deve atualizar e retornar o comunicado atualizado', async () => {
      const comunicadoAtualizado = { ...MOCK_COMUNICADO, titulo: 'Título Novo' };
      mockPrisma.comunicado.findUnique.mockResolvedValue(MOCK_COMUNICADO);
      mockPrisma.comunicado.update.mockResolvedValue(comunicadoAtualizado);

      const result = await service.update(
        'uuid-comunicado-1',
        { titulo: 'Título Novo' },
        MOCK_AUDIT_USER,
      );

      expect(result.titulo).toBe('Título Novo');
    });

    it('deve lançar NotFoundException se o comunicado não existir', async () => {
      mockPrisma.comunicado.findUnique.mockResolvedValue(null);

      await expect(
        service.update('uuid-inexistente', {}, MOCK_AUDIT_USER),
      ).rejects.toThrow(NotFoundException);
    });

    it('deve acionar remoção da imagem antiga quando a imagem for substituída', async () => {
      const comImagem = { ...MOCK_COMUNICADO, imagemCapa: 'https://cdn.example.com/old.jpg' };
      mockPrisma.comunicado.findUnique.mockResolvedValue(comImagem);
      mockPrisma.comunicado.update.mockResolvedValue({
        ...comImagem,
        imagemCapa: 'https://cdn.example.com/new.jpg',
      });

      await service.update(
        'uuid-comunicado-1',
        { imagemCapa: 'https://cdn.example.com/new.jpg' },
        MOCK_AUDIT_USER,
      );

      // Fire-and-forget: aguardar microtasks para o void promise resolver
      await Promise.resolve();
      expect(mockUploadService.deleteFile).toHaveBeenCalledWith('https://cdn.example.com/old.jpg');
    });
  });

  // ── remove() ────────────────────────────────────────────────────────────────

  describe('remove()', () => {
    it('deve remover o comunicado e retornar o resultado', async () => {
      mockPrisma.comunicado.findUnique.mockResolvedValue(MOCK_COMUNICADO);
      mockPrisma.comunicado.delete.mockResolvedValue(MOCK_COMUNICADO);

      const result = await service.remove('uuid-comunicado-1', MOCK_AUDIT_USER);

      expect(mockPrisma.comunicado.delete).toHaveBeenCalledWith({
        where: { id: 'uuid-comunicado-1' },
      });
      expect(result.id).toBe(MOCK_COMUNICADO.id);
    });

    it('deve lançar NotFoundException se o comunicado não existir', async () => {
      mockPrisma.comunicado.findUnique.mockResolvedValue(null);

      await expect(service.remove('uuid-inexistente', MOCK_AUDIT_USER)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
