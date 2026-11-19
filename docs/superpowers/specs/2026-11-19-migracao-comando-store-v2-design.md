# Migração COMANDO STORE para arquitetura loja-online V2 — Design

**Spec para:** migrar o COMANDO STORE (loja de action figures G.I. Joe/Cobra, arquitetura V1 antiga —
arquivos soltos, `CONFIG_PADRAO` hardcoded em `script.js`, sem financeiro/PDV) para a arquitetura
`loja-online` (estoque, PDV com caixa, financeiro, acompanhamento de pedido, tema configurável pelo admin).
Mesmo padrão já aplicado em RA Modas, Manejo Mix, RA Suplementos e RA Moda Masculina.

## 1. Dados reais — reaproveitar tudo

Projeto Firebase real `comando-d3f02` já tem dados reais, confirmados via Firestore REST:

- **5 categorias**: `gijoe` (G.I. Joe), `cobra` (Cobra), `veiculos` (Veículos), `acessorios` (Acessórios), `kits` (Kits).
  Ícones já válidos no Font Awesome Free, só vêm com prefixo `"fa-solid "` que precisa ser removido
  (schema do loja-online guarda só a classe base, ex. `fa-skull`, e o template já prefixa `fa-solid`).
- **19 produtos**, todos com `disponivel: true`, nenhum com `destaque: true`, nenhum com `estoque`,
  `codigo`, `variantes` ou `precoAntigo` (recursos que não existiam na V1). Preços ora gravados como
  `integerValue`, ora `doubleValue` — normalizar para `Number` na migração.
- **2 cupons** (`COMANDO10`, `COBRA5`), ambos percentuais, 10%, sem mínimo. Campo antigo
  `valorMinimo` → novo campo `minimo`.
- **`configuracoes/geral` já existe** com `nomeLoja`, `whatsapp`, `retiradaHoraInicio/Fim`,
  `retiradaIntervalo`, `bannerUrl` (vazio). Diferente das migrações anteriores, aqui o doc já existe
  com valores reais — a migração faz **merge** (preserva esses valores, só adiciona os campos novos
  que faltam: cores do tema, `retiradaDias`), nunca sobrescreve do zero.
- Pasta `assets/` com as fotos reais dos produtos **não é tocada** — continua sendo referenciada pelos
  mesmos caminhos relativos (`./assets/categoria/arquivo.jpg`) que já estão gravados no campo `imagem`
  de cada produto.

## 2. Conjunto completo de módulos (igual RA Modas / RA Moda Masculina)

COMANDO STORE é uma loja real em operação (não é mostruário/demo), então leva o **conjunto completo**
de módulos do admin — `admin-financeiro.js` (contas a pagar/receber) e `admin-impressao.js` inclusos,
igual ao RA Modas e RA Moda Masculina. Lista de arquivos copiados de `../loja-online/` (mesma lista
usada na migração do RA Moda Masculina):

```
index.html, admin.html, acompanhar.html, manifest.webmanifest, manifest-admin.webmanifest, sw.js,
regras.md, css/style.css, css/admin.css, css/splash.css,
js/db.js, js/store.js, js/acompanhar.js, js/admin.js, js/admin-config.js, js/admin-estoque.js,
js/admin-clientes.js, js/admin-pdv.js, js/admin-financeiro.js, js/admin-impressao.js,
js/admin-relatorios.js, js/admin-camera.js, js/pwa.js, js/splash.js, js/vendor/qrcode.js,
icons/icon-180.png, icons/icon-192.png, icons/icon-512.png, icons/icon-maskable-512.png
```

Arquivos antigos removidos: `script.js`, `styles.css`, `produtos.js`, `manifest.json`.

## 3. Customização: ordenação manual de categorias (`ordem`)

Igual ao que foi portado para RA Suplementos e RA Moda Masculina: campo `ordem` por categoria,
comparador `porOrdem`/`porOrdemCat`, coluna/campo "Ordem" no admin, aplicado em `store.js` e `admin.js`.

A V1 já tinha uma ordem manual fixa no código (`ORDEM_PADRAO_CATEGORIAS = ["gijoe", "cobra",
"veiculos", "acessorios", "kits"]`), que será preservada como valores iniciais do campo `ordem`:

| categoria | ordem |
|---|---|
| gijoe | 1 |
| cobra | 2 |
| veiculos | 3 |
| acessorios | 4 |
| kits | 5 |

## 4. Customização nova: link externo "Ficha Técnica" no produto

Recurso que já existe na V1 e não tem equivalente no `loja-online` base: campo `link` no produto,
que mostra um botão "🔗 Ficha Técnica" abrindo uma página de referência externa (ex.: yojoe.com).
Como a usuária pediu para aproveitar tudo que a loja já tem, esse campo é portado para a nova
arquitetura:

