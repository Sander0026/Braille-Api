import { Role } from '@prisma/client';
import 'reflect-metadata';
import { ROLES_KEY } from '../auth/roles.decorator';
import { RelatoriosController } from './relatorios.controller';

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
});
