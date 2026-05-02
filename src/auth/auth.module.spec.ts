import { ConfigService } from '@nestjs/config';
import { obterJwtSecretObrigatorio } from './auth.module';

describe('obterJwtSecretObrigatorio', () => {
  it('deve retornar o segredo JWT quando configurado', () => {
    const configService = { get: jest.fn().mockReturnValue(' segredo ') } as unknown as ConfigService;

    expect(obterJwtSecretObrigatorio(configService)).toBe('segredo');
  });

  it('deve falhar no startup quando JWT_SECRET estiver ausente', () => {
    const configService = { get: jest.fn().mockReturnValue(undefined) } as unknown as ConfigService;

    expect(() => obterJwtSecretObrigatorio(configService)).toThrow('JWT_SECRET');
  });
});
