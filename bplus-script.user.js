// ==UserScript==
// @name         B.PLUS
// @namespace    http://tampermonkey.net/
// @version      15.0.1 // Versão atualizada para refletir as melhorias
// @description  Correção para a renderização de chats, com inicialização segura para evitar conflitos com a página. Melhora na exibição de solicitante/revenda e agrupamento de aguardando.
// @author       Jose Leonardo Lemos
// @match        https://*.beemore.com/*
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_info
// ==/UserScript==

(function() {
    'use strict';

    // --- CONFIGURAÇÕES GERAIS ---
    const CONFIG = {
        SCRIPT_VERSION: GM_info.script.version || '15.0.1',
        UPDATE_DEBOUNCE_MS: 250,
    };

    // --- ÍCONES SVG ---
    const ICONS = {
        USER: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"></path></svg>`,
        LAYOUT: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>`,
        CHEVRON: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"></path></svg>`
    };

    // --- SELETORES DE DOM ---
    const SELECTORS = {
        mainContainer: 'app-chat-list-container > section',
        originalChatLists: 'app-chat-list, app-queue-list',
        allChatItems: 'app-chat-list-item, app-queue-item',
        alertIcon: 'app-icon[icon="tablerAlertCircle"]',
        statusTag: 'app-tag',
        // Seletor mais específico para o nome do solicitante e revenda dentro do item de chat.
        // O Beemore geralmente usa uma estrutura como:
        // app-chat-list-item > a > div.item-content > div.item-body > div.flex-col > span.truncate (solicitante)
        // app-chat-list-item > a > div.item-content > div.item-body > div.flex-col > div.flex > span.truncate (revenda)
        // No entanto, o script original usa .querySelectorAll('span.truncate') e pega o index 0 e 1.
        // Isso pode ser frágil se a ordem ou o número de spans mudar.
        // Vamos manter o seletor genérico por enquanto, pois o script já o utiliza,
        // mas é um ponto a ser verificado caso a extração falhe.
        solicitanteName: 'span.truncate:first-child', // Assumindo o primeiro span.truncate é o solicitante
        revendaName: 'div > span.truncate', // Assumindo que a revenda está dentro de um div que é filho do flex-col e contém um span.truncate
                                        // Ou o segundo span.truncate no geral, como o script original já faz.
                                        // O parseChatItemData ajustado tentará ser mais robusto.
    };

    // --- ESTADO DA APLICAÇÃO ---
    const STATE = {
        activeFilter: 'Todos',
        activeLayout: GM_getValue('activeLayout', 'tabs'),
        collapsedGroups: new Set(JSON.parse(GM_getValue('collapsedGroups', '[]'))),
        renderedChats: new Map(), // Map<chatId, {element, data}>
        isInitialized: false,
    };

    // =================================================================================
    // FUNÇÕES UTILITÁRIAS
    // =================================================================================
    const log = (message) => console.log(`[B.Plus! v${CONFIG.SCRIPT_VERSION}] ${message}`);
    const debounce = (func, delay) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => func.apply(this, a), delay); }; };
    const makeSafeForCSS = (name) => name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    const hexToRgba = (hex, alpha) => {
        let r = 0, g = 0, b = 0;
        if (hex.length === 4) { r = parseInt(hex[1] + hex[1], 16); g = parseInt(hex[2] + hex[2], 16); b = parseInt(hex[3] + hex[3], 16); }
        else if (hex.length === 7) { r = parseInt(hex.substring(1, 3), 16); g = parseInt(hex.substring(3, 5), 16); b = parseInt(hex.substring(5, 7), 16); }
        return `rgba(${r},${g},${b},${alpha})`;
    };
    const waitForElement = (selector) => new Promise(resolve => {
        const el = document.querySelector(selector);
        if (el) return resolve(el);
        const observer = new MutationObserver(() => {
            const el = document.querySelector(selector);
            if (el) { observer.disconnect(); resolve(el); }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    });

    // =================================================================================
    // INJEÇÃO DE ESTILOS
    // =================================================================================
    function injectStyles() {
        if (document.getElementById('bplus-custom-styles')) return;

        const CATEGORY_COLORS = {
            'Suporte - Web': '#3498db', 'Suporte - PDV': '#2ecc71', 'Suporte - Retaguarda': '#f39c12',
            'Suporte - Fiscal': '#e74c3c', 'Suporte - Mobile': '#9b59b6', 'Sem Categoria': '#95a5a6'
        };

        let dynamicStyles = Object.entries(CATEGORY_COLORS).map(([category, color]) => {
            const safeCategory = makeSafeForCSS(category);
            return `
                .crx-filter-tab[data-filter="${category}"].active { background-color: ${color} !important; color: white !important; }
                .crx-item-bg-${safeCategory} { border-left-color: ${color} !important; background-color: ${hexToRgba(color, 0.08)} !important; }
                .dark .crx-item-bg-${safeCategory} { background-color: ${hexToRgba(color, 0.15)} !important; }
            `;
        }).join('');

        GM_addStyle(`
            #bplus-custom-styles { display: none; } /* Hidden element to check if styles are injected */
            body.bplus-active app-chat-list-container > section > ${SELECTORS.originalChatLists} { display: none !important; }
            #crx-main-container { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
            .crx-layout-tabs #crx-list-layout-container, .crx-layout-list #crx-tabs-layout-container { display: none; }

            /* Estilos para as abas de filtro */
            .crx-filter-tabs { display: flex; flex-shrink: 0; overflow-x: auto; overflow-y: hidden; height: 48px; align-items: center; padding: 0 8px; background-color: var(--primary-100, #fff); border-bottom: 1px solid var(--border-color, #e0e0e0); }
            .dark .crx-filter-tabs { background-color: var(--primary-700, #252535); border-bottom-color: var(--border-dark, #3e374e); }
            .crx-filter-tab { padding: 8px 12px; margin: 0 4px; border-radius: 6px; font-size: 13px; font-weight: 500; color: var(--text-color-secondary, #666); cursor: pointer; white-space: nowrap; transition: all 0.2s; }
            .dark .crx-filter-tab { color: var(--text-color-dark-secondary, #aaa); }
            .crx-filter-tab.active { font-weight: 600; }
            .crx-filter-tab .count { background-color: var(--primary-200, #e0e0e0); color: var(--text-color-tertiary, #555); border-radius: 10px; padding: 1px 6px; font-size: 11px; margin-left: 6px; }
            .dark .crx-filter-tab .count { background-color: var(--primary-600, #3e374e); color: var(--text-color-dark-tertiary, #ccc); }

            /* Estilos para o cabeçalho do grupo */
            .crx-group-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 12px 4px; font-size: 13px; font-weight: 600; color: var(--text-color-secondary, #6c757d); text-transform: uppercase; position: sticky; top: 0; background: var(--primary-100, #fff); z-index: 10; cursor: pointer; user-select: none; border-bottom: 1px solid var(--border-color, #e0e0e0); }
            .dark .crx-group-header { color: var(--text-color-dark-secondary, #a0a0b0); border-bottom-color: var(--border-dark, #3e374e); background: var(--primary-700, #252535); }
            .crx-group-header.group-waiting { color: #e67e22; } /* Cor específica para o grupo "Aguardando Atendimento" */
            .dark .crx-group-header.group-waiting { color: #f39c12; }
            .crx-group-header .crx-chevron { transition: transform 0.2s ease-in-out; }
            .crx-group-header.collapsed .crx-chevron { transform: rotate(-90deg); }
            .crx-chat-group-items.collapsed { display: none; }

            /* Estilos para o container da lista de chats */
            .crx-chat-list-container { flex-grow: 1; overflow-y: auto; background-color: var(--primary-100, #fff); }
            .dark .crx-chat-list-container { background-color: var(--primary-700, #252535); }

            /* Estilos para os itens individuais de chat */
            .crx-tg-item {
                display: flex;
                align-items: center;
                padding: 8px 12px;
                border-bottom: 1px solid var(--border-color, #f0f0f0);
                cursor: pointer;
                border-left: 5px solid transparent;
                transition: background-color 0.15s;
            }
            .dark .crx-tg-item { border-bottom-color: var(--border-dark, #3e374e); }

            /* Estilo para item ativo (selecionado) */
            .crx-tg-item.active {
                background-color: var(--primary-color, #5e47d0) !important;
                color: white;
                border-left-color: var(--primary-color, #5e47d0) !important;
            }
            .crx-tg-item.active .crx-tg-title,
            .crx-tg-item.active .crx-tg-subtitle {
                color: white !important;
            }
            .crx-tg-item.active .crx-tg-avatar {
                background-color: rgba(255,255,255,0.2) !important;
                color: white !important;
            }

            /* Estilos para itens "Aguardando Atendimento" */
            .crx-tg-item.is-waiting {
                border-left-color: #FFA500 !important; /* Laranja */
                background-color: ${hexToRgba('#FFA500', 0.08)} !important;
            }
            .dark .crx-tg-item.is-waiting { background-color: ${hexToRgba('#FFA500', 0.18)} !important; }
            .crx-tg-item.is-alert { border-left-color: #E57373 !important; } /* Vermelho suave para alertas */

            /* Estilos para o avatar e conteúdo textual */
            .crx-tg-avatar {
                flex-shrink: 0; /* Impede que o avatar encolha */
                width: 32px;
                height: 32px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                background-color: var(--primary-200, #e0e0e0); /* Fundo padrão do avatar */
                color: var(--text-color-tertiary, #555); /* Cor padrão do ícone */
            }
            .dark .crx-tg-avatar {
                background-color: var(--primary-600, #3e374e);
                color: var(--text-color-dark-tertiary, #ccc);
            }
            .crx-tg-avatar svg {
                width: 20px;
                height: 20px;
            }
            .crx-tg-content {
                flex-grow: 1; /* Permite que o conteúdo textual ocupe o espaço restante */
                min-width: 0; /* Essencial para que text-overflow: ellipsis funcione */
                margin-left: 8px; /* Espaçamento entre o avatar e o texto */
            }
            .crx-tg-title {
                font-weight: 500;
                font-size: 14px; /* Tamanho da fonte para o solicitante (linha principal) */
                color: var(--text-color-primary, #333);
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis; /* Adiciona reticências se o texto for muito longo */
            }
            .dark .crx-tg-title {
                color: var(--text-color-dark-primary, #f0f0f0);
            }
            .crx-tg-subtitle {
                font-size: 11px; /* Tamanho da fonte menor para a revenda */
                color: var(--text-color-tertiary, #777); /* Cor mais clara para a revenda */
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                margin-top: 2px; /* Pequeno espaçamento entre solicitante e revenda */
            }
            .dark .crx-tg-subtitle {
                color: var(--text-color-dark-tertiary, #b0b0b0);
            }
            /* Adicionado um estilo para o botão de toggle de layout */
            .crx-controls-container {
                display: flex;
                justify-content: flex-end;
                padding: 4px 8px;
                background-color: var(--primary-100, #fff);
                border-bottom: 1px solid var(--border-color, #e0e0e0);
            }
            .dark .crx-controls-container {
                background-color: var(--primary-700, #252535);
                border-bottom-color: var(--border-dark, #3e374e);
            }
            #crx-layout-toggle {
                background: none;
                border: none;
                color: var(--text-color-secondary, #666);
                cursor: pointer;
                padding: 6px;
                border-radius: 4px;
                transition: background-color 0.2s;
            }
            #crx-layout-toggle:hover {
                background-color: var(--primary-200, #eee);
            }
            .dark #crx-layout-toggle {
                color: var(--text-color-dark-secondary, #aaa);
            }
            .dark #crx-layout-toggle:hover {
                background-color: var(--primary-600, #3e374e);
            }

            ${dynamicStyles}
        `);
    }

    // =================================================================================
    // LÓGICA DE DADOS E RENDERIZAÇÃO
    // =================================================================================
    function parseChatItemData(itemElement, index) {
        // Tenta capturar o nome do solicitante. O Beemore geralmente usa o primeiro `span.truncate`
        // dentro de `div.flex-col` que está dentro de `div.item-body`.
        const solicitanteElement = itemElement.querySelector('div.item-body > div.flex-col > span.truncate');
        const solicitante = solicitanteElement?.innerText.trim() || 'Usuário Desconhecido';

        // Tenta capturar o nome da revenda. A revenda costuma vir logo abaixo do solicitante
        // em um `span.truncate` dentro de um `div.flex`.
        // Vamos procurar pelo segundo `span.truncate` de forma mais genérica,
        // mas com um fallback robusto caso a estrutura mude ligeiramente.
        const allTruncateSpans = Array.from(itemElement.querySelectorAll('span.truncate'));
        let revenda = 'Sem Revenda';
        // Se o primeiro span for o solicitante, o segundo geralmente será a revenda.
        if (allTruncateSpans.length > 1 && allTruncateSpans[0] === solicitanteElement) {
             revenda = allTruncateSpans[1]?.innerText.trim();
        } else if (allTruncateSpans.length > 0 && allTruncateSpans[0] !== solicitanteElement) {
            // Se o primeiro span não for o solicitante, talvez a ordem tenha mudado,
            // ou o solicitante não é um span.truncate. Neste caso, o segundo pode ser a revenda.
            revenda = allTruncateSpans[0]?.innerText.trim(); // Se o solicitante não foi encontrado pelo seletor específico, tentamos o primeiro truncate como revenda caso seja o único, ou o solicitante.
            if (allTruncateSpans.length > 1) {
                revenda = allTruncateSpans[1]?.innerText.trim(); // Se tiver mais de um, o segundo será a revenda.
            }
        }
        revenda = revenda || 'Sem Revenda'; // Garante que não seja vazio

        const isWaiting = Array.from(itemElement.querySelectorAll(SELECTORS.statusTag))
                               .some(tag => tag.textContent?.toLowerCase().includes('aguardando'));
        const isAlert = !isWaiting && !!itemElement.querySelector(SELECTORS.alertIcon);

        // A categoria geralmente está em um `span.shrink-0`
        const categoryElement = itemElement.querySelector('span.shrink-0');
        const categoria = categoryElement?.innerText.trim() || 'Sem Categoria';

        return {
            id: `crx-item-${index}`, // ID único para o elemento do script
            solicitante,
            revenda,
            categoria,
            isWaiting,
            isAlert,
            isActive: itemElement.classList.contains('active'), // Verifica se o chat está ativo
            // Verifica se o chat pertence ao grupo "Meus Chats" baseado no pai original
            isMyChat: !!itemElement.closest('app-chat-list')?.querySelector('header span')?.textContent.includes('Meus chats'),
            originalElement: itemElement, // Referência ao elemento DOM original para cliques
        };
    }

    function createChatItemElement(chatData) {
        const item = document.createElement('div');
        item.dataset.itemId = chatData.id;
        // Ao clicar no nosso item, disparamos o clique no item original do Beemore
        item.addEventListener('click', () => chatData.originalElement.click());

        // Estrutura HTML do item de chat com solicitante e revenda
        item.innerHTML = `
            <div class="crx-tg-avatar is-icon">${ICONS.USER}</div>
            <div class="crx-tg-content">
                <div class="crx-tg-title">${chatData.solicitante}</div>
                <div class="crx-tg-subtitle"><span>${chatData.revenda}</span></div>
            </div>
        `;
        updateChatItemElement(item, chatData); // Aplica as classes baseadas no estado
        return item;
    }

    function updateChatItemElement(element, data) {
        // Atualiza as classes do elemento para refletir o estado (categoria, ativo, aguardando, alerta)
        element.className = `crx-tg-item crx-item-bg-${makeSafeForCSS(data.categoria)}`;
        if (data.isActive) element.classList.add('active');
        if (data.isAlert) element.classList.add('is-alert');
        if (data.isWaiting) element.classList.add('is-waiting');
        // Opcional: Atualizar texto se houver mudança, mas o re-render já cuida disso.
        // element.querySelector('.crx-tg-title').textContent = data.solicitante;
        // element.querySelector('.crx-tg-subtitle span').textContent = data.revenda;
    }

    function renderInitialShell(container) {
        if (document.getElementById('crx-main-container')) return; // Já existe
        const shell = document.createElement('div');
        shell.id = 'crx-main-container';
        shell.innerHTML = `
            <div class="crx-controls-container">
                <button id="crx-layout-toggle" title="Alternar Layout">${ICONS.LAYOUT}</button>
            </div>
            <div id="crx-tabs-layout-container">
                <div class="crx-filter-tabs"></div>
                <div class="crx-chat-list-container"></div>
            </div>
            <div id="crx-list-layout-container" class="crx-chat-list-container"></div>
        `;
        container.appendChild(shell);

        // Adiciona listener para o botão de alternar layout
        document.getElementById('crx-layout-toggle').addEventListener('click', () => {
            STATE.activeLayout = (STATE.activeLayout === 'tabs') ? 'list' : 'tabs';
            GM_setValue('activeLayout', STATE.activeLayout); // Salva a preferência
            updateFullUI(); // Re-renderiza a interface com o novo layout
        });
    }

    const updateChatList = debounce(() => {
        const allChatItems = Array.from(document.querySelectorAll(SELECTORS.allChatItems));
        const newChatsData = new Map();

        // Mapeia os elementos DOM originais para nossos dados e IDs, usando um índice para IDs únicos
        allChatItems.forEach((el, i) => {
            const data = parseChatItemData(el, i);
            newChatsData.set(data.id, data);
        });

        const oldChatIds = new Set(STATE.renderedChats.keys());

        // Remove chats que não existem mais
        for (const id of oldChatIds) {
            if (!newChatsData.has(id)) {
                STATE.renderedChats.get(id)?.element.remove();
                STATE.renderedChats.delete(id);
            }
        }

        // Adiciona ou atualiza chats existentes
        for (const [id, data] of newChatsData.entries()) {
            if (oldChatIds.has(id)) {
                // Chat já existe, apenas atualiza suas classes e dados
                const existing = STATE.renderedChats.get(id);
                updateChatItemElement(existing.element, data);
                existing.data = data;
            } else {
                // Novo chat, cria o elemento e adiciona ao estado
                STATE.renderedChats.set(id, { element: createChatItemElement(data), data: data });
            }
        }
        updateFullUI(); // Atualiza toda a UI com os novos dados
    }, CONFIG.UPDATE_DEBOUNCE_MS);

    function updateFullUI() {
        const mainContainer = document.getElementById('crx-main-container');
        if (!mainContainer) return;

        mainContainer.className = 'crx-layout-' + STATE.activeLayout; // Aplica a classe de layout

        const allChatsData = Array.from(STATE.renderedChats.values()).map(item => item.data);

        // Ordenação: Alertas vêm primeiro. `(b.isAlert ? 1 : 0) - (a.isAlert ? 1 : 0)` faz com que `true` (1) seja "maior" que `false` (0) ao subtrair, resultando em negativo se `b` for alerta e `a` não, movendo `b` para frente.
        const sortFn = (a, b) => (b.isAlert ? 1 : 0) - (a.isAlert ? 1 : 0);

        // 1. Chats Aguardando Atendimento (sempre no topo)
        const waitingChats = allChatsData.filter(c => c.isWaiting).sort(sortFn);

        // 2. Outros chats (Meus Chats e Outros por categoria)
        const remaining = allChatsData.filter(c => !c.isWaiting);
        const myChats = remaining.filter(c => c.isMyChat).sort(sortFn);
        const otherChats = remaining.filter(c => !c.isMyChat).sort(sortFn);

        // Renderiza baseado no layout ativo
        STATE.activeLayout === 'tabs' ? updateTabsLayout(waitingChats, myChats, otherChats) : updateListLayout(waitingChats, myChats, otherChats);
    }

    function appendGroupToFragment(fragment, title, chats, groupKey) {
        if (chats.length === 0) return; // Não cria grupo se não houver chats

        const isCollapsed = STATE.collapsedGroups.has(groupKey);
        const header = document.createElement('div');
        header.className = `crx-group-header ${isCollapsed ? 'collapsed' : ''}`;
        if (groupKey === 'group_waiting') header.classList.add('group-waiting'); // Estilo especial para Aguardando
        header.innerHTML = `<span>${title} (${chats.length})</span><span class="crx-chevron">${ICONS.CHEVRON}</span>`;

        const itemsContainer = document.createElement('div');
        itemsContainer.className = `crx-chat-group-items ${isCollapsed ? 'collapsed' : ''}`;
        chats.forEach(chat => itemsContainer.appendChild(STATE.renderedChats.get(chat.id).element));

        // Adiciona funcionalidade de colapsar/expandir
        header.addEventListener('click', () => {
            if (STATE.collapsedGroups.has(groupKey)) {
                STATE.collapsedGroups.delete(groupKey);
            } else {
                STATE.collapsedGroups.add(groupKey);
            }
            GM_setValue('collapsedGroups', JSON.stringify(Array.from(STATE.collapsedGroups)));
            header.classList.toggle('collapsed');
            itemsContainer.classList.toggle('collapsed');
        });
        fragment.append(header, itemsContainer);
    }

    function updateTabsLayout(waiting, my, other) {
        const tabsContainer = document.querySelector('#crx-tabs-layout-container .crx-filter-tabs');
        const listContainer = document.querySelector('#crx-tabs-layout-container .crx-chat-list-container');
        if (!tabsContainer || !listContainer) return;

        const allChats = [...waiting, ...my, ...other]; // Todos os chats para contagem geral e de categoria
        const counts = allChats.reduce((a, c) => (a.set(c.categoria, (a.get(c.categoria) || 0) + 1), a), new Map());

        // Renderiza as abas de filtro
        tabsContainer.innerHTML = `
            <div class="crx-filter-tab ${STATE.activeFilter === 'Todos' ? 'active' : ''}" data-filter="Todos">
                Todos <span class="count">${allChats.length}</span>
            </div>` + [...counts.entries()].sort().map(([cat, cnt]) => `
            <div class="crx-filter-tab ${STATE.activeFilter === cat ? 'active' : ''}" data-filter="${cat}">
                ${cat.replace('Suporte - ','')} <span class="count">${cnt}</span>
            </div>`).join('');

        // Adiciona listeners para as abas
        tabsContainer.querySelectorAll('.crx-filter-tab').forEach(t => t.addEventListener('click', () => {
            STATE.activeFilter = t.dataset.filter;
            updateFullUI(); // Re-renderiza a lista para aplicar o filtro
        }));

        listContainer.innerHTML = '';
        const fragment = document.createDocumentFragment();
        const filterFn = chat => STATE.activeFilter === 'Todos' || chat.categoria === STATE.activeFilter;

        // Adiciona grupo "Aguardando Atendimento"
        appendGroupToFragment(fragment, "Aguardando Atendimento", waiting.filter(filterFn), "group_waiting");

        // Adiciona grupo "Meus Chats"
        appendGroupToFragment(fragment, "Meus Chats", my.filter(filterFn), "group_mychats");

        // Adiciona outros grupos por categoria
        const grouped = other.filter(filterFn).reduce((a, c) => ((a[c.categoria] = a[c.categoria] || []).push(c), a), {});
        Object.keys(grouped).sort().forEach(cat => appendGroupToFragment(fragment, cat, grouped[cat], `group_${makeSafeForCSS(cat)}`));

        listContainer.appendChild(fragment);
    }

    function updateListLayout(waiting, my, other) {
        const listContainer = document.getElementById('crx-list-layout-container');
        if (!listContainer) return;

        listContainer.innerHTML = '';
        const fragment = document.createDocumentFragment();

        // Adiciona grupo "Aguardando Atendimento"
        appendGroupToFragment(fragment, "Aguardando Atendimento", waiting, "group_waiting");

        // Adiciona grupo "Meus Chats"
        appendGroupToFragment(fragment, "Meus Chats", my, "group_mychats");

        // Adiciona outros grupos por categoria
        const grouped = other.reduce((a, c) => ((a[c.categoria] = a[c.categoria] || []).push(c), a), {});
        Object.keys(grouped).sort().forEach(cat => appendGroupToFragment(fragment, cat, grouped[cat], `group_${makeSafeForCSS(cat)}`));

        listContainer.appendChild(fragment);
    }

    // =================================================================================
    // INICIALIZAÇÃO
    // =================================================================================
    async function initialize() {
        if (STATE.isInitialized) return;

        injectStyles(); // Injeta os estilos CSS personalizados

        // PASSO 1: Espera a página carregar a lista de chats original.
        // Isso garante que temos os elementos DOM para parsear.
        await waitForElement(SELECTORS.allChatItems);
        log("Chats originais detectados. Iniciando UI do B.Plus!.");

        STATE.isInitialized = true;
        const mainSection = document.querySelector(SELECTORS.mainContainer);
        if (!mainSection) {
            log("ERRO: Container principal (app-chat-list-container > section) não encontrado. O script não pode ser inicializado.");
            return;
        }

        // PASSO 2: Renderiza a nossa estrutura principal (ainda vazia de chats).
        renderInitialShell(mainSection);
        
        // PASSO 3: Ativa a classe CSS no corpo para esconder as listas originais do Beemore.
        document.body.classList.add('bplus-active');

        // PASSO 4: Popula nossa UI pela primeira vez com os chats encontrados.
        updateChatList();

        // PASSO 5: Começa a observar mudanças no container principal para manter a lista atualizada.
        // childList: observa adição/remoção de filhos diretos
        // subtree: observa mudanças em toda a subárvore (essencial para novos chats ou mudanças de estado)
        const observer = new MutationObserver(updateChatList);
        observer.observe(mainSection, { childList: true, subtree: true });
        
        log("B.Plus! carregado e monitorando.");
    }

    // Garante que o script é inicializado após o DOM estar pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
})();
