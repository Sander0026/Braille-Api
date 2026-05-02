import { Test, TestingModule } from '@nestjs/testing';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';

describe('UploadController', () => {
  let controller: UploadController;

  const mockUploadService = {
    uploadImage: jest.fn().mockResolvedValue({ url: 'http://mock.com/image.jpg' }),
    deleteFile: jest.fn().mockResolvedValue({ success: true, message: 'Arquivo excluído com sucesso.' }),
    uploadPdf: jest.fn().mockResolvedValue({ url: 'http://mock.com/doc.pdf' }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UploadController],
      providers: [{ provide: UploadService, useValue: mockUploadService }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<UploadController>(UploadController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
