import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';
import { JSDOM } from 'jsdom';
import type { WindowLike } from 'dompurify';

// ── DOMPurify — interoperabilidade CJS/ESM + Node.js ─────────────────────────
// eslint-disable-next-line @typescript-eslint/no-require-imports
const createDOMPurify = require('dompurify') as (window: WindowLike) => typeof import('dompurify');

// Instância singleton do DOMPurify com janela JSDOM — criada uma única vez no módulo.
// Elimina o overhead de new JSDOM() a cada requisição.
const { window } = new JSDOM('');
const purify = createDOMPurify(window as unknown as WindowLike);

const ALLOWED_TAGS: string[] = [
  'b',
  'i',
  'em',
  'strong',
  'a',
  'p',
  'br',
  'ul',
  'ol',
  'li',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'span',
  'div',
  'img',
  's',
  'u',
  'blockquote',
  'code',
  'pre',
];

const ALLOWED_ATTR: string[] = ['href', 'target', 'src', 'alt', 'class', 'style', 'rel', 'data-list'];

/**
 * Pipe global de sanitização de HTML.
 *
 * Aplicado ao Body de todas as requisições — remove tags e atributos não permitidos
 * usando DOMPurify com JSDOM (ambiente server-side).
 *
 * Suporta payloads aninhados (objetos e arrays recursivos).
 * Strings que são JSON válido são parseadas, sanitizadas e re-serializadas.
 *
 * Não interfere em parâmetros de rota/query (apenas metadata.type === 'body').
 */
@Injectable()
export class SanitizeHtmlPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    if (metadata.type !== 'body') return value;
    return sanitizeRecursively(value);
  }
}

// ── Funções puras (fora da classe para melhor testabilidade) ──────────────────

/**
 * Sanitiza recursivamente um valor desconhecido:
 * - string: sanitiza HTML (tenta parse JSON se aplicável)
 * - array:  mapeia cada elemento
 * - objeto: copia com cada valor sanitizado
 * - outros: retorna sem modificação
 */
function sanitizeRecursively(obj: unknown): unknown {
  if (typeof obj === 'string') return sanitizeString(obj);
  if (Array.isArray(obj)) return obj.map(sanitizeRecursively);
  if (isPlainObject(obj)) return sanitizeObject(obj);
  return obj;
}

/** Type guard: verifica se o valor é um objeto literal simples (não null, não array). */
function isPlainObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

/** Sanitiza um objeto literal, processando cada valor recursivamente. */
function sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    result[key] = sanitizeRecursively(obj[key]);
  }
  return result;
}

/**
 * Sanitiza uma string.
 * Se a string for JSON válido contendo um objeto/array, sanitiza a estrutura interna.
 * Caso contrário, aplica sanitização HTML direta com DOMPurify.
 */
function sanitizeString(value: string): unknown {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (isPlainObject(parsed) || Array.isArray(parsed)) {
      return JSON.stringify(sanitizeRecursively(parsed));
    }
  } catch {
    // Não é JSON válido — flui para sanitização HTML normal
  }
  return purify.sanitize(value, { ALLOWED_TAGS, ALLOWED_ATTR });
}
