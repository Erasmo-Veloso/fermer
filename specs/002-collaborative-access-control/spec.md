# Feature Specification: Collaborative Project Access Control

**Feature Branch**: `002-collaborative-access-control`

**Created**: 2026-05-24

**Status**: Draft

**Input**: User description: "Tornar o projeto colaborativo, mas com acesso apenas para quem for permitido."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Project Owner (Priority: P1)

Como criador do projeto, eu quero ser o dono do projeto para controlar quem pode entrar, sair e ver segredos.

**Why this priority**: Sem um dono explícito, não há base confiável para governar acesso nem revogar permissões.

**Independent Test**: Criar um projeto e verificar que o criador fica registrado como dono e pode gerir membros.

**Acceptance Scenarios**:

1. **Given** um utilizador autenticado, **When** ele cria um projeto, **Then** ele passa a ser o dono do projeto.
2. **Given** o dono do projeto, **When** ele gere membros, **Then** ele pode convidar, promover e revogar acesso.

---

### User Story 2 - Member Invitation (Priority: P1)

Como dono ou admin, eu quero convidar membros para o projeto para permitir colaboração controlada.

**Why this priority**: A colaboração depende de um fluxo de entrada seguro e deliberado.

**Independent Test**: Convidar um utilizador e verificar que o acesso só existe depois de ser permitido.

**Acceptance Scenarios**:

1. **Given** um dono ou admin, **When** ele convida um utilizador, **Then** o utilizador é associado ao projeto com um papel.
2. **Given** um utilizador convidado, **When** o convite é aceite ou efetivado, **Then** ele consegue aceder apenas aos recursos autorizados.

---

### User Story 3 - Role-Based Access (Priority: P1)

Como administrador do projeto, eu quero definir permissões por papel para limitar o que cada membro pode fazer.

**Why this priority**: Papéis são a forma principal de separar leitura, edição e gestão.

**Independent Test**: Atribuir `admin`, `developer` e `reader` e verificar que cada role tem acesso diferente.

**Acceptance Scenarios**:

1. **Given** um `reader`, **When** ele tenta modificar segredos, **Then** o acesso é negado.
2. **Given** um `developer`, **When** ele cria ou atualiza segredos, **Then** o acesso é permitido apenas dentro do âmbito autorizado.
3. **Given** um `admin`, **When** ele gere membros, **Then** o acesso é permitido.

---

### User Story 4 - Revocation (Priority: P1)

Como dono ou admin, eu quero remover membros e revogar acessos para bloquear utilizadores que não devem mais colaborar.

**Why this priority**: Revogação é essencial para segurança operacional e saída de membros.

**Independent Test**: Remover um membro e verificar que ele perde acesso imediatamente nas próximas requisições.

**Acceptance Scenarios**:

1. **Given** um membro removido, **When** ele acede a segredos, **Then** o servidor rejeita o pedido.
2. **Given** um utilizador revogado, **When** ele usa comandos do CLI, **Then** recebe uma mensagem clara de permissão negada.

---

### User Story 5 - Secret Access Scope (Priority: P1)

Como membro autorizado, eu quero acessar apenas os ambientes e segredos permitidos para a minha função.

**Why this priority**: O valor do produto depende de limitar acesso sem quebrar a colaboração.

**Independent Test**: Restringir um utilizador a um ambiente e verificar que outros ambientes ficam inacessíveis.

**Acceptance Scenarios**:

1. **Given** um projeto com múltiplos ambientes, **When** um membro pede segredos, **Then** apenas os ambientes autorizados são retornados.
2. **Given** um utilizador sem permissão, **When** ele pede um segredo, **Then** o payload do segredo não é exposto.

---

### User Story 6 - CLI Collaboration Commands (Priority: P2)

Como utilizador do CLI, eu quero gerir colaboração sem sair do terminal para convidar, listar e remover membros.

**Why this priority**: O fluxo principal deve ser rápido e consistente com a experiência CLI-first.

**Independent Test**: Executar comandos do CLI e validar que eles chamam a API correta.

**Acceptance Scenarios**:

1. **Given** um dono autenticado, **When** ele executa um comando de membros, **Then** o CLI executa a ação.
2. **Given** uma operação negada, **When** o CLI recebe 403, **Then** ele mostra uma mensagem amigável.

---

### User Story 7 - Auditability (Priority: P2)

Como dono do projeto, eu quero rastrear convites, remoções e acessos para auditar mudanças de permissão.

**Why this priority**: Auditoria é necessária para conformidade e investigação de incidentes.

**Independent Test**: Executar convites, remoções e acessos e verificar entradas no log.

**Acceptance Scenarios**:

1. **Given** uma mudança de permissão, **When** ela ocorre, **Then** um registo de auditoria é guardado.
2. **Given** um evento de acesso a segredo, **When** ele ocorre, **Then** são registados utilizador, dispositivo, ação e timestamp.

### Edge Cases

- Um utilizador convidado ainda não tem conta.
- Um convite expira antes de ser aceite.
- Um membro removido ainda tem cache local antigo.
- O dono tenta remover a si próprio.
- O projeto não tem membros além do dono.
- Existe conflito entre papéis e permissões por ambiente.
- O link local do projeto existe num clone, mas o utilizador já não tem acesso remoto.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Cada projeto MUST ter um dono explícito.
- **FR-002**: O sistema MUST suportar papéis: `owner`, `admin`, `developer`, `reader`.
- **FR-003**: O dono/admin MUST poder convidar membros.
- **FR-004**: O dono/admin MUST poder remover membros e revogar acesso.
- **FR-005**: O acesso MUST ser validado no servidor antes de retornar segredos.
- **FR-006**: O acesso MUST poder ser limitado por projeto e por ambiente.
- **FR-007**: O CLI MUST mostrar erros claros quando o utilizador não tiver permissão.
- **FR-008**: O sistema MUST registrar auditoria para convites, remoções e acessos.
- **FR-009**: Um membro removido MUST perder acesso nas próximas requisições.
- **FR-010**: Segredos MUST nunca ser expostos para utilizadores não autorizados.
- **FR-011**: O projeto local de cada dev MUST continuar independente por clone.
- **FR-012**: O `projectId` MUST não ser tratado como segredo, apenas como identificador.

### Key Entities _(include if feature involves data)_

- **Project**: recurso principal que agrupa membros, ambientes e segredos.
- **Membership**: vínculo entre utilizador e projeto com um papel.
- **Invite**: convite pendente para entrada no projeto.
- **Role**: define nível de permissão.
- **Environment**: escopo de segredos dentro do projeto.
- **AuditLog**: registo de ações de acesso e gestão.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Um novo membro consegue entrar no projeto e receber acesso em menos de 10 minutos.
- **SC-002**: 100% das requisições de segredo passam por checagem de permissão.
- **SC-003**: 0 segredos são retornados para utilizadores revogados.
- **SC-004**: 100% das mudanças de permissão geram auditoria.
- **SC-005**: O onboarding de um dev novo funciona sem partilhar `.env` por Git.

## Assumptions

- Cada clone local usa o seu próprio link/configuração.
- O `projectId` é partilhável; segredos não.
- O acesso é concedido pelo servidor, não pelo repositório.
- Convites podem começar simples, por `userId` ou email, e evoluir depois.
- O foco inicial é controlo de acesso seguro, não automação avançada de equipas.
