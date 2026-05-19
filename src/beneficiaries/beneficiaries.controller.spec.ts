import { BeneficiariesController } from './beneficiaries.controller';
import { BeneficiariesService } from './beneficiaries.service';
import type { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';

describe('BeneficiariesController', () => {
  const service = {
    archivePermanently: jest.fn(),
    remove: jest.fn(),
  };

  let controller: BeneficiariesController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new BeneficiariesController(service as unknown as BeneficiariesService);
  });

  it('deve delegar a rota antiga /hard para arquivamento logico profundo', () => {
    const req = {
      user: { sub: 'user-1', nome: 'Admin', role: 'ADMIN' },
      headers: {},
      socket: {},
    } as AuthenticatedRequest;

    controller.archivePermanently(req, 'aluno-1');

    expect(service.archivePermanently).toHaveBeenCalledWith(
      'aluno-1',
      expect.objectContaining({ sub: 'user-1', nome: 'Admin', role: 'ADMIN' }),
    );
  });

  it('deve inativar aluno pela rota PATCH dedicada', () => {
    const req = {
      user: { sub: 'user-1', nome: 'Admin', role: 'ADMIN' },
      headers: {},
      socket: {},
    } as AuthenticatedRequest;
    const dto = {
      motivoInativacao: 'EVASAO_INSTITUCIONAL',
      encerrarMatriculasAtivas: true,
    } as never;

    controller.inativar(req, 'aluno-1', dto);

    expect(service.remove).toHaveBeenCalledWith(
      'aluno-1',
      dto,
      expect.objectContaining({ sub: 'user-1', nome: 'Admin', role: 'ADMIN' }),
    );
  });

  it('mantem DELETE legado apontando para a mesma regra de inativacao', () => {
    const req = {
      user: { sub: 'user-1', nome: 'Admin', role: 'ADMIN' },
      headers: {},
      socket: {},
    } as AuthenticatedRequest;
    const dto = {
      motivoInativacao: 'OUTRO',
      observacao: 'Endpoint legado',
      encerrarMatriculasAtivas: true,
    } as never;

    controller.remove(req, 'aluno-1', dto);

    expect(service.remove).toHaveBeenCalledWith(
      'aluno-1',
      dto,
      expect.objectContaining({ sub: 'user-1', nome: 'Admin', role: 'ADMIN' }),
    );
  });
});
