type EnvConfig = Record<string, unknown>;

type NodeEnv = 'development' | 'test' | 'production';

const NODE_ENVS_PERMITIDOS: NodeEnv[] = ['development', 'test', 'production'];

const VARIAVEIS_OBRIGATORIAS = [
  'DATABASE_URL',
  'DIRECT_URL',
  'JWT_SECRET',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
] as const;

const VARIAVEIS_OBRIGATORIAS_PRODUCAO = ['FRONTEND_URL', 'SENHA_PADRAO_USUARIO'] as const;

function asString(config: EnvConfig, key: string): string | undefined {
  const value = config[key];
  if (typeof value !== 'string') return undefined;

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function requireString(config: EnvConfig, key: string, errors: string[]): string | undefined {
  const value = asString(config, key);
  if (!value) {
    errors.push(`${key} é obrigatório.`);
    return undefined;
  }

  return value;
}

function parseNodeEnv(config: EnvConfig, errors: string[]): NodeEnv {
  const rawNodeEnv = asString(config, 'NODE_ENV') ?? 'development';

  if (!NODE_ENVS_PERMITIDOS.includes(rawNodeEnv as NodeEnv)) {
    errors.push(`NODE_ENV deve ser um destes valores: ${NODE_ENVS_PERMITIDOS.join(', ')}.`);
    return 'development';
  }

  return rawNodeEnv as NodeEnv;
}

function parsePositiveInteger(config: EnvConfig, key: string, defaultValue: number, errors: string[]): number {
  const rawValue = config[key];

  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return defaultValue;
  }

  const parsed = Number(rawValue);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    errors.push(`${key} deve ser um número inteiro positivo.`);
    return defaultValue;
  }

  return parsed;
}

function parsePort(config: EnvConfig, errors: string[]): number {
  const port = parsePositiveInteger(config, 'PORT', 3000, errors);

  if (port < 1 || port > 65535) {
    errors.push('PORT deve estar entre 1 e 65535.');
    return 3000;
  }

  return port;
}

function validateUrlIfPresent(config: EnvConfig, key: string, errors: string[]): void {
  const value = asString(config, key);
  if (!value) return;

  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) {
      errors.push(`${key} deve usar protocolo http ou https.`);
    }
  } catch {
    errors.push(`${key} deve ser uma URL válida.`);
  }
}

function validateProductionSecrets(config: EnvConfig, errors: string[]): void {
  const jwtSecret = asString(config, 'JWT_SECRET');
  const senhaPadraoUsuario = asString(config, 'SENHA_PADRAO_USUARIO');

  if (jwtSecret && jwtSecret.length < 32) {
    errors.push('JWT_SECRET deve ter pelo menos 32 caracteres em produção.');
  }

  if (senhaPadraoUsuario && senhaPadraoUsuario.length < 8) {
    errors.push('SENHA_PADRAO_USUARIO deve ter pelo menos 8 caracteres em produção.');
  }
}

export function validateEnv(config: EnvConfig): EnvConfig {
  const errors: string[] = [];
  const nodeEnv = parseNodeEnv(config, errors);

  for (const key of VARIAVEIS_OBRIGATORIAS) {
    requireString(config, key, errors);
  }

  if (nodeEnv === 'production') {
    for (const key of VARIAVEIS_OBRIGATORIAS_PRODUCAO) {
      requireString(config, key, errors);
    }

    validateProductionSecrets(config, errors);
  }

  validateUrlIfPresent(config, 'FRONTEND_URL', errors);

  const validatedConfig: EnvConfig = {
    ...config,
    NODE_ENV: nodeEnv,
    PORT: parsePort(config, errors),
    CACHE_TTL: parsePositiveInteger(config, 'CACHE_TTL', 300000, errors),
    THROTTLER_TTL: parsePositiveInteger(config, 'THROTTLER_TTL', 60000, errors),
    THROTTLER_LIMIT: parsePositiveInteger(config, 'THROTTLER_LIMIT', 30, errors),
  };

  if (errors.length > 0) {
    throw new Error(`Configuração de ambiente inválida:\n- ${errors.join('\n- ')}`);
  }

  return validatedConfig;
}
