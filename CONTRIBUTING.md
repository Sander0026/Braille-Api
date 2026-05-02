# Guia de Contribuição — Braille-Api

---

## Filosofia

Este projeto prioriza **legibilidade, segurança e manutenibilidade** sobre cleverness. Código claro que qualquer dev entende em 5 minutos é sempre preferível a código "esperto" que demora 30 minutos para entender.

---

## Fluxo de Trabalho (Git)

### Branches

```
main         → produção (protegida — merge via PR somente)
develop      → integração (base para feature branches)
feat/nome    → nova funcionalidade
fix/nome     → correção de bug
docs/nome    → documentação
refactor/nome → refatoração sem mudança de comportamento
```

### Commits (Conventional Commits)

```
feat:     nova funcionalidade
fix:      correção de bug
docs:     documentação
refactor: refatoração sem mudança funcional
test:     adição ou correção de testes
chore:    tarefas de manutenção (deps, config)
```

**Exemplos:**
```
feat: adicionar endpoint de relatório de frequência por aluno
fix: corrigir colisão de fuso horário na exportação Excel
docs: documentar módulo de certificados
```

---

## Estrutura de um Módulo Padrão

```
src/nome-modulo/
├── nome-modulo.module.ts     ← Registro do módulo NestJS
├── nome-modulo.controller.ts ← Rotas HTTP (thin controller)
├── nome-modulo.service.ts    ← Regras de negócio
├── nome-modulo.scheduler.ts  ← Cron jobs (se houver)
├── nome-modulo.controller.spec.ts
├── nome-modulo.service.spec.ts
└── dto/
    ├── create-nome-modulo.dto.ts
    ├── update-nome-modulo.dto.ts
    └── query-nome-modulo.dto.ts
```

---

## Checklist para Novos Módulos

Ao criar um novo módulo, complete todos os itens:

- [ ] Criar `module.ts`, `controller.ts`, `service.ts`
- [ ] Registrar no `AppModule` (`src/app.module.ts`)
- [ ] Adicionar entidade no `ENTIDADE_MAP` em `audit.interceptor.ts`
- [ ] DTOs com `class-validator` e `class-transformer`
- [ ] Guards: `@UseGuards(AuthGuard)` em todas as rotas protegidas
- [ ] Roles: `@UseGuards(RolesGuard)` + `@Roles(...)` onde necessário
- [ ] Select cirúrgico: nenhuma query retorna `senha`, `refreshToken` ou tokens
- [ ] Testes unitários para service e controller
- [ ] Documentação em `docs/backend/modulos/nome-modulo.md`

---

## Padrões de Código

### Controllers: "Thin Controller"

Controllers devem ser **finos** — apenas:
1. Extrair dados da requisição
2. Chamar o service
3. Retornar a resposta

**Correto:**
```typescript
@Post()
create(@Body() dto: CreateTurmaDto, @Req() req: AuthenticatedRequest) {
  return this.turmasService.create(dto, req.user);
}
```

**Errado:** Lógica de negócio, queries ao Prisma, ou cálculos dentro do controller.

### Services: Regras de Negócio Aqui

Toda a lógica de negócio vive no service. Services podem:
- Injetar `PrismaService`, `AuditLogService`, `UploadService`
- Lançar exceções HTTP (`NotFoundException`, `BadRequestException`, etc.)
- Chamar outros services via injeção de dependência

### DTOs: Sempre Validados

```typescript
import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';

export class CreateTurmaDto {
  @IsString()
  @IsNotEmpty()
  nome: string;

  @IsOptional()
  @IsEnum(TurmaStatus)
  status?: TurmaStatus;
}
```

- `whitelist: true` no `ValidationPipe` global remove campos extras automaticamente
- `@IsOptional()` explícito para campos opcionais
- Nunca usar `any` nos DTOs

### SELECT Cirúrgico (Obrigatório)

```typescript
// ✅ Correto — select explícito
const user = await prisma.user.findUnique({
  where: { id },
  select: { id: true, nome: true, role: true },
});

// ❌ Errado — retorna senha e tokens
const user = await prisma.user.findUnique({ where: { id } });
```

