/**
 * Validação de Documentos Fiscais Brasileiros
 *
 * Funções utilitárias para validação de CPF e CNPJ conforme o algoritmo
 * oficial da Receita Federal do Brasil.
 *
 * Uso:
 *   import { validarCpf, validarCnpj } from 'src/common/helpers/documento.helper';
 *
 *   validarCpf('123.456.789-09')  // true
 *   validarCnpj('11.222.333/0001-81') // true
 *
 * Estas funções são síncronas e não possuem dependências externas.
 * Podem ser usadas em qualquer service, pipe ou guard da aplicação.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Helpers internos
// ─────────────────────────────────────────────────────────────────────────────

/** Remove qualquer caractere que não seja dígito. */
function apenasDigitos(valor: string): string {
  return valor.replace(/\D/g, '');
}

/** Retorna true se todos os caracteres da string forem iguais. */
function todosIguais(valor: string): boolean {
  return valor.split('').every((c) => c === valor[0]);
}

// ─────────────────────────────────────────────────────────────────────────────
// CPF
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Valida um CPF conforme o algoritmo da Receita Federal.
 *
 * Aceita os formatos:
 *   - Com máscara:   "123.456.789-09"
 *   - Sem máscara:   "12345678909"
 *
 * Regras aplicadas:
 *   1. Falsos positivos rejeitados: CPFs com todos os dígitos iguais (ex: 111.111.111-11).
 *   2. Cálculo do 1º dígito verificador via Módulo 11 (pesos 10 → 2).
 *   3. Cálculo do 2º dígito verificador via Módulo 11 (pesos 11 → 2).
 *
 * @param cpf - CPF com ou sem formatação.
 * @returns `true` se o CPF for matematicamente válido, `false` caso contrário.
 */
export function validarCpf(cpf: string): boolean {
  const numeros = apenasDigitos(cpf);

  // Deve ter exatamente 11 dígitos
  if (numeros.length !== 11) return false;

  // Regra Zero: rejeitar sequências homogêneas (000...0, 111...1, etc.)
  if (todosIguais(numeros)) return false;

  const digitos = numeros.split('').map(Number);

  // ── 1º Dígito Verificador ──────────────────────────────────────────────────
  // Multiplica os 9 primeiros dígitos pelos pesos 10, 9, 8, ..., 2
  const soma1 = digitos.slice(0, 9).reduce((acc, dig, i) => acc + dig * (10 - i), 0);

  const resto1 = soma1 % 11;
  const digito1 = resto1 < 2 ? 0 : 11 - resto1;

  if (digitos[9] !== digito1) return false;

  // ── 2º Dígito Verificador ──────────────────────────────────────────────────
  // Multiplica os 10 primeiros dígitos (incluindo o 1º dígito verificador)
  // pelos pesos 11, 10, 9, ..., 2
  const soma2 = digitos.slice(0, 10).reduce((acc, dig, i) => acc + dig * (11 - i), 0);

  const resto2 = soma2 % 11;
  const digito2 = resto2 < 2 ? 0 : 11 - resto2;

  return digitos[10] === digito2;
}

// ─────────────────────────────────────────────────────────────────────────────
// CNPJ
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Valida um CNPJ conforme o algoritmo da Receita Federal.
 *
 * Aceita os formatos:
 *   - Com máscara:   "11.222.333/0001-81"
 *   - Sem máscara:   "11222333000181"
 *
 * Regras aplicadas:
 *   1. Falsos positivos rejeitados: CNPJs com todos os dígitos iguais.
 *   2. Cálculo do 1º dígito verificador (13º número):
 *      - Pesos: 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2 (12 pesos para 12 dígitos).
 *      - Módulo 11: resto < 2 → dígito = 0; resto ≥ 2 → dígito = 11 - resto.
 *   3. Cálculo do 2º dígito verificador (14º número):
 *      - Pesos: 6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2 (13 pesos para 13 dígitos).
 *      - Mesma regra do Módulo 11.
 *
 * @param cnpj - CNPJ com ou sem formatação.
 * @returns `true` se o CNPJ for matematicamente válido, `false` caso contrário.
 */
export function validarCnpj(cnpj: string): boolean {
  const numeros = apenasDigitos(cnpj);

  // Deve ter exatamente 14 dígitos
  if (numeros.length !== 14) return false;

  // Regra Zero: rejeitar sequências homogêneas
  if (todosIguais(numeros)) return false;

  const digitos = numeros.split('').map(Number);

  // Pesos para o 1º dígito verificador (aplicados sobre os 12 primeiros dígitos)
  const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  // ── 1º Dígito Verificador ──────────────────────────────────────────────────
  const soma1 = digitos.slice(0, 12).reduce((acc, dig, i) => acc + dig * pesos1[i], 0);

  const resto1 = soma1 % 11;
  const digito1 = resto1 < 2 ? 0 : 11 - resto1;

  if (digitos[12] !== digito1) return false;

  // Pesos para o 2º dígito verificador (aplicados sobre os 13 primeiros dígitos)
  const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  // ── 2º Dígito Verificador ──────────────────────────────────────────────────
  const soma2 = digitos.slice(0, 13).reduce((acc, dig, i) => acc + dig * pesos2[i], 0);

  const resto2 = soma2 % 11;
  const digito2 = resto2 < 2 ? 0 : 11 - resto2;

  return digitos[13] === digito2;
}
