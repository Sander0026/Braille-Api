# 📅 Cronograma de Desenvolvimento - Projeto ILBES (Sistema Administrativo)

**Projeto:** Sistema de Gestão para o Instituto Luiz Braille, voltado ao atendimento de pessoas com deficiência visual.

**Legenda de Status:**
- [X] ✅ Concluído
- [~] 🚧 Em Andamento / Parcialmente Feito
- [ ] ⏳ Pendente

---

## 🏗️ FASE 1 — Fundação e Estrutura (Semanas 1 e 2)
> 17/02/2026 a 03/03/2026

| Sprint | Data | Tarefa / Entregável | Status |
| :--: | :--- | :--- | :---: |
| 1.1 | **17/02/2026** | **Configuração do Ambiente e Repositórios**<br>- Criar repositório Git (Front e API)<br>- Inicializar projeto NestJS (Backend)<br>- Inicializar projeto Angular (Frontend)<br>- Configurar banco PostgreSQL no Neon.tech<br>- Configurar proxy e variáveis de ambiente | [X] |
| 1.2 | **24/02/2026** | **Modelagem de Dados e Autenticação**<br>- Definir schema Prisma completo (Users, Alunos, Turmas, Frequencias, Comunicados, Contatos, SiteConfig)<br>- Criar enums (Role, TipoDeficiencia, CausaDeficiencia, PreferenciaAcessibilidade, CategoriaComunicado)<br>- Implementar Login com JWT no NestJS<br>- Definir Roles (ADMIN, SECRETARIA, PROFESSOR, COMUNICACAO)<br>- Implementar Auth Guard e Roles Guard<br>- Tela de Login no Angular integrada ao backend | [X] |
| 1.3 | **03/03/2026** | **CRUD de Beneficiários (Alunos)**<br>- API NestJS para cadastro completo de alunos com deficiência visual<br>- Ficha completa: dados identificadores, contato/localização, perfil da deficiência, situação socioeconômica, saúde/autonomia, preferências de acessibilidade<br>- Upload de foto de perfil e laudo médico (Cloudinary)<br>- Wizard de cadastro no Angular com formulário multi-etapas<br>- Listar, editar e desativar beneficiários no painel admin | [X] |

---

## ⚙️ FASE 2 — Backend Core e Módulos de Negócio (Semanas 3, 4 e 5)
> 10/03/2026 a 31/03/2026

| Sprint | Data | Tarefa / Entregável | Status |
| :--: | :--- | :--- | :---: |
| 2.1 | **10/03/2026** | **Módulo de Oficinas/Turmas**<br>- API de Turmas (oficinas): criar, editar, listar, ativar/desativar<br>- Vinculação de aluno a uma ou mais turmas<br>- Vinculação de professor responsável à turma<br>- Tela de listagem e cadastro de turmas no Angular<br>- Suporte a múltiplas oficinas dinâmicas (configuráveis pela coordenação) | [x] |
| 2.2 | **17/03/2026** | **Módulo de Frequência (Chamada)**<br>- API de Frequência: registrar presença/ausência por aluno, turma e data<br>- Restrição de duplicidade (mesmo aluno/turma/data)<br>- Tela de frequências no Angular com filtros por aluno e turma<br>- Relatório básico de frequência por período | [ ] |
| 2.3 | **24/03/2026** | **Gestão de Usuários do Sistema**<br>- API para CRUD de usuários (admin, secretaria, professor, comunicação)<br>- Fluxo de redefinição de senha no primeiro acesso<br>- Upload de foto de perfil<br>- Tela de listagem e cadastro de usuários no Angular<br>- Controle de roles e permissões | [ ] |
| 2.4 | **31/03/2026** | **Módulo de Comunicados e Notícias**<br>- API de Comunicados: criar, editar, publicar, fixar, categorizar, deletar<br>- Categorias: Notícia, Serviço, Vaga de Emprego, Evento Cultural, Legislação, Trabalho PCD, Geral<br>- Upload de imagem de capa<br>- Tela de listagem e criação de comunicados no Angular<br>- Integração com site público para exibição de notícias | [ ] |

---