- `js/db.js`: nenhuma mudança de schema necessária (campo livre, só precisa ser lido/escrito).
- `js/admin.js`: campo opcional "Link externo (ficha técnica, opcional)" no formulário de produto.
- `js/store.js`: no card do produto (modal de detalhes ou grade), se `p.link` existir, mostra um botão/link
  que abre em nova aba — mesmo estilo visual (🔗 + texto) que a V1 usava, adaptado ao CSS do loja-online.

Produtos sem `link` (a maioria dos cadastrados futuramente) simplesmente não mostram o botão.

## 5. Mapeamento de campos — migração de dados

**Categorias** (`categorias/{id}`): `nome` (igual), `icone` (remove prefixo `"fa-solid "`),
`ordem` (tabela da seção 3), `pai: null` (categorias são todas raiz).

**Produtos** (`produtos/{id}`):
- `nome`, `categoria`, `descricao`, `imagem` → copiados como estão.
- `preco` → `Number(d.preco) || 0`.
- `precoAntigo: null`, `custo: null`, `codigo: null`, `estoqueMinimo: null` (campos novos, sem dado antigo).
- `estoque: 0` (V1 não controlava estoque).
- `variantes: []`.
- `destaque: d.destaque === true` (hoje sempre `false`).
- `ativo: d.disponivel !== false`.
- `link: d.link || null` (ver seção 4).
- `criadoEm`: preserva o timestamp original.
- **Descartado**: `imagem2` (base64 de uma segunda foto, nunca usado pela V1 em lugar nenhum da UI —
  achado ao inspecionar `script.js`/`index.html`, não há onde essa imagem aparece no site).

**Cupons** (`cupons/{id}`): `codigo`, `tipo`, `valor`, `ativo`, `validade` → copiados como estão.
`minimo: d.minimo ?? d.valorMinimo ?? 0`.

**`configuracoes/geral`**: merge (nunca sobrescreve campos reais já existentes):
```js
const CONFIG_INICIAL = {
  nomeLoja: atual.nomeLoja || "COMANDO STORE",
  whatsapp: atual.whatsapp || "5586999211027",
  bannerUrl: atual.bannerUrl || "",
  corPrimaria: "#E5B80B",   // dourado vibrante — já era a cor de botões/destaques da V1
  corSecundaria: "#0F1A1A", // verde militar escuro — já era o fundo da V1
  corDestaque: "#B71C1C",   // vermelho — para tags de promoção/destaque (contraste forte com o dourado)
  retiradaDias: [0,1,2,3,4,5,6],
  retiradaHoraInicio: atual.retiradaHoraInicio || "08:00",
  retiradaHoraFim: atual.retiradaHoraFim || "18:00",
  retiradaIntervalo: atual.retiradaIntervalo || 60,
};
```

**`tiposVariacao`**: coleção antiga do modelo de variantes global — apagar se existir (não existe neste
projeto, mas o script de migração checa e remove por padrão, igual nas migrações anteriores).

## 6. Firebase / regras / admin

- `firebase-config.js` reescrito para `window.firebaseConfig = {...}` com as credenciais reais já
  existentes do projeto `comando-d3f02` (nenhuma credencial nova necessária).
- `regras.md` = regras padrão do `loja-online`, com `emailsAdmin()` retornando **`['admin@gmail.com']`**
  (decisão confirmada com a usuária — mesmo e-mail padrão já usado no RA Modas, RA Suplementos e
  RA Moda Masculina). A usuária cadastra esse e-mail em Authentication → Users e publica as regras
  manualmente (ela não tem acesso direto do Claude Code ao Firebase Console).
- `importar-produtos.html`: criado vazio (`PRODUTOS = []`), para cadastro futuro em massa, igual às
  migrações anteriores.

## 7. Banner

Fora de escopo desta migração — a usuária vai gerar o banner depois, com ajuda para o prompt de
imagem, do mesmo jeito que foi feito para RA Suplementos e RA Moda Masculina (banner-only, sem
carrossel "Em promoções" pedido aqui — não foi solicitado para este projeto).

## 8. Fora de escopo

- Sem "Em promoções" (não foi pedido para este projeto — só RA Suplementos e RA Moda Masculina tiveram).
- Sem necessidade de timing cuidadoso de corte (mesmo padrão já estabelecido: site antigo sai do ar,
  novo entra, sem período de transição).
- Deploy final via git push (hospedagem automática ligada ao GitHub, mesmo padrão dos projetos anteriores) —
  confirmar com a usuária antes do push, como de costume.
