import { BadRequestException } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { UploadService } from './upload.service';

describe('UploadService', () => {
  const criarService = () => {
    const configService = { get: jest.fn().mockReturnValue('mock-api-key') };
    const auditLogService = { registrar: jest.fn().mockResolvedValue(undefined) };
    const service = new UploadService(configService as never, auditLogService as never);
    return { service, auditLogService };
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('bloqueia arquivo acima de 10MB antes do stream para o Cloudinary', async () => {
    const { service } = criarService();
    const file = {
      mimetype: 'application/pdf',
      size: 10 * 1024 * 1024 + 1,
      buffer: Buffer.alloc(1),
    } as Express.Multer.File;

    await expect(service.uploadPdf(file, 'braille_lgpd')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('remove arquivo usando publicId extraido de URL com transformacao e versao', async () => {
    const { service, auditLogService } = criarService();
    const destroy = jest
      .spyOn(cloudinary.uploader, 'destroy')
      .mockResolvedValueOnce({ result: 'not found' } as never)
      .mockResolvedValueOnce({ result: 'ok' } as never);

    const result = await service.deleteFile(
      'https://res.cloudinary.com/demo/image/upload/c_fill,w_500/v123/braille_lgpd/termo.pdf',
      { sub: 'user-1', nome: 'Admin', role: 'ADMIN' } as never,
    );

    expect(result.success).toBe(true);
    expect(destroy).toHaveBeenNthCalledWith(1, 'braille_lgpd/termo.pdf', { resource_type: 'image' });
    expect(destroy).toHaveBeenNthCalledWith(2, 'braille_lgpd/termo', { resource_type: 'image' });
    expect(auditLogService.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        entidade: 'Cloudinary_System',
        registroId: 'braille_lgpd/termo',
      }),
    );
  });

  it('bloqueia exclusao fora das pastas permitidas do sistema', async () => {
    const { service } = criarService();
    const destroy = jest.spyOn(cloudinary.uploader, 'destroy');

    await expect(
      service.deleteFile('https://res.cloudinary.com/demo/image/upload/v123/pasta_externa/arquivo.pdf'),
    ).rejects.toThrow('Arquivo fora das pastas permitidas do sistema.');

    expect(destroy).not.toHaveBeenCalled();
  });
});
