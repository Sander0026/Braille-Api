import { BeneficiariesController } from './beneficiaries.controller';
import { BeneficiariesService } from './beneficiaries.service';
import type { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';

describe('BeneficiariesController', () => {
  const service = {
    archivePermanently: jest.fn(),
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
});
