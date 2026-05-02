# Testes — Estratégia e Execução

---

# 1. Visão Geral

O projeto usa **Jest** como framework de testes, integrado via `@nestjs/testing`. A estratégia é de **testes unitários por módulo** (service + controller) com mocks do PrismaService.

---

# 2. Executar os Testes

```bash
# Todos os testes unitários
npm run test

# Modo watch (reexecuta ao salvar)
npm run test:watch

# Relatório de cobertura (HTML em coverage/)
npm run test:cov

# Testes end-to-end
npm run test:e2e

# Testar um arquivo específico
npx jest src/auth/auth.service.spec.ts

# Testar com nome de describe/it
npx jest --testNamePattern "deve criar usuário"
```

---

# 3. Estrutura dos Arquivos de Teste

```
src/
├── auth/
│   ├── auth.service.spec.ts       ← Testa AuthService isolado
│   ├── auth.controller.spec.ts    ← Testa AuthController com service mockado
│   └── auth.module.spec.ts        ← Testa configuração do módulo
├── turmas/
│   ├── turmas.service.spec.ts
│   └── turmas.controller.spec.ts
├── frequencias/
│   ├── frequencias.service.spec.ts
│   └── frequencias.controller.spec.ts
└── [demais módulos]/
    ├── *.service.spec.ts
    └── *.controller.spec.ts
```

---

# 4. Template de Teste de Service

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { MeuService } from './meu.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';

// Factory de mock do Prisma
function mockPrismaService() {
  return {
    minhaEntidade: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
  };
}

describe('MeuService', () => {
  let service: MeuService;
  let prisma: ReturnType<typeof mockPrismaService>;
  let auditService: jest.Mocked<AuditLogService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MeuService,
        { provide: PrismaService, useValue: mockPrismaService() },
        {
          provide: AuditLogService,
          useValue: { registrar: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    service = module.get<MeuService>(MeuService);
    prisma = module.get<PrismaService>(PrismaService) as any;
    auditService = module.get<AuditLogService>(AuditLogService) as any;
  });

  afterEach(() => jest.clearAllMocks());

  // ── Testes ─────────────────────────────────────────────────────────────────

  describe('findOne()', () => {
    it('deve retornar o registro quando encontrado', async () => {
      // Arrange
      const mockData = { id: 'uuid-123', nome: 'Teste' };
      prisma.minhaEntidade.findUnique.mockResolvedValue(mockData);

      // Act
      const result = await service.findOne('uuid-123');

      // Assert
      expect(result).toEqual(mockData);
      expect(prisma.minhaEntidade.findUnique).toHaveBeenCalledWith({
        where: { id: 'uuid-123' },
      });
    });

    it('deve lançar NotFoundException quando não encontrado', async () => {
      // Arrange
      prisma.minhaEntidade.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findOne('id-invalido')).rejects.toThrow(NotFoundException);
    });
  });
});
```

---

# 5. Template de Teste de Controller

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { MeuController } from './meu.controller';
import { MeuService } from './meu.service';

describe('MeuController', () => {
  let controller: MeuController;
  let service: jest.Mocked<MeuService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MeuController],
      providers: [
        {
          provide: MeuService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<MeuController>(MeuController);
    service = module.get<MeuService>(MeuService) as jest.Mocked<MeuService>;
  });

  it('deve delegar findAll() ao service', async () => {
    // Arrange
    const mockResult = { data: [], meta: { total: 0 } };
    service.findAll.mockResolvedValue(mockResult);

    // Act
    const result = await controller.findAll({});

    // Assert
    expect(service.findAll).toHaveBeenCalled();
    expect(result).toEqual(mockResult);
  });
});
```

---

# 6. Boas Práticas

### Padrão AAA (Arrange — Act — Assert)
```typescript
it('deve validar colisão de horário', async () => {
  // Arrange — prepara o cenário
  const gradeExistente = [{ dia: 'SEG', horaInicio: 840, horaFim: 960 }];
  prisma.turma.findMany.mockResolvedValue([{ gradeHoraria: gradeExistente }]);

  // Act — executa a ação
  const executar = () => service.create(dtoComColisao, auditUser);

  // Assert — verifica o resultado
  await expect(executar()).rejects.toThrow('colisão de horário');
});
```

### Nomear testes descritivamente
```typescript
// ✅ Bom
it('deve lançar ConflictException quando CPF já está cadastrado');
it('deve retornar 401 quando token está expirado');
it('deve fechar diário apenas para o dia atual quando role é PROFESSOR');

// ❌ Ruim
it('teste 1');
it('funciona');
it('CPF');
```

### Testar o comportamento, não a implementação
```typescript
// ✅ Testa o contrato (o que o método retorna)
expect(result.sucesso).toBe(true);
expect(result.processados).toBe(3);

// ❌ Testa implementação interna (frágil — quebra com refatoração)
expect(prisma.$transaction).toHaveBeenCalledTimes(1);
```

### Limpar mocks após cada teste
```typescript
afterEach(() => jest.clearAllMocks());
// ou globalmente em jest.config.js: clearMocks: true
```

---

# 7. Cobertura de Testes

```bash
npm run test:cov
# Gera relatório HTML em coverage/lcov-report/index.html
```

**Meta recomendada:** 70% de linhas nos services críticos:
- `AuthService`
- `TurmasService`
- `FrequenciasService`
- `BeneficiariesService`

**Métricas de cobertura:**
- **Statements:** % de declarações executadas
- **Branches:** % de branches if/else cobertas
- **Functions:** % de funções chamadas
- **Lines:** % de linhas executadas

---

# 8. Configuração (jest.config.js / package.json)

```json
"jest": {
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": "src",
  "testRegex": ".*\\.spec\\.ts$",
  "transform": { "^.+\\.(t|j)s$": "ts-jest" },
  "collectCoverageFrom": ["**/*.(t|j)s", "!**/*.spec.(t|j)s"],
  "coverageDirectory": "../coverage",
  "testEnvironment": "node"
}
```

---

# 9. Pontos de Atenção

> [!IMPORTANT]
> **Testes do AuthService:** Cuidado ao mockar bcrypt — `bcrypt.compare` é assíncrono. Use `jest.spyOn(bcrypt, 'compare').mockResolvedValue(true)`.

> [!NOTE]
> **PrismaService mock:** Não usar `prismaMock` de bibliotecas externas (como `jest-mock-extended`) — crie o mock manualmente por módulo para ter controle total e evitar problemas de tipagem.

> [!TIP]
> **Testes de scheduler (TurmasScheduler):** Instanciar o scheduler diretamente com `prisma` mockado e chamar `atualizarStatusPorData()` manualmente — sem esperar o cron.
