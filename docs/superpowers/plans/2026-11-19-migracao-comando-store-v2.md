# Migração COMANDO STORE para arquitetura loja-online V2 — Plano

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans para implementar este
> plano tarefa por tarefa (execução inline, sem subagentes — mesmo padrão usado nas migrações
> anteriores desta linha de produtos).

**Goal:** Trocar a base de código do COMANDO STORE (V1, arquivos soltos) pela arquitetura
`loja-online` completa (estoque, PDV com caixa, financeiro, acompanhamento de pedido), preservando
100% dos dados reais (produtos, categorias, cupons, config) e dois recursos próprios da loja
(ordenação manual de categorias e link externo "Ficha Técnica" no produto).

**Architecture:** Copiar a árvore de arquivos do `../loja-online/` (conjunto completo de módulos,
igual RA Modas/RA Moda Masculina), portar as duas customizações (`ordem` e `link`), e migrar os
dados reais do Firestore via uma ferramenta HTML standalone (`migrar-dados.html`) que o navegador
da usuária executa uma vez, autenticado como admin.

**Tech Stack:** HTML/CSS/JS vanilla, Firebase (Firestore + Auth), compat SDK v8 (igual aos demais
projetos da linha).

**Spec:** `docs/superpowers/specs/2026-11-19-migracao-comando-store-v2-design.md`

## Global Constraints

- Conjunto completo de módulos (com `admin-financeiro.js` e `admin-impressao.js`) — não é mostruário.
- E-mail admin: `admin@gmail.com` (confirmado com a usuária).
- Pasta `assets/` (fotos reais dos produtos) nunca é tocada ou sobrescrita.
- `configuracoes/geral` já existe com dados reais — a migração faz merge, nunca sobrescreve do zero.
- Cores do tema: `corPrimaria #E5B80B`, `corSecundaria #0F1A1A`, `corDestaque #B71C1C`.
- Nenhum push para o GitHub sem confirmação explícita da usuária antes.

## Review Focus

- Produto sem `link` não deve mostrar nenhum vestígio do botão "Ficha Técnica" (string vazia vs. `null`
  vs. campo ausente — os três precisam ser tratados como "sem link").
- Preço gravado como inteiro vs. decimal no Firestore (`"200"` vs `"999.9"`) — todos devem virar
  `Number` válido depois da migração, nenhum `NaN` no carrinho/PDV.
- Categoria sem `ordem` definido (caso a usuária crie uma categoria nova depois) não deve quebrar a
  ordenação — precisa cair no fim da lista, não dar erro.
- Ícone de categoria com prefixo duplicado (`"fa-solid fa-solid fa-skull"`) se o script de migração
  rodar duas vezes por engano — a normalização precisa ser idempotente.
- Cupom `COMANDO10`/`COBRA5` continuar funcionando no checkout após a migração (campo `minimo`
  presente e numérico, não `undefined`).

---

### Task 1: Trocar a árvore de arquivos pela arquitetura loja-online completa

**Files:**
- Remove: `script.js`, `styles.css`, `produtos.js`, `manifest.json`
- Create (copiar de `../loja-online/`): `index.html`, `admin.html`, `acompanhar.html`,
  `manifest.webmanifest`, `manifest-admin.webmanifest`, `sw.js`, `css/style.css`, `css/admin.css`,
  `css/splash.css`, `js/db.js`, `js/store.js`, `js/acompanhar.js`, `js/admin.js`,
  `js/admin-config.js`, `js/admin-estoque.js`, `js/admin-clientes.js`, `js/admin-pdv.js`,
  `js/admin-financeiro.js`, `js/admin-impressao.js`, `js/admin-relatorios.js`, `js/admin-camera.js`,
  `js/pwa.js`, `js/splash.js`, `js/vendor/qrcode.js`, `icons/icon-180.png`, `icons/icon-192.png`,
  `icons/icon-512.png`, `icons/icon-maskable-512.png`
- Keep untouched: `assets/**`, `.git`, `.claude`, `.impeccable`, `.superpowers`

**Interfaces:**
- Produces: árvore de arquivos idêntica à do `loja-online`, pronta para receber as customizações
  das Tasks 2 e 3 e os dados migrados da Task 4.

