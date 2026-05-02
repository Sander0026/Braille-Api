import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { INestApplication } from '@nestjs/common';

/**
 * Configura e monta o Swagger UI em /api/docs.
 *
 * Acesso em produção: https://braille-api-oieq.onrender.com/api/docs
 */
export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Braille API — ILBES')
    .setDescription(
      `## Sistema de Gestão do Instituto Luiz Braille do Espírito Santo

API REST construída com **NestJS**, **Prisma** e **PostgreSQL (Neon)**.

---

### Módulos disponíveis

| Módulo | Prefixo | Descrição |
|--------|---------|-----------|
| Auth | \`/auth\` | Login, refresh token, troca de senha, sessões |
| Usuários | \`/users\` | Gestão de funcionários administrativos |
| Beneficiários | \`/beneficiaries\` | Alunos — CRUD completo, importação e exportação |
| Turmas | \`/turmas\` | Oficinas, grade horária, matrículas e status |
| Frequências | \`/frequencias\` | Diário de chamada com abertura e fechamento |
| Atestados | \`/atestados\` | Documentos médicos e justificativas de falta |
| Laudos | \`/laudos\` | Histórico de laudos médicos dos alunos |
| Apoiadores | \`/apoiadores\` | Parceiros, ações, logos e certificados de honraria |
| Certificados | \`/modelos-certificados\` | Modelos PDF e emissão acadêmica |
| Comunicados | \`/comunicados\` | Notícias e avisos do site institucional |
| Fale Conosco | \`/contatos\` | Mensagens recebidas pelo formulário público |
| Conteúdo | \`/site-config\` | CMS — configurações visuais e seções da home |
| Dashboard | \`/dashboard\` | KPIs e estatísticas operacionais |
| Upload | \`/upload\` | Upload e remoção de arquivos via Cloudinary |
| Auditoria | \`/audit-log\` | Log imutável de todas as ações críticas |

---

### Autenticação

Todos os endpoints protegidos utilizam **Bearer JWT**.

1. Faça \`POST /auth/login\` para obter o \`accessToken\`
2. Clique em **Authorize** (🔒) e cole o token no campo \`Bearer <token>\`
3. Todas as requisições seguintes enviarão o header \`Authorization: Bearer <token>\` automaticamente

O token expira em **15 minutos**. Use \`POST /auth/refresh\` com o cookie \`refreshToken\` para renovar.

---

### Roles de acesso

| Role | Descrição |
|------|-----------|
| \`ADMIN\` | Acesso total — único com acesso a Usuários e Auditoria |
| \`SECRETARIA\` | Alunos, Turmas, Frequências, Certificados, Contatos |
| \`PROFESSOR\` | Dashboard + lançamento de chamada (apenas suas turmas) |
| \`COMUNICACAO\` | Comunicados, Apoiadores, Conteúdo do Site |
`,
    )
    .setVersion('1.0')
    .setContact(
      'Instituto Luiz Braille do Espírito Santo',
      'https://instituto-luizbraille.vercel.app',
      'admin@braille.com',
    )
    .setLicense('UNLICENSED', '')
    .addServer('https://braille-api-oieq.onrender.com/api', 'Produção (Render)')
    .addServer('http://localhost:3000/api', 'Desenvolvimento local')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Cole aqui o accessToken obtido em POST /auth/login',
      },
      'access-token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,   // mantém o token entre recarregamentos da página
      tagsSorter: 'alpha',          // ordena os grupos de endpoints alfabeticamente
      operationsSorter: 'alpha',    // ordena operações dentro de cada grupo
    },
  });
}
