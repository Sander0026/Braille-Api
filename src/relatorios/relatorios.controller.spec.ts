import { Role } from '@prisma/client';
import 'reflect-metadata';
import { ROLES_KEY } from '../auth/roles.decorator';
import type { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';
import { RelatoriosController } from './relatorios.controller';
import type { RelatoriosService } from './relatorios.service';

describe('RelatoriosController', () => {
  it('mantem relatorios detalhados restritos a ADMIN e SECRETARIA', () => {
    expect(Reflect.getMetadata(ROLES_KEY, RelatoriosController)).toEqual([Role.ADMIN, Role.SECRETARIA]);
  });

  it('permite PDF institucional para COMUNICACAO, ADMIN e SECRETARIA', () => {
    expect(Reflect.getMetadata(ROLES_KEY, RelatoriosController.prototype.exportarPdf)).toEqual([
      Role.ADMIN,
      Role.SECRETARIA,
      Role.COMUNICACAO,
    ]);
  });

  it('mantem XLSX detalhado bloqueado para COMUNICACAO', () => {
    expect(Reflect.getMetadata(ROLES_KEY, RelatoriosController.prototype.exportarXlsx)).toEqual([
      Role.ADMIN,
      Role.SECRETARIA,
    ]);
  });

  it('mantem GET /alunos como legado com limite de seguranca', () => {
    const service = {
      alunos: jest.fn(),
    };
    const controller = new RelatoriosController(service as unknown as RelatoriosService);
    const req = {
      user: { sub: 'admin-1', nome: 'Admin', role: Role.ADMIN },
    } as AuthenticatedRequest;
    const filtro = { statusAluno: 'TODOS' } as never;

    controller.alunos(filtro, req);

    expect(service.alunos).toHaveBeenCalledWith(filtro, req.user, { limiteDetalhes: 500 });
  });
});
