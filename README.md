# 📅 Cronograma de Desenvolvimento - Projeto ILBES (Sistema Administrativo)

**Projeto:** Sistema de Gestão para o Instituto Luiz Braille, voltado ao atendimento de pessoas com deficiência visual.

**Adaptação de Escopo (Março/2026):** Inclusão de novos requisitos solicitados pelo cliente (Certificados Dinâmicos, Apoiadores, QR Code e Módulo de Ajuda), mantendo a data de entrega e Go-Live em 26/05/2026.

**Legenda de Status:**
- [X] ✅ Concluído
- [~] 🚧 Em Andamento / Parcialmente Feito
- [ ] ⏳ Pendente

---

## 🏗️ FASE 1 — Fundação e Estrutura (Semanas 1 e 2)
> 17/02/2026 a 03/03/2026 (Apresentadas e Validadas)

| Sprint | Data | Tarefa / Entregável | Status |
| :--: | :--- | :--- | :---: |
| 1.1 | **17/02/2026** | **Configuração do Ambiente e Repositórios**<br>- Criar repositório Git (Front e API)<br>- Inicializar projeto NestJS e Angular<br>- Configurar banco PostgreSQL no Neon.tech<br>- Configurar proxy e variáveis de ambiente | [X] |
| 1.2 | **24/02/2026** | **Modelagem de Dados e Autenticação**<br>- Definir schema Prisma completo<br>- Implementar Login com JWT no NestJS<br>- Definir Roles (ADMIN, SECRETARIA, PROFESSOR, COMUNICACAO)<br>- Tela de Login no Angular | [X] |
| 1.3 | **03/03/2026** | **CRUD de Beneficiários (Alunos)**<br>- Ficha completa: dados, contato, perfil da deficiência, socioeconômica<br>- Upload de foto de perfil e laudo médico (Cloudinary)<br>- Wizard de cadastro no Angular | [X] | 

---

## ⚙️ FASE 2 — Backend Core e Módulos de Negócio (Semanas 3, 4 e 5)
> 10/03/2026 a 31/03/2026

| Sprint | Data | Tarefa / Entregável | Status |
| :--: | :--- | :--- | :---: |
| 2.1 | **10/03/2026** | **Módulo de Oficinas/Turmas**<br>- API de Turmas (oficinas): criar, editar, listar<br>- Vinculação de aluno a uma ou mais turmas<br>- Suporte a múltiplas oficinas dinâmicas | [X] |
| 2.2 | **17/03/2026** | **Módulo de Frequência (Chamada)**<br>- API de Frequência: registrar presença/ausência<br>- Tela de frequências no Angular com filtros | [X] |
| 2.3 | **24/03/2026** | **Gestão de Usuários do Sistema**<br>- API para CRUD de usuários do painel<br>- Fluxo de redefinição de senha e upload de foto<br>- Controle de roles e permissões | [X] |
| 2.4 | **31/03/2026** | **Módulo de Comunicados e Notícias**<br>- API de Comunicados: criar, editar, publicar, fixar, categorizar<br>- Categorias: Notícia, Serviço, Vaga, Evento, etc.<br>- Upload de imagem de capa e tela de listagem | [~] |

---

## 👁️ FASE 3 — Site Público e Painel CMS (Semanas 6 e 7)
> 07/04/2026 a 14/04/2026

| Sprint | Data | Tarefa / Entregável | Status |
| :--: | :--- | :--- | :---: |
| 3.1 | **07/04/2026** | **Site Público (Vitrine Institucional)**<br>- Página Home com seções: hero, missão, oficinas, depoimentos<br>- Página Sobre e Página de Notícias<br>- Página de Contato com formulário "Fale Conosco" | [ ] |
| 3.2 | **14/04/2026** | **Painel CMS & Dashboard Administrativo**<br>- API de SiteConfig e ConteudoSecao para edição do site<br>- API de métricas e Tela de Dashboard com cards de resumo<br>- Navegação e menu lateral para o painel admin | [ ] |

---

## 🎓 FASE 4 — Expansão de Escopo: Certificados e Apoiadores (Semanas 8 e 9)
> 21/04/2026 a 28/04/2026

| Sprint | Data | Tarefa / Entregável | Status |
| :--: | :--- | :--- | :---: |
| 4.1 | **21/04/2026** | **Motor de Certificados e Editor Visual**<br>- Tela de criação de Modelos (Editor Drag & Drop, upload de arte, escala de fontes)<br>- Motor de geração de PDFs vetorizados no backend (`pdf-lib`) | [ ] |
| 4.2 | **28/04/2026** | **Apoiadores e Validação QR Code**<br>- Módulo de Apoiadores (Amigos do Braille)<br>- Botão "Emitir Certificado" no perfil do aluno/apoiador<br>- Motor de injeção de QR Code e Portal de Validação de Autenticidade | [ ] |

---

## 🎨 FASE 5 — Refinamento Visual e Acessibilidade (Semanas 10 e 11)
> 05/05/2026 a 12/05/2026

| Sprint | Data | Tarefa / Entregável | Status |
| :--: | :--- | :--- | :---: |
| 5.1 | **05/05/2026** | **Design System e Acessibilidade Avançada**<br>- Padronizar formulários, botões e modais de exclusão<br>- Revisão de tags `aria-label`, contraste WCAG AA<br>- Testes práticos com leitor de tela (NVDA) e navegação por teclado | [ ] |
| 5.2 | **12/05/2026** | **Relatórios e Exportação**<br>- Relatório de frequência por turma/período<br>- Relatório de beneficiários por tipo de deficiência<br>- Opção de exportação (PDF ou CSV) e filtros avançados | [ ] |

---

## 🚀 FASE 6 — Deploy, Manuais e Entrega Final (Semanas 12 e 13)
> 19/05/2026 a 26/05/2026

| Sprint | Data | Tarefa / Entregável | Status |
| :--: | :--- | :--- | :---: |
| 6.1 | **19/05/2026** | **Hospedagem, Deploy e Auditoria**<br>- Backend no Render.com e Frontend na Vercel (com HTTPS e domínio)<br>- Rodar Axe-core / Lighthouse e resolver bugs críticos (Regressão) | [ ] |
| 6.2 | **26/05/2026** | **Módulo de Ajuda e Documentação Final**<br>- Criação do módulo interno com manuais de uso para a secretaria<br>- Operação assistida (projeto rodando na instituição e feedbacks)<br>- **🏁 Code Freeze e Apresentação Final para a Banca Acadêmica** | [ ] |

---