- [ ] **Step 1:** Copiar todos os arquivos listados acima de `../loja-online/` para o diretório do
  COMANDO STORE, sobrescrevendo o que já existir.
- [ ] **Step 2:** Remover `script.js`, `styles.css`, `produtos.js`, `manifest.json`.
- [ ] **Step 3:** Verificar: `node --check js/db.js js/store.js js/admin.js js/admin-config.js
  js/admin-estoque.js js/admin-financeiro.js js/admin-impressao.js js/admin-clientes.js
  js/admin-pdv.js js/admin-relatorios.js js/admin-camera.js js/pwa.js js/splash.js
  js/vendor/qrcode.js js/acompanhar.js`
  Expected: nenhum erro de sintaxe.
- [ ] **Step 4:** Commit:
  ```bash
  git add -A -- ':!.superpowers'
  git commit -m "Troca a base de código pela arquitetura loja-online completa"
  ```

### Task 2: Portar a ordenação manual de categorias (`ordem`)

**Files:**
- Modify: `js/admin.js` (tela Categorias — listagem, coluna "Ordem", campo do formulário)
- Modify: `js/store.js` (`raizes()`/`filhosDe()` ou equivalente)

**Interfaces:**
- Consumes: nada de tasks anteriores (customização autocontida).
- Produces: campo `ordem` (number | null) lido/escrito em categorias; comparador que a Task 4 (dados)
  e a Task 5 (seed do Firestore) precisam respeitar nos valores que gravam.

- [ ] **Step 1:** Em `js/admin.js`, na tela de categorias: adicionar comparador
  `const porOrdem = (x, y) => (x.ordem ?? Infinity) - (y.ordem ?? Infinity) || x.nome.localeCompare(y.nome, "pt-BR");`,
  aplicar na ordenação de raízes/filhos exibidos na tabela, adicionar coluna "Ordem" e campo
  `<input name="ordem" type="number" value="${c.ordem ?? ""}">` no formulário de categoria, salvando
  `ordem: d.ordem.trim() === "" ? null : parseInt(d.ordem, 10)`.
- [ ] **Step 2:** Em `js/store.js`, aplicar o mesmo comparador (`porOrdemCat`) nas funções que listam
  categorias para a barra/grade de categorias da loja.
- [ ] **Step 3:** Verificar: `node --check js/admin.js js/store.js`
  Expected: nenhum erro de sintaxe.
- [ ] **Step 4:** Commit:
  ```bash
  git add js/admin.js js/store.js
  git commit -m "Porta ordenação manual de categorias (campo ordem) do RA Suplementos/RA Moda Masculina"
  ```

### Task 3: Portar o link externo "Ficha Técnica" do produto

**Files:**
- Modify: `js/admin.js` (formulário de produto)
- Modify: `js/store.js` (card/modal do produto)

**Interfaces:**
- Consumes: nada.
- Produces: campo `link` (string | null) no produto, que a Task 4 (migração de dados) precisa
  preencher a partir do campo antigo `link`.

- [ ] **Step 1:** Em `js/admin.js`, no formulário de produto: adicionar campo
  `<label>Link externo (ficha técnica, opcional)<input name="link" value="${esc(p.link || "")}" placeholder="https://..." /></label>`,
  e no objeto inicial (`id ? await DB.produtos.obter(id) : {...}`) incluir `link: ""`. No payload de
  salvar, incluir `link: d.link.trim() || null`.
- [ ] **Step 2:** Em `js/store.js`, no template do card/modal de detalhes do produto: se `p.link`
  existir (string não vazia), renderizar
  `<a href="${esc(p.link)}" target="_blank" rel="noopener" class="produto-link-externo"><i class="fa-solid fa-arrow-up-right-from-square"></i> Ficha Técnica</a>`;
  se não existir, não renderizar nada (string vazia, `null` e campo ausente tratados igual — usar
  `if (p.link) {...}`, nunca `if (p.link !== undefined)`).
- [ ] **Step 3:** Em `css/style.css`, adicionar uma regra simples `.produto-link-externo` (borda,
  padding, cor usando `var(--primaria)` ou equivalente do tema) para o botão não ficar sem estilo.
