import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';
import * as createDOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

const window = new JSDOM('').window;
const DOMPurify = (createDOMPurify as any).default || createDOMPurify;
const purify = DOMPurify(window as any);

@Injectable()
export class SanitizeHtmlPipe implements PipeTransform {
  transform(value: any, metadata: ArgumentMetadata) {
    // Só sanitizamos o corpo (body) da requisição
    if (metadata.type !== 'body') {
      return value;
    }
    return this.sanitizeRecursively(value);
  }

  private sanitizeRecursively(obj: any): any {
    if (typeof obj === 'string') {
      // Se for uma string JSON, sanitizamos o conteúdo interno e stringificamos novamente
      try {
        const parsed = JSON.parse(obj);
        if (typeof parsed === 'object' && parsed !== null) {
          return JSON.stringify(this.sanitizeRecursively(parsed));
        }
      } catch (e) {
        // Objeto ignorado (não é um JSON válido), continua o fluxo normal
        void e;
      }
      
      // Sanitizar HTML da string
      return purify.sanitize(obj, { 
        ALLOWED_TAGS: [
            'b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'div', 'img', 
            's', 'u', 'blockquote', 'code', 'pre'
        ], 
        ALLOWED_ATTR: ['href', 'target', 'src', 'alt', 'class', 'style', 'rel', 'data-list'] 
      });
    }
    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeRecursively(item));
    }
    if (typeof obj === 'object' && obj !== null) {
      const result: any = {};
      for (const key of Object.keys(obj)) {
        result[key] = this.sanitizeRecursively(obj[key]);
      }
      return result;
    }
    return obj;
  }
}
