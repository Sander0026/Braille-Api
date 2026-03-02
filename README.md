# 📅 Cronograma de Desenvolvimento - Projeto Braille

Este cronograma detalha as entregas semanais até a data final do projeto (02/06/2026), com foco na construção de uma arquitetura acessível e robusta.

**Legenda de Status:**
- [ ] ⏳ Pendente
- [x] ✅ Concluído
- [~] 🚧 Em Andamento

---

## 🏗️ FASE 1: Fundação e Estrutura (Backend & Infra)

| Data Entrega | Tarefa / Entregável | Status |
| :--- | :--- | :---: |
| **17/02/2026** | **Configuração do Ambiente**<br>- Criar repositório Git<br>- Inicializar NestJS (Back) e Angular (Front)<br>- Configurar PostgreSQL no Neon.tech | [X] |
| **24/02/2026** | **Modelagem de Dados & Auth**<br>- Criar tabelas `Users` e `Beneficiaries`<br>- Implementar Login com JWT (NestJS)<br>- Definir Roles (Admin/Voluntário) | [X] |
| **03/03/2026** | **CRUD de Beneficiários**<br>- Criar API para cadastro de deficientes visuais<br>- Validar campos (nível de visão, emergência)<br>- Documentar rotas no Swagger | [X] |

## ⚙️ FASE 2: Backend Core e Lógica de Negócio

| Data Entrega | Tarefa / Entregável | Status |
| :--- | :--- | :---: |
| **10/03/2026** |  **Design System Acessível**<br>- Configurar Tailwind CSS (Alto Contraste)<br>- Instalar `@angular/cdk`<br>- Criar componentes base (Botão, Input) com `aria-label` | [ ] |
| **17/03/2026** | **Gestão de Atendimentos**<br>- Criar tabela `Appointments`<br>- Relacionar Beneficiário <-> Atendimento<br>- Rota de histórico por usuário | [ ] |
| **24/03/2026** | **Segurança e Validação**<br>- Implementar `Class-Validator`<br>- Tratamento de erros global (Exception Filters)<br>- Testes unitários básicos das rotas principais | [ ] |

## 👁️ FASE 3: Frontend e Integração Acessível

| Data Entrega | Tarefa / Entregável | Status |
| :--- | :--- | :---: |
| **31/03/2026** | **Estrutura de Navegação**<br>- Tela de Login integrada<br>- Implementar "Skip Links" (Pular conteúdo)<br>- Menu lateral navegável por teclado | [ ] |
| **07/04/2026** | **Cadastro Acessível**<br>- Formulário de beneficiários<br>- Feedback de validação com `LiveAnnouncer`<br>- Ordem de foco (Tab Index) revisada | [ ] |
| **14/04/2026** | **Listagem e Busca**<br>- Tabela de dados (Datagrid) acessível<br>- Filtros de pesquisa compatíveis com leitor de tela<br>- Paginação semântica | [ ] |
| **21/04/2026** | **Perfil e Histórico**<br>- Tela de detalhes do beneficiário<br>- Visualização de histórico de atendimentos<br>- Modais de confirmação com `FocusTrap` | [ ] |
| **28/04/2026** | **Refinamento Sensorial**<br>- Integração de sons de UI (Sucesso/Erro)<br>- Revisão de textos alternativos (`alt`)<br>- Testes manuais com NVDA/VoiceOver | [ ] |

## 🚀 FASE 4: Deploy, Polimento e Entrega Final

| Data Entrega | Tarefa / Entregável | Status |
| :--- | :--- | :---: |
| **05/05/2026** | **Hospedagem (Deploy)**<br>- Backend no Render.com<br>- Frontend na Vercel<br>- Configuração de variáveis de ambiente (Prod) | [ ] |
| **12/05/2026** | **Auditoria e Correções**<br>- Rodar Axe-core/Lighthouse<br>- Corrigir falhas de contraste e etiquetas ARIA<br>- Resolver bugs críticos | [ ] |
| **19/05/2026** | **Documentação Final**<br>- Finalizar `README.md` técnico<br>- Gravar vídeo demo com leitor de tela<br>- Preparar slides da apresentação | [ ] |
| **26/05/2026** | **Code Freeze**<br>- Congelamento de novas funcionalidades<br>- Testes finais de regressão<br>- Ensaio da apresentação | [ ] |
| **02/06/2026** | **🏁 ENTREGA DO PROJETO**<br>- Envio dos arquivos/links finais | [ ] |