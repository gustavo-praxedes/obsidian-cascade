# Obsidian Cascade

O **Obsidian Cascade** é um plugin desenvolvido para transformar o Obsidian em um verdadeiro motor de produtividade. Ele integra uma visualização de calendário nativa a um sistema robusto de gestão de tarefas (agenda) e auto-organização de notas.

Seja para planejar suas semanas, estruturar projetos com múltiplas etapas ou gerenciar o fluxo de sub-tarefas, o Cascade automatiza e simplifica o que antes exigia esforço manual.

## 🌟 Principais Funcionalidades

### 📋 Gestão Inteligente de Hierarquia de Tarefas (Bottom-up)
O plugin entende a relação entre tarefas pais e filhas e sincroniza os status automaticamente:
- Marcar **todas** as sub-tarefas como concluídas marcará a tarefa pai como concluída (`x`).
- Se **qualquer** sub-tarefa for marcada como "em progresso" (`/`) ou apenas parte for concluída, a tarefa pai é alterada para "em progresso" (`/`).
- Marcar a tarefa pai como concluída automaticamente conclui todas as filhas.
- Desmarcar a tarefa pai volta todas as filhas para o status aberto.

### 🔲 Menu de Status e Checkboxes Customizáveis
Troque rapidamente os status de tarefas através de um prático menu de contexto interativo. Basta clicar com o botão direito do mouse em qualquer checkbox de tarefa:
- Traz embutidos os status padrão essenciais (To-do, In progress, Done, Cancelled, Forwarded, Scheduling).
- Permite a adição ilimitada de **Status Acessórios** customizados pelos usuários diretamente pelas configurações do Obsidian.
- Perfeita integração com temas que estilizam checkboxes baseados em tarefas (ex: Minimal Theme e snippets CSS).

### 🔄 Tarefas Recorrentes, Agendamentos e Migrações
Um sistema nativo focado no fluxo do tempo:
- Migração inteligente entre notas diárias, mensais e anuais.
- Tarefas pendentes de dias anteriores podem ser automaticamente levadas para frente de acordo com o limite de dias estipulado nas configurações.
- Auto-limpeza de tarefas agendadas que já expiraram.
- Suporte a leitura de um arquivo centralizado de tarefas recorrentes para repopular novos meses e anos.

### 📅 Calendário Integrado
Navegação fluida entre os dias de forma visual através de um painel de calendário nativo:
- Crie ou navegue facilmente para suas notas diárias com apenas um clique.
- Indicadores visuais (`dots`) informam em quais dias já existem registros na agenda.

### 📁 Normalização Automática de Notas
Garante a integridade e uniformidade do seu cofre:
- Renomeação automática de arquivos baseada em regras de formatação de data e hora.
- Remove acentos e converte textos para uppercase conforme desejado.
- Proteção e injeção automática de dados de Frontmatter (Data de criação e atualização automática).

## 🚀 Instalação
*(No futuro, você poderá encontrá-lo diretamente na aba de plugins comunitários do Obsidian.)*

### Instalação Manual
1. Baixe o último release (arquivos `main.js`, `styles.css`, `manifest.json`).
2. Cole os arquivos dentro da sua pasta do cofre no diretório: `.obsidian/plugins/obsidian-cascade/`.
3. Reinicie o Obsidian.
4. Vá em **Configurações > Plugins Comunitários** (desative o Modo Seguro se necessário) e ative o **Cascade**.

## ⚙️ Configuração
Ao ativar o plugin, acesse as configurações para ajustar as ferramentas ao seu fluxo:
- Defina os formatos de nomenclatura de arquivos desejados para as suas notas de log (Diário, Semanal, Mensal, Anual).
- Configure as pastas dos seus Templates.
- Selecione até quantos dias no passado o sistema deve buscar tarefas abertas perdidas.
- Cadastre novos símbolos no painel de **Status de checkbox**.

## 💡 Dica: Ícones de Checkbox Visual
O plugin faz a ponte lógica do texto para você. Para a experiência visual com ícones na tela (fogo, bandeiras, etc.), é recomendado utilizar o **Minimal Theme** (ou temas similares) que possuem renderização nativa para checkboxes com caracteres especiais, ou aplicar *CSS Snippets* customizados no seu Obsidian.