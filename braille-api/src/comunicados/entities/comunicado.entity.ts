import { Prisma } from '@prisma/client';

/**
 * Tipo de resposta do comunicado inferido diretamente do Prisma.
 *
 * Garante que qualquer alteração no schema Prisma seja reflectida
 * automaticamente neste tipo — zero manutenção manual.
 *
 * Usado como tipo de retorno explícito nos métodos do ComunicadosService.
 */
export type ComunicadoResponse = Prisma.ComunicadoGetPayload<{
  select: {
    id:           true;
    titulo:       true;
    conteudo:     true;
    categoria:    true;
    fixado:       true;
    imagemCapa:   true;
    autorId:      true;
    criadoEm:     true;
    atualizadoEm: true;
    autor: { select: { nome: true } };
  };
}>;