**Regra:** Campos `senha`, `refreshToken`, `refreshTokenExpiraEm` NUNCA devem aparecer em respostas HTTP.

### Auditoria: Automática ou Manual

**Automática (padrão):** O `AuditInterceptor` captura toda mutação. Basta adicionar a entidade no `ENTIDADE_MAP`.

**Manual (quando necessário):** Use `@SkipAudit()` + chamar `auditService.registrar()` no service com `oldValue` e `newValue` precisos.

```typescript
// Registrar manualmente
await this.auditService.registrar({
  entidade: 'MinhaEntidade',
  registroId: registro.id,
  acao: AuditAcao.CRIAR,
  autorId: auditUser.sub,
  autorNome: auditUser.nome,
  autorRole: auditUser.role,
  newValue: registro,
});
```

### Tratamento de Exceções

```typescript
// ✅ Use exceções HTTP tipadas do NestJS
throw new NotFoundException('Registro não encontrado.');
throw new BadRequestException('Campo X é obrigatório.');
throw new ConflictException('CPF já cadastrado.');
throw new ForbiddenException('Sem permissão para esta ação.');

// ❌ Nunca
throw new Error('algo deu errado');
```

---

## Migrations (Banco de Dados)

```bash
# Criar nova migration em desenvolvimento
npx prisma migrate dev --name descricao_clara_da_mudanca

# Exemplos de nomes descritivos:
# add_campo_foto_perfil_aluno
# create_tabela_user_session
# add_index_frequencia_data_aula
```

**Regras:**
- **NUNCA** editar arquivos em `prisma/migrations/` existentes
- Cada mudança no schema → uma nova migration
- Testar migration em banco de desenvolvimento antes de comitar
- Em produção, rodar `npm run db:migrate:deploy` (nunca `migrate dev`)

---

## Testes

### Estrutura Obrigatória

```typescript
describe('MeuService', () => {
  let service: MeuService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        MeuService,
        { provide: PrismaService, useValue: mockPrismaService() },
      ],
    }).compile();
    service = module.get(MeuService);
    prisma = module.get(PrismaService);
  });

  describe('create()', () => {
    it('deve criar registro com sucesso', async () => {
      // Arrange
      prisma.meuModelo.create.mockResolvedValue(mockData);
      // Act
      const result = await service.create(dto);
      // Assert
      expect(result.id).toBe(mockData.id);
    });
  });
});
```

**Padrão AAA:** Arrange → Act → Assert.

**Meta de cobertura:** 70% de linhas em services críticos (auth, turmas, frequências, beneficiários).

---

## Pull Request

### Template de PR

```markdown
## O que este PR faz?
[Descrição clara da mudança]

## Tipo de mudança
- [ ] Nova funcionalidade
- [ ] Correção de bug
- [ ] Refatoração
- [ ] Documentação

## Checklist
- [ ] Testes passando (`npm run test`)
- [ ] Lint sem erros (`npm run lint`)
- [ ] Novo módulo adicionado ao ENTIDADE_MAP (se aplicável)
- [ ] Select cirúrgico em todas as queries (sem retornar senha/tokens)
- [ ] Documentação atualizada em `docs/backend/`
- [ ] Migration testada em banco de desenvolvimento
```

---

## Perguntas Frequentes

**Q: Devo usar `@SkipAudit()` ou deixar o interceptor capturar?**  
A: Deixar o interceptor capturar (comportamento padrão). Só use `@SkipAudit()` quando precisar de contexto adicional no audit (ex: `oldValue` específico da operação).

**Q: Posso usar `any` nos serviços?**  
A: Idealmente não. Em casos onde o TypeScript não consegue inferir o tipo (ex: `Prisma.AlunoUpdateInput`), use cast explícito com comentário explicativo.

**Q: Como adicionar cache em um endpoint?**  
A: O `CacheModule` está configurado globalmente. Use `@UseInterceptors(CacheInterceptor)` no controller e `@CacheKey()` + `@CacheTTL()` para configurar. O TTL padrão é `CACHE_TTL` do env (300s).

**Q: Como lidar com fuso horário em datas?**  
A: Sempre armazenar em UTC no banco. Para comparações com o dia de Brasília, use o padrão do `AuditLogService.midnightBrasilia()`: `toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })`.
