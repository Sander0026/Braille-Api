export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === 'production';
}

export function requireProductionConfirmation(operationName: string, envVar: string): void {
  if (!isProductionRuntime()) return;

  if (process.env[envVar] === 'true') return;

  throw new Error(
    `[${operationName}] Execucao bloqueada em producao. ` +
      `Defina ${envVar}=true somente apos revisar o script, o banco alvo e o backup.`,
  );
}

export function hasCliFlag(flag: string): boolean {
  return process.argv.includes(flag);
}
