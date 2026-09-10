# Regras do Firestore — COMANDO STORE

Cole isto em **Firebase Console → Firestore Database → Regras**, substituindo o conteúdo padrão, e clique em "Publicar".

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    match /produtos/{doc} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /categorias/{doc} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /cupons/{doc} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /configuracoes/{doc} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /vendas/{doc} {
      allow read, write: if request.auth != null;
    }
    match /pedidos/{doc} {
      allow create: if true;
      allow read, update, delete: if request.auth != null;
    }
  }
}
```

**Modelo de segurança**: leitura pública (o site precisa exibir produtos/categorias/cupons sem exigir login), escrita somente para usuários autenticados (o admin logado em `admin.html`). A coleção `vendas` (registros do PDV/faturamento) é totalmente privada — leitura e escrita exigem login — pois é dado sensível do negócio que nunca deve aparecer no site público. A coleção `pedidos` (histórico de pedidos feitos pelo site) permite **criar** sem login (é o próprio cliente, no checkout, que grava o pedido) mas só o admin logado pode **ler, editar ou apagar** — isso é importante: sem essa restrição, qualquer pessoa poderia ver o nome, telefone e endereço de todos os clientes que já compraram.

## Criar o usuário admin

Em **Authentication → Users → Add user**, cadastre manualmente o e-mail e senha que serão usados para logar em `admin.html`. Não existe cadastro de usuário pela própria interface do admin — isso é proposital, para não deixar o painel aberto a qualquer pessoa.