## 👁️ FASE 3 — Site Público e Painel CMS (Semanas 6 e 7)
> 07/04/2026 a 21/04/2026

| Sprint | Data | Tarefa / Entregável | Status |
| :--: | :--- | :--- | :---: |
| 3.1 | **07/04/2026** | **Site Público (Vitrine Institucional)**<br>- Página Home com seções: hero, missão, valores, oficinas, depoimentos, CTA<br>- Página Sobre (informações institucionais)<br>- Página de Noticias (listagem e detalhe de comunicados públicos)<br>- Página de Contato com formulário "Fale Conosco"<br>- Layout responsivo com menu de navegação e rodapé | [ ] |
| 3.2 | **14/04/2026** | **Painel CMS — Conteúdo do Site**<br>- API de SiteConfig para personalização institucional (nome, logo, slogan, cores, estatísticas)<br>- API de ConteudoSecao para edição de todas as seções da home (hero, missão, valores, oficinas, depoimentos)<br>- Tela admin para editar o conteúdo do site sem precisar de código<br>- Configuração de contatos e redes sociais da instituição | [ ] |
| 3.3 | **21/04/2026** | **Dashboard Administrativo**<br>- API de métricas: total de alunos, turmas ativas, comunicados publicados<br>- Tela de Dashboard com cards de resumo de estatísticas do sistema<br>- Navegação e menu lateral para todo o painel admin | [ ] |

---

## 🎨 FASE 4 — Refinamento Visual e Acessibilidade (Semanas 8 e 9)
> 28/04/2026 a 12/05/2026

| Sprint | Data | Tarefa / Entregável | Status |
| :--: | :--- | :--- | :---: |
| 4.1 | **28/04/2026** | **Padronização Visual (Design System Admin)**<br>- Aplicar classes globais (`.form-input`, `.form-label`, `.btn`) em todos os formulários<br>- Padronizar os modais de confirmação de exclusão em todo o sistema<br>- Refinar responsividade de todas as telas do painel admin<br>- Novo layout da tela de login (card centralizado, logo, botão amarelo, ícones, ver senha) | [ ] |
| 4.2 | **05/05/2026** | **Acessibilidade Avançada**<br>- Revisão de `aria-label`, `aria-live`, `aria-required` em todos os formulários<br>- Garantir navegação completa por teclado (Tab order, Skip links)<br>- Testes com leitor de tela (NVDA / VoiceOver)<br>- Revisar textos alternativos (`alt`) em todas as imagens<br>- Verificar contraste de cores (WCAG AA mínimo) | [ ] |
| 4.3 | **12/05/2026** | **Relatórios e Exportação**<br>- Relatório de frequência por turma/período<br>- Relatório de beneficiários por tipo de deficiência<br>- Opção de exportação (PDF ou CSV) dos dados do sistema<br>- Filtros avançados de pesquisa nas listagens | [ ] |

---

## 🚀 FASE 5 — Deploy, Testes e Entrega Final (Semanas 10 e 11)
> 19/05/2026 a 26/05/2026

| Sprint | Data | Tarefa / Entregável | Status |
| :--: | :--- | :--- | :---: |
| 5.1 | **19/05/2026** | **Hospedagem e Deploy em Produção**<br>- Backend no Render.com (configuração de variáveis de produção)<br>- Frontend na Vercel ou Netlify<br>- Banco de dados Neon.tech em ambiente de produção<br>- Configuração de domínio e HTTPS | [ ] |
| 5.2 | **19/05/2026** | **Auditoria de Qualidade e Correções**<br>- Rodar Axe-core / Lighthouse para auditoria de acessibilidade<br>- Corrigir falhas de contraste e etiquetas ARIA<br>- Resolver bugs críticos encontrados em homologação<br>- Testes de regressão nas funcionalidades principais | [ ] |
| 5.3 | **26/05/2026** | **Documentação Final e Apresentação**<br>- Finalizar README técnico com instruções de instalação e uso<br>- Preparar slides da apresentação final<br>- Gravar vídeo demonstrativo (opcional: com leitor de tela)<br>- **🏁 Code Freeze — Congelamento do projeto e entrega final** | [ ] |

---