- [ ] **Step 4:** Verificar: `node --check js/admin.js js/store.js`
  Expected: nenhum erro de sintaxe. Conferir visualmente a regra CSS criada.
- [ ] **Step 5:** Commit:
  ```bash
  git add js/admin.js js/store.js css/style.css
  git commit -m "Adiciona link externo (ficha técnica) opcional no produto"
  ```

### Task 4: Configurar o Firebase do COMANDO STORE no formato do loja-online

**Files:**
- Modify: `firebase-config.js`
- `regras.md`: nenhuma edição de conteúdo necessária (já vem do loja-online com `emailsAdmin()` =
  `['admin@gmail.com']` por padrão — só confirmar).

**Interfaces:**
- Produces: `window.firebaseConfig` com as credenciais reais do projeto `comando-d3f02`.

- [ ] **Step 1:** Reescrever `firebase-config.js` para:
  ```js
  window.firebaseConfig = {
    apiKey: "AIzaSyASwgnj6XeG_6Z2tH_HdgGWACo_DOz_1wI",
    authDomain: "comando-d3f02.firebaseapp.com",
    projectId: "comando-d3f02",
    storageBucket: "comando-d3f02.firebasestorage.app",
    messagingSenderId: "289105606008",
    appId: "1:289105606008:web:4949794f097b41e064048d",
  };
  ```
- [ ] **Step 2:** Confirmar em `regras.md` que `emailsAdmin()` retorna `['admin@gmail.com']`
  (já é o padrão do `loja-online` copiado na Task 1 — só ler e confirmar, sem editar).
- [ ] **Step 3:** Verificar: `node --check firebase-config.js`
  Expected: nenhum erro de sintaxe.
- [ ] **Step 4:** Commit:
  ```bash
  git add firebase-config.js
  git commit -m "Configura o Firebase do COMANDO STORE no formato do loja-online"
  ```

### Task 5: Ferramenta de migração de dados (produtos/categorias/cupons/config)

**Files:**
- Create: `migrar-dados.html`

**Interfaces:**
- Consumes: campo `ordem` (Task 2) e `link` (Task 3) como destino da migração; `window.firebaseConfig`
  (Task 4) para conectar ao projeto certo.
- Produces: dados em `categorias`, `produtos`, `cupons`, `configuracoes/geral` no formato novo,
  prontos para o admin/loja funcionarem.

