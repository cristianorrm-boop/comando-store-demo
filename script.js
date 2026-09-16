document.addEventListener("DOMContentLoaded", async () => {

    // ===== FIREBASE =====
    firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore();

    const CONFIG_PADRAO = {
        nomeLoja: "COMANDO STORE",
        whatsapp: "5586999211027",
        bannerUrl: "",
        retiradaHoraInicio: "08:00",
        retiradaHoraFim: "18:00",
        retiradaIntervalo: 60
    };

    // Ordem padrão de exibição das categorias originais — usada como critério de
    // desempate para categorias que ainda não têm um campo "ordem" definido no admin.
    const ORDEM_PADRAO_CATEGORIAS = ["gijoe", "cobra", "veiculos", "acessorios", "kits"];

    const posicaoCategoria = (c) => {
        if (typeof c.ordem === "number") return c.ordem;
        const idx = ORDEM_PADRAO_CATEGORIAS.indexOf(c.id);
        return idx === -1 ? 9999 : 1000 + idx;
    };

    const compararCategorias = (a, b) => {
        const diff = posicaoCategoria(a) - posicaoCategoria(b);
        return diff !== 0 ? diff : (a.nome || "").localeCompare(b.nome || "");
    };

    // ===== VARIÁVEIS =====
    const cartIcon = document.querySelector(".cart-icon");
    const cartSidebar = document.querySelector(".cart-sidebar");
    const cartOverlay = document.querySelector(".cart-overlay");
    const closeCartBtn = document.querySelector(".close-cart-btn");
    const cartBody = document.querySelector(".cart-body");
    const cartBadge = document.querySelector(".cart-badge");
    const categoriesBar = document.querySelector(".categories-bar");
    const searchInput = document.querySelector(".search-input");
    const finishOrderBtn = document.getElementById("finish-order-btn");
    const viewCartBanner = document.querySelector(".view-cart-banner");
    const bannerTotalElem = document.getElementById("banner-total");
    const viewCartBannerBtn = document.querySelector(".view-cart-banner-btn");
    const subtotalElem = document.getElementById("cart-subtotal");
    const totalElem = document.getElementById("cart-total");
    const deliveryToggleBtns = document.querySelectorAll(".delivery-btn");
    const deliveryForm = document.getElementById("delivery-form-container");
    const pickupForm = document.getElementById("pickup-form-container");
    const pickupTimeSelect = document.getElementById("pickup-time");
    const trocoContainer = document.getElementById("troco-container");
    const couponInput = document.getElementById("coupon-input");
    const applyCouponBtn = document.getElementById("apply-coupon-btn");
    const couponFeedback = document.getElementById("coupon-feedback");
    const cartDiscountElem = document.getElementById("cart-discount");
    const discountLineElem = document.querySelector(".discount-line");

    let produtos = [];
    let categorias = [];
    let validCoupons = [];
    let configLoja = { ...CONFIG_PADRAO };

    let carrinho = [];
    let categoriaAtiva = "all";
    let termoBusca = "";
    let tipoEntrega = "delivery";
    let appliedCoupon = null;

    // ===== CARREGAR DADOS DO FIRESTORE =====
    const carregarDados = async () => {
        const [produtosSnap, categoriasSnap, cuponsSnap, configDoc] = await Promise.all([
            db.collection("produtos").orderBy("criadoEm", "desc").get(),
            db.collection("categorias").get(),
            db.collection("cupons").get(),
            db.collection("configuracoes").doc("geral").get()
        ]);

        produtos = produtosSnap.docs.map((d) => ({ ...d.data() }));
        categorias = categoriasSnap.docs.map((d) => ({ ...d.data() })).sort(compararCategorias);
        validCoupons = cuponsSnap.docs.map((d) => ({ ...d.data() }));
        configLoja = configDoc.exists ? { ...CONFIG_PADRAO, ...configDoc.data() } : { ...CONFIG_PADRAO };
    };

    // ===== RENDERIZAR BARRA DE CATEGORIAS =====
    const renderizarCategorias = () => {
        const botoesCategorias = categorias
            .map(
                (c) => `
                    <button class="category-btn" data-category="${c.id}">
                        <i class="${c.icone || "fa-solid fa-cube"}" aria-hidden="true"></i> ${c.nome.toUpperCase()}
                    </button>
                `
            )
            .join("");

        categoriesBar.innerHTML = `
            <button class="category-btn active" data-category="all">
                <i class="fa-solid fa-border-all" aria-hidden="true"></i> TODOS
            </button>
            ${botoesCategorias}
        `;
    };

    // ===== RENDERIZAR HORÁRIOS DE RETIRADA =====
    const renderizarHorariosRetirada = () => {
        const [horaIni, minIni] = configLoja.retiradaHoraInicio.split(":").map(Number);
        const [horaFim, minFim] = configLoja.retiradaHoraFim.split(":").map(Number);
        const intervalo = configLoja.retiradaIntervalo || 60;

        let minutos = horaIni * 60 + minIni;
        const minutosFim = horaFim * 60 + minFim;
        const opcoes = [];

        while (minutos <= minutosFim) {
            const h = String(Math.floor(minutos / 60)).padStart(2, "0");
            const m = String(minutos % 60).padStart(2, "0");
            opcoes.push(`${h}:${m}`);
            minutos += intervalo;
        }

        pickupTimeSelect.innerHTML =
            `<option value="" disabled selected>Horário</option>` +
            opcoes.map((h) => `<option value="${h}">${h}</option>`).join("");
    };

    // ===== FUNÇÕES =====
    const formatarMoeda = (v) => {
        return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    };

    const abrirCarrinho = () => {
        cartSidebar.classList.add("show");
        cartOverlay.classList.add("show");
        document.body.style.overflow = "hidden";
    };
    
    const fecharCarrinho = () => {
        cartSidebar.classList.remove("show");
        cartOverlay.classList.remove("show");
        document.body.style.overflow = "auto";
    };

    // ===== EFEITO FLY TO CART =====
    const animacaoVoarParaCarrinho = (productCard) => {
        const productImg = productCard.querySelector(".product-img");
        if (!productImg) return;
        
        const imgRect = productImg.getBoundingClientRect();
        const cartRect = cartIcon.getBoundingClientRect();
        
        const flyingImg = document.createElement("img");
        flyingImg.src = productImg.src;
        flyingImg.classList.add("product-image-fly");
        
        flyingImg.style.left = `${imgRect.left}px`;
        flyingImg.style.top = `${imgRect.top}px`;
        flyingImg.style.width = `${imgRect.width}px`;
        flyingImg.style.height = `${imgRect.height}px`;
        flyingImg.style.position = "fixed";
        flyingImg.style.zIndex = "9999";
        flyingImg.style.borderRadius = "8px";
        flyingImg.style.boxShadow = "0 4px 15px rgba(229, 184, 11, 0.5)";
        flyingImg.style.transition = "all 0.8s cubic-bezier(0.68, -0.55, 0.265, 1.55)";
        flyingImg.style.objectFit = "cover";
        
        document.body.appendChild(flyingImg);
        
        flyingImg.getBoundingClientRect();
        
        requestAnimationFrame(() => {
            flyingImg.style.left = `${cartRect.left + cartRect.width / 2}px`;
            flyingImg.style.top = `${cartRect.top + cartRect.height / 2}px`;
            flyingImg.style.width = "40px";
            flyingImg.style.height = "40px";
            flyingImg.style.opacity = "0.7";
            flyingImg.style.transform = "rotate(10deg) scale(0.3)";
        });
        
        flyingImg.addEventListener("transitionend", () => {
            flyingImg.remove();
            
            cartIcon.style.transform = "scale(1.2)";
            setTimeout(() => {
                cartIcon.style.transform = "scale(1)";
            }, 200);
        });
    };

    // CRIA O HTML DE UM CARD DE PRODUTO (reaproveitado na grade normal e nos destaques)
    const criarCardProduto = (p) => {
        const linkExterno = p.link
            ? `<a href="${p.link}" target="_blank" class="product-link" style="display:inline-block; margin:8px 0; font-size:0.8rem; color:#E5B80B; text-decoration:none; border:1px solid #E5B80B; padding:4px 8px; border-radius:4px;">🔗 Ficha Técnica <i class="fa-solid fa-arrow-up-right-from-workspaces" style="font-size:0.7rem;"></i></a>`
            : '';

        // ✅ ALTERAÇÃO 2: VERIFICA DISPONIBILIDADE
        const estaDisponivel = p.disponivel !== false;

        // ✅ BOTÃO DIFERENTE PARA ESGOTADO
        const botao = estaDisponivel
            ? '<button class="product-button">ADICIONAR</button>'
            : '<button class="product-button" disabled style="background:#555; border-color:#666; cursor:not-allowed; opacity:0.7;">ESGOTADO</button>';

        // ✅ BADGE DE ESGOTADO
        const badgeEsgotado = !estaDisponivel
            ? '<span style="position:absolute; top:10px; right:10px; background:#B71C1C; color:white; padding:4px 8px; border-radius:4px; font-size:0.7rem; font-weight:bold; z-index:10;">ESGOTADO</span>'
            : '';

        const galeriaThumbs = p.imagem2
            ? `
                <div class="product-thumbs">
                    <button type="button" class="thumb-dot active" data-img="${p.imagem}"></button>
                    <button type="button" class="thumb-dot" data-img="${p.imagem2}"></button>
                </div>
            `
            : '';

        return `
            <div class="product-card" data-id="${p.id}" data-categoria="${p.categoria}" style="position:relative;">
                ${badgeEsgotado}
                <img class="product-img" src="${p.imagem}" alt="${p.nome}"
                     onerror="this.onerror=null;this.src='./assets/placeholder.svg'">
                ${galeriaThumbs}
                <div class="product-info">
                    <h3 class="product-name">${p.nome}</h3>
                    <p class="product-description">${p.descricao}</p>
                    ${linkExterno}
                    <p class="product-price">${formatarMoeda(p.preco)}</p>
                    ${botao}
                </div>
            </div>
        `;
    };

    // FILTRO DE PRODUTOS (COM BADGE ESGOTADO)
    const filtrarEMostrarProdutos = () => {
        let produtosFiltrados = [...produtos];

        if (categoriaAtiva !== "all") {
            produtosFiltrados = produtosFiltrados.filter(
                (produto) => produto.categoria === categoriaAtiva
            );
        }

        if (termoBusca.trim() !== "") {
            const termo = termoBusca.toLowerCase();
            produtosFiltrados = produtosFiltrados.filter(
                (produto) =>
                    produto.nome.toLowerCase().includes(termo) ||
                    produto.descricao.toLowerCase().includes(termo)
            );
        }

        const container = document.querySelector(".products .products-container");
        if (produtosFiltrados.length === 0) {
            container.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: #A0A88A;">
                    <i class="fa-solid fa-box-open" style="font-size: 3rem; margin-bottom: 1rem; color: #E5B80B;"></i>
                    <p style="font-size: 1.2rem; font-weight: 600;">Nenhum produto encontrado</p>
                </div>
            `;
        } else {
            container.innerHTML = produtosFiltrados.map(criarCardProduto).join("");
        }
    };

    // RENDERIZAR SEÇÃO DE DESTAQUES DA SEMANA
    const renderizarDestaques = () => {
        const destaquesSection = document.getElementById("destaques-section");
        const destaquesContainer = document.querySelector(".destaques-container");
        const produtosDestaque = produtos.filter((p) => p.destaque && p.disponivel !== false);

        if (produtosDestaque.length === 0) {
            destaquesSection.style.display = "none";
            return;
        }

        destaquesSection.style.display = "block";
        destaquesContainer.innerHTML = produtosDestaque.map(criarCardProduto).join("");
    };

    // ✅ ALTERAÇÃO 3: ADICIONAR AO CARRINHO COM VERIFICAÇÃO DE ESGOTADO
    const adicionarAoCarrinho = (produtoId, productCard) => {
        const produto = produtos.find((p) => p.id === produtoId);
        
        // VERIFICA SE O PRODUTO ESTÁ DISPONÍVEL
        if (produto.disponivel === false) {
            alert("🚫 Este produto está esgotado! Volta em breve!");
            return; // Não adiciona ao carrinho
        }
        
        // ANIMAÇÃO FLY TO CART ✈️ (só se estiver disponível)
        animacaoVoarParaCarrinho(productCard);
        
        const itemNoCarrinho = carrinho.find((item) => item.id === produtoId);
        
        if (itemNoCarrinho) {
            itemNoCarrinho.quantidade++;
        } else {
            carrinho.push({ ...produto, quantidade: 1 });
        }
        
        atualizarCarrinho();
    };

    // ATUALIZAR CARRINHO (SEM FOTOS)
    const atualizarCarrinho = () => {
        if (carrinho.length === 0) {
            cartBody.innerHTML = `<div class="cart-empty"><i class="fa-solid fa-box-open"></i><p>Sua Base Móvel está vazia</p></div>`;
        } else {
            cartBody.innerHTML = carrinho
                .map(
                    (item) => `
                        <div class="cart-item" data-id="${item.id}" style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid #2A3A2A; margin-bottom: 5px;">
                            <div style="flex: 1;">
                                <h4 style="margin: 0; font-size: 0.95rem; color: #F0EAD0;">${item.nome}</h4>
                                <p style="margin: 3px 0; color: #E5B80B; font-weight: bold;">${formatarMoeda(item.preco)}</p>
                                <div style="display: flex; align-items: center; gap: 8px; margin-top: 5px;">
                                    <button class="quantity-btn" data-action="diminuir" style="background: #2A3A2A; color: #E5B80B; border: none; width: 25px; height: 25px; border-radius: 4px; cursor: pointer;">-</button>
                                    <span style="color: #F0EAD0;">${item.quantidade}</span>
                                    <button class="quantity-btn" data-action="aumentar" style="background: #2A3A2A; color: #E5B80B; border: none; width: 25px; height: 25px; border-radius: 4px; cursor: pointer;">+</button>
                                </div>
                            </div>
                            <button class="remove-item-btn" data-id="${item.id}" style="background: none; border: none; color: #B71C1C; font-size: 1.5rem; cursor: pointer; padding: 0 10px;">&times;</button>
                        </div>
                    `
                )
                .join("");
        }

        const subtotal = carrinho.reduce((acc, item) => acc + (item.preco * item.quantidade), 0);

        let discountAmount = calcularDesconto(appliedCoupon, subtotal);

        const total = subtotal - discountAmount;

        subtotalElem.textContent = formatarMoeda(subtotal);
        
        if (discountAmount > 0) {
            cartDiscountElem.textContent = `- ${formatarMoeda(discountAmount)}`;
            discountLineElem.style.display = "flex";
        } else {
            discountLineElem.style.display = "none";
        }
        
        totalElem.textContent = formatarMoeda(total);
        cartBadge.textContent = carrinho.reduce((acc, item) => acc + item.quantidade, 0);
        bannerTotalElem.textContent = formatarMoeda(total);
        
        finishOrderBtn.disabled = carrinho.length === 0;
        
        if (carrinho.length > 0 && window.innerWidth <= 768) {
            viewCartBanner.classList.add("show");
        } else {
            viewCartBanner.classList.remove("show");
        }
    };

    // REMOVER DO CARRINHO
    const removerDoCarrinho = (produtoId) => {
        carrinho = carrinho.filter(item => item.id !== produtoId);
        atualizarCarrinho();
    };

    // ALTERAR QUANTIDADE
    const alterarQuantidade = (produtoId, acao) => {
        const item = carrinho.find(i => i.id === produtoId);
        if (!item) return;
        
        if (acao === "aumentar") {
            item.quantidade++;
        } else if (acao === "diminuir") {
            item.quantidade--;
            if (item.quantidade <= 0) {
                carrinho = carrinho.filter(i => i.id !== produtoId);
            }
        }
        atualizarCarrinho();
    };

    // CUPOM
    const calcularDesconto = (cupom, subtotal) => {
        if (!cupom) return 0;
        if (cupom.tipo === "percentual") {
            return subtotal * (cupom.valor / 100);
        }
        if (cupom.tipo === "fixo") {
            return Math.min(cupom.valor, subtotal);
        }
        return 0;
    };

    const applyCoupon = () => {
        const code = couponInput.value.trim().toUpperCase();
        const subtotalAtual = carrinho.reduce((acc, item) => acc + (item.preco * item.quantidade), 0);
        const foundCoupon = validCoupons.find(c => c.codigo === code && c.ativo !== false);

        couponFeedback.classList.remove("success", "error");

        if (!foundCoupon) {
            appliedCoupon = null;
            couponFeedback.textContent = "Cupom inválido.";
            couponFeedback.classList.add("error");
        } else if (foundCoupon.validade && foundCoupon.validade < new Date().toISOString().slice(0, 10)) {
            appliedCoupon = null;
            couponFeedback.textContent = "Cupom expirado.";
            couponFeedback.classList.add("error");
        } else if (foundCoupon.valorMinimo && subtotalAtual < foundCoupon.valorMinimo) {
            appliedCoupon = null;
            couponFeedback.textContent = `Pedido mínimo de ${formatarMoeda(foundCoupon.valorMinimo)} para este cupom.`;
            couponFeedback.classList.add("error");
        } else {
            appliedCoupon = foundCoupon;
            couponFeedback.textContent = "Cupom aplicado! Missão com desconto!";
            couponFeedback.classList.add("success");
        }
        atualizarCarrinho();
    };

    // FINALIZAR PEDIDO
    const finalizarPedido = async () => {
        let valid = true;
        let fieldsToValidate = [];

        if (tipoEntrega === "delivery") {
            fieldsToValidate = [
                "delivery-name",
                "delivery-phone",
                "delivery-cep",
                "delivery-address",
            ];
        } else {
            fieldsToValidate = ["pickup-name", "pickup-date", "pickup-time"];
        }

        fieldsToValidate.forEach((id) => {
            const el = document.getElementById(id);
            if (el) {
                if (el.value.trim() === "") {
                    el.classList.add("error");
                    valid = false;
                } else {
                    el.classList.remove("error");
                }
            }
        });

        if (!valid) {
            alert("Por favor, preencha todos os campos obrigatórios!");
            return;
        }

        const numeroWhatsApp = configLoja.whatsapp;

        const itensPedido = carrinho
            .map(item => `  - ${item.quantidade}x ${item.nome} (${formatarMoeda(item.preco)} cada)`)
            .join("\n");

        const subtotal = carrinho.reduce((acc, item) => acc + (item.preco * item.quantidade), 0);

        const discountAmount = calcularDesconto(appliedCoupon, subtotal);
        const cupomInfo = appliedCoupon
            ? `\n*Cupom Aplicado:* ${appliedCoupon.codigo} (${formatarMoeda(discountAmount)})`
            : "";

        const total = subtotal - discountAmount;

        let mensagem = `*🎖️ NOVA MISSÃO - COMANDO STORE 🎖️*\n\n`;
        mensagem += `*ITENS DA MISSÃO:*\n${itensPedido}\n\n`;
        mensagem += `*Subtotal:* ${formatarMoeda(subtotal)}${cupomInfo}\n`;
        mensagem += `*Total da Missão:* ${formatarMoeda(total)}\n\n`;
        mensagem += `─────────────────────\n\n`;

        let dadosCliente = {};

        if (tipoEntrega === "delivery") {
            const nome = document.getElementById("delivery-name")?.value || "";
            const phone = document.getElementById("delivery-phone")?.value || "";
            const cep = document.getElementById("delivery-cep")?.value || "";
            const address = document.getElementById("delivery-address")?.value || "";
            const paymentMethod = document.querySelector('input[name="payment"]:checked')?.value || "Não informado";

            dadosCliente = { nome, telefone: phone, cep, endereco: address, pagamento: paymentMethod };

            mensagem += `*TIPO:* Entrega (Missão)\n\n`;
            mensagem += `*Nome:* ${nome}\n`;
            mensagem += `*Telefone:* ${phone}\n`;
            mensagem += `*CEP:* ${cep}\n`;
            mensagem += `*Endereço:* ${address}\n\n`;
            mensagem += `*Pagamento:* ${paymentMethod}`;
        } else {
            const nome = document.getElementById("pickup-name")?.value || "";
            const dataInput = document.getElementById("pickup-date")?.value || "";
            const hora = document.getElementById("pickup-time")?.value || "";

            dadosCliente = { nome, dataRetirada: dataInput, horaRetirada: hora };

            mensagem += `*TIPO:* Retirada (Base)\n\n`;
            mensagem += `*Nome:* ${nome}\n`;
            mensagem += `*Data:* ${dataInput}\n`;
            mensagem += `*Hora:* ${hora}`;
        }

        // Salva o pedido no Firestore para ficar no histórico do admin (não bloqueia o checkout se falhar)
        try {
            await db.collection("pedidos").add({
                itens: carrinho.map((item) => ({ nome: item.nome, preco: item.preco, qtd: item.quantidade })),
                subtotal,
                desconto: discountAmount,
                total,
                cupom: appliedCoupon ? appliedCoupon.codigo : null,
                tipoEntrega,
                cliente: dadosCliente,
                atendido: false,
                criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
            });
        } catch (err) {
            console.error("Não foi possível salvar o pedido no histórico:", err);
        }

        const url = `https://wa.me/${numeroWhatsApp}?text=${encodeURIComponent(mensagem)}`;
        window.open(url, "_blank");
    };

    // ===== EVENTOS =====
    cartIcon.addEventListener("click", abrirCarrinho);
    closeCartBtn.addEventListener("click", fecharCarrinho);
    cartOverlay.addEventListener("click", fecharCarrinho);
    viewCartBannerBtn.addEventListener("click", abrirCarrinho);
    applyCouponBtn.addEventListener("click", applyCoupon);
    finishOrderBtn.addEventListener("click", finalizarPedido);

    // CATEGORIAS (delegação, pois os botões são gerados dinamicamente)
    categoriesBar.addEventListener("click", (e) => {
        const btn = e.target.closest(".category-btn");
        if (!btn) return;
        categoriesBar.querySelectorAll(".category-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        categoriaAtiva = btn.dataset.category;
        filtrarEMostrarProdutos();
    });

    // BUSCA
    searchInput.addEventListener("input", (e) => {
        termoBusca = e.target.value;
        filtrarEMostrarProdutos();
    });

    // BOTÃO COMPRAR (COM ANIMAÇÃO) e TROCA DE FOTO — delegado no body pois existe grade normal e de destaques
    document.body.addEventListener("click", (e) => {
        if (e.target.classList.contains("product-button")) {
            const productCard = e.target.closest(".product-card");
            const produtoId = Number(productCard.dataset.id);
            adicionarAoCarrinho(produtoId, productCard);
            return;
        }

        const thumb = e.target.closest(".thumb-dot");
        if (thumb) {
            const productCard = thumb.closest(".product-card");
            productCard.querySelector(".product-img").src = thumb.dataset.img;
            productCard.querySelectorAll(".thumb-dot").forEach((d) => d.classList.remove("active"));
            thumb.classList.add("active");
        }
    });

    // CARRINHO (QUANTIDADE E REMOVER)
    cartBody.addEventListener("click", (e) => {
        const cartItem = e.target.closest(".cart-item");
        if (!cartItem) return;
        
        const produtoId = Number(cartItem.dataset.id);
        
        if (e.target.classList.contains("quantity-btn")) {
            alterarQuantidade(produtoId, e.target.dataset.action);
        }
        
        if (e.target.classList.contains("remove-item-btn")) {
            removerDoCarrinho(produtoId);
        }
    });

    // DELIVERY/RETIRADA
    deliveryToggleBtns.forEach((btn) => {
        btn.addEventListener("click", () => {
            deliveryToggleBtns.forEach((b) => b.classList.remove("active"));
            btn.classList.add("active");
            tipoEntrega = btn.dataset.option;
            
            if (tipoEntrega === "delivery") {
                deliveryForm.style.display = "block";
                pickupForm.style.display = "none";
            } else {
                deliveryForm.style.display = "none";
                pickupForm.style.display = "block";
            }
        });
    });

    // PAGAMENTO
    document.querySelectorAll('input[name="payment"]').forEach((radio) => {
        radio.addEventListener("change", (e) => {
            trocoContainer.style.display = e.target.value === "Dinheiro" ? "block" : "none";
        });
    });

    // INICIAR
    await carregarDados();
    renderizarCategorias();
    renderizarHorariosRetirada();
    renderizarDestaques();
    filtrarEMostrarProdutos();
    atualizarCarrinho();
});