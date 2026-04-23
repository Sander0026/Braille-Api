import { Test, TestingModule } from '@nestjs/testing';

// Mocks the SanitizeHtmlPipe completely before importing the controller
// Prevents Jest from loading jsdom ESM modules which crashes the test suite
jest.mock('../common/pipes/sanitize-html.pipe', () => ({
  SanitizeHtmlPipe: jest.fn().mockImplementation(() => ({
    transform: jest.fn().mockImplementation((val) => val),
  })),
}));

import { SiteConfigController } from './site-config.controller';
import { SiteConfigService } from './site-config.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';

const mockService = {
  getAll: jest.fn().mockResolvedValue({}),
  getSecoes: jest.fn().mockResolvedValue({}),
  updateMany: jest.fn().mockResolvedValue(undefined),
};

describe('SiteConfigController', () => {
  let controller: SiteConfigController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SiteConfigController],
      providers: [{ provide: SiteConfigService, useValue: mockService }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<SiteConfigController>(SiteConfigController);
  });

  it('deve listar configs chamando getAll do service', async () => {
    expect(controller).toBeDefined();
    await controller.getAll();
    expect(mockService.getAll).toHaveBeenCalled();
  });
});