- [ ] **Step 1:** Criar `migrar-dados.html` — página standalone com botão "Migrar dados", que pede
  login (e-mail/senha do admin) antes de rodar, e faz:
  - **Categorias**: para cada doc em `categorias`, reescrever com
    `{ nome: d.nome, icone: (d.icone || "fa-tag").replace(/^fa-solid\s+/, ""), ordem: ORDEM[doc.id] ?? null, pai: null }`,
    onde `ORDEM = { gijoe: 1, cobra: 2, veiculos: 3, acessorios: 4, kits: 5 }`.
  - **Produtos**: para cada doc em `produtos`, reescrever com
    `{ nome: d.nome, categoria: d.categoria, descricao: d.descricao || "", imagem: d.imagem || "",
    preco: Number(d.preco) || 0, precoAntigo: null, custo: null, codigo: null, estoqueMinimo: null,
    estoque: 0, variantes: [], destaque: d.destaque === true, ativo: d.disponivel !== false,
    link: d.link || null, criadoEm: d.criadoEm || new Date().toISOString() }`
    — **sem** o campo `imagem2`.
  - **Cupons**: para cada doc em `cupons`, reescrever com
    `{ codigo: d.codigo, tipo: d.tipo, valor: d.valor, ativo: d.ativo, validade: d.validade ?? null,
    minimo: d.minimo ?? d.valorMinimo ?? 0 }`.
  - **Config**: ler `configuracoes/geral` atual (`atual`), gravar com merge:
    ```js
    const CONFIG_INICIAL = {
      nomeLoja: atual.nomeLoja || "COMANDO STORE",
      whatsapp: atual.whatsapp || "5586999211027",
      bannerUrl: atual.bannerUrl || "",
      corPrimaria: "#E5B80B", corSecundaria: "#0F1A1A", corDestaque: "#B71C1C",
      retiradaDias: [0,1,2,3,4,5,6],
      retiradaHoraInicio: atual.retiradaHoraInicio || "08:00",
      retiradaHoraFim: atual.retiradaHoraFim || "18:00",
      retiradaIntervalo: atual.retiradaIntervalo || 60,
    };
    ```
  - **Limpeza**: apagar a coleção `tiposVariacao` se existir (função `apagarColecao("tiposVariacao")`).
  - Mostrar na tela um log textual de cada etapa (ex.: "5 categorias migradas", "19 produtos
    migrados", "2 cupons migrados", "configuração atualizada", "tiposVariacao: nenhum documento").
- [ ] **Step 2:** Verificar: `node --check migrar-dados.html` não aplica (é HTML); em vez disso,
  extrair o bloco `<script>` para um arquivo temporário e rodar `node --check` nele.
  Expected: nenhum erro de sintaxe.
- [ ] **Step 3:** Commit:
  ```bash
  git add migrar-dados.html
  git commit -m "Adiciona utilitário de migração de produtos/categorias/cupons/config"
  ```

### Task 6: Ferramenta de importação em massa (vazia, para uso futuro)

**Files:**
- Create: `importar-produtos.html`

**Interfaces:**
- Consumes: `window.firebaseConfig` (Task 4).

- [ ] **Step 1:** Criar `importar-produtos.html` igual ao padrão das migrações anteriores: array
  `const PRODUTOS = [];` vazio, comentário com os ids de categoria disponíveis
  (`"gijoe", "cobra", "veiculos", "acessorios", "kits"`), botão "Importar" que faz
  `fs.collection("produtos").add(...)` para cada item do array.
- [ ] **Step 2:** Verificar: `node --check` no bloco `<script>` extraído.
  Expected: nenhum erro de sintaxe.
- [ ] **Step 3:** Commit:
  ```bash
  git add importar-produtos.html
  git commit -m "Adiciona ferramenta de importação em massa de produtos"
  ```

### Task 7: Verificação, instruções para a usuária e deploy final

**Files:**
- Modify: `sw.js` (bump de versão do cache)

**Interfaces:**
- Consumes: tudo das tasks anteriores — esta é a tarefa de fechamento.

- [ ] **Step 1:** Ler `sw.js`, localizar a constante de versão do cache e incrementar
  (ex.: `"loja-v13"` → `"loja-v14"`, ou o valor que já vier copiado do `loja-online`).
- [ ] **Step 2:** Commit:
  ```bash
  git add sw.js
  git commit -m "Prepara deploy: bump de versão do service worker"
  ```
- [ ] **Step 3:** Dizer à usuária os 3 passos manuais, na ordem (mesmo padrão das migrações
  anteriores): (1) cadastrar `admin@gmail.com` em Authentication → Users; (2) publicar o conteúdo de
  `regras.md` em Firestore → Regras; (3) abrir `migrar-dados.html` no navegador, logar e clicar em
  "Migrar dados".
- [ ] **Step 4:** Depois que ela confirmar os 3 passos, verificar os dados migrados via Firestore
  REST (categorias com `ordem` e ícone sem `fa-solid` duplicado; produtos com `preco` numérico,
  `estoque: 0`, sem `imagem2`; cupons com `minimo`; `configuracoes/geral` com as cores novas e os
  valores reais preservados).
  Expected: todos os campos no formato da seção 5 da spec.
- [ ] **Step 5:** Pedir para a usuária abrir `admin.html` e `index.html` e confirmar visualmente que
  tudo aparece (produtos, categorias na ordem certa, cupons, PDV/financeiro).
- [ ] **Step 6:** Confirmar com a usuária se pode dar `git push` (hospedagem automática ligada ao
  GitHub) antes de enviar.
  Expected: confirmação explícita antes do push.
- [ ] **Step 7:** `git push`.
  Expected: push aceito sem conflito.

---

## Completion

Depois da Task 7, a usuária tem o COMANDO STORE rodando na arquitetura `loja-online` completa, com
os 19 produtos, 5 categorias (na ordem original), 2 cupons e a config real preservados, mais os dois
recursos próprios da loja (ordenação manual de categorias e link externo "Ficha Técnica") portados.
Falta só o banner, que ela vai gerar depois com ajuda para o prompt — fora do escopo deste plano.
