// ==UserScript==
// @name         B.Plus! - Otimizado por IA
// @namespace    http://tampermonkey.net/
// @version      13.0.0
// @description  Versão reescrita para performance máxima com renderização inteligente, correção de travamentos e maior robustez.
// @author       Jose Leonardo Lemos
// @match        https://*.beemore.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_info
// @connect      10.1.11.15
// @connect      est015
// ==/UserScript==

(function() {
    'use strict';

    // --- CONFIGURAÇÕES GERAIS ---
    const CONFIG = {
        SCRIPT_VERSION: GM_info.script.version || '13.0.0',
        IDLE_REFRESH_SECONDS: 90,
        API_URL: 'http://10.1.11.15/contador/api.php',
        UPDATE_DEBOUNCE_MS: 250, // Atraso para evitar re-renderizações excessivas
    };

    // --- ÍCONES SVG (Constantes para reutilização) ---
    const ICONS = {
        SPINNER: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="crx-spinner"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg>`,
        USER: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"></path></svg>`,
        LAYOUT: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>`,
    };

    // --- SELETORES DE DOM (Centralizados para fácil manutenção) ---
    const SELECTORS = {
        mainContainer: 'app-chat-list-container > section',
        originalChatList: 'app-chat-list, app-queue-list',
        allChatItems: 'app-chat-list-item, app-queue-item',
        chatAgentHeader: 'app-chat-agent-header',
        chatAsidePanel: 'app-chat-aside',
        sidebarHelpButton: 'div[data-sidebar-option="help"]',
        dashboardButton: 'div[data-sidebar-option="dashboard"]',
        sidebarChatButton: 'div[data-sidebar-option="entities.chat"]',
        // Seletores dentro de um item de chat
        solicitante: 'span.truncate', // O primeiro span.truncate
        revenda: 'span.truncate', // O segundo span.truncate
        categoria: 'span.shrink-0',
        avatarImg: 'app-user-picture img',
        alertIcon: 'app-icon[icon="tablerAlertCircle"], span[class*="text-red"]',
        waitingStatus: 'span[class*="text-orange"]',
    };

    // --- ESTADO DA APLICAÇÃO ---
    const STATE = {
        idleTimer: null,
        isAutoRefreshing: false,
        activeFilter: 'Todos',
        activeLayout: GM_getValue('activeLayout', 'tabs'), // 'tabs' ou 'list'
        renderedChats: new Map(), // Armazena os elementos DOM renderizados { id -> { element, data } }
        isInitialized: false,
    };

    // =================================================================================
    // FUNÇÕES UTILITÁRIAS
    // =================================================================================

    /** Exibe logs padronizados no console. */
    const log = (message) => console.log(`[B.Plus! v${CONFIG.SCRIPT_VERSION}] ${message}`);

    /** Atraso na execução de uma função para evitar chamadas excessivas. */
    const debounce = (func, delay) => {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    };

    /** Converte um nome para um formato seguro para classes CSS. */
    const makeSafeForCSS = (name) => name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();

    /** Converte cor HEX para RGBA. */
    const hexToRgba = (hex, alpha) => {
        let r = 0, g = 0, b = 0;
        if (hex.length === 4) {
            r = parseInt(hex[1] + hex[1], 16);
            g = parseInt(hex[2] + hex[2], 16);
            b = parseInt(hex[3] + hex[3], 16);
        } else if (hex.length === 7) {
            r = parseInt(hex.substring(1, 3), 16);
            g = parseInt(hex.substring(3, 5), 16);
            b = parseInt(hex.substring(5, 7), 16);
        }
        return `rgba(${r},${g},${b},${alpha})`;
    };

    /** Espera um elemento aparecer no DOM antes de prosseguir. */
    const waitForElement = (selector) => new Promise(resolve => {
        const el = document.querySelector(selector);
        if (el) return resolve(el);
        const observer = new MutationObserver(() => {
            const el = document.querySelector(selector);
            if (el) {
                observer.disconnect();
                resolve(el);
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    });

    // =================================================================================
    // INJEÇÃO DE ESTILOS E UI
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
                .crx-filter-tab[data-filter="${category}"].active {
                    background-color: ${color} !important; color: white !important;
                    border-bottom-color: transparent !important; border-radius: 6px 6px 0 0; margin-bottom: -1px;
                }
                .crx-filter-tab[data-filter="${category}"].active .count {
                    background-color: rgba(255,255,255,0.2) !important; color: white !important;
                }
                .crx-item-bg-${safeCategory} {
                    border-left-color: ${color} !important; background-color: ${hexToRgba(color, 0.08)} !important;
                }
                .dark .crx-item-bg-${safeCategory} { background-color: ${hexToRgba(color, 0.15)} !important; }
                .crx-item-bg-${safeCategory}:not(.active):hover { background-color: ${hexToRgba(color, 0.18)} !important; }
                .dark .crx-item-bg-${safeCategory}:not(.active):hover { background-color: ${hexToRgba(color, 0.25)} !important; }
                .crx-category-tag-${safeCategory} {
                    background-color: ${color}; color: white; padding: 2px 6px; border-radius: 4px; font-size: 11px;
                    font-weight: 500; margin-right: 8px; flex-shrink: 0;
                }
            `;
        }).join('');

        GM_addStyle(`
            #bplus-custom-styles { display: none; }
            app-chat-list-container > section > ${SELECTORS.originalChatList} { display: none !important; }
            #crx-main-container { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
            .crx-layout-tabs #crx-list-layout-container, .crx-layout-list #crx-tabs-layout-container { display: none; }
            .crx-controls-container { display: flex; justify-content: flex-end; padding: 4px 8px; background-color: #f8f9fa; border-bottom: 1px solid #e0e0e0; }
            .dark .crx-controls-container { background-color: #1e1e2d; border-bottom-color: #3e374e; }
            #crx-layout-toggle { background: none; border: none; cursor: pointer; color: #555; padding: 4px; border-radius: 4px; transition: background-color 0.2s, color 0.2s; }
            #crx-layout-toggle:hover { background-color: #e0e0e0; color: #000; }
            .dark #crx-layout-toggle { color: #aaa; }
            .dark #crx-layout-toggle:hover { background-color: #3e374e; color: #fff; }
            #crx-tabs-layout-container { display: flex; flex-direction: column; height: 100%; }
            .crx-filter-tabs { display: flex; flex-shrink: 0; overflow-x: auto; padding: 0 8px; background-color: #fff; scrollbar-width: thin; border-bottom: 1px solid #e0e0e0; }
            .dark .crx-filter-tabs { background-color: #252535; border-bottom-color: #3e374e; }
            .crx-filter-tab { padding: 10px 8px; margin: 0 8px; font-size: 13px; font-weight: 500; color: #666; cursor: pointer; border-bottom: 3px solid transparent; white-space: nowrap; transition: all 0.2s; }
            .dark .crx-filter-tab { color: #aaa; }
            .crx-filter-tab .count { background-color: #f0f0f0; color: #555; border-radius: 10px; padding: 1px 6px; font-size: 11px; margin-left: 6px; }
            .dark .crx-filter-tab .count { background-color: #3e374e; color: #ccc; }
            .crx-filter-tab.active { font-weight: 600; }
            .crx-chat-list-container { flex-grow: 1; overflow-y: auto; }
            .crx-group-header { padding: 12px 12px 4px; font-size: 13px; font-weight: 600; color: #6c757d; text-transform: uppercase; position: sticky; top: 0; background: #fff; z-index: 10; border-bottom: 1px solid #e0e0e0; }
            .dark .crx-group-header { background: #252535; color: #a0a0b0; border-bottom-color: #3e374e; }
            .crx-tg-item { display: flex; align-items: center; padding: 8px 12px; border-bottom: 1px solid #f0f0f0; cursor: pointer; position: relative; transition: background-color 0.15s ease-in-out; border-left: 5px solid transparent; }
            .dark .crx-tg-item { border-bottom-color: #3e374e; }
            .crx-tg-item.active { background-color: #5e47d0 !important; color: white; border-left-color: #5e47d0 !important; }
            .crx-tg-item.active .crx-tg-subtitle { color: #e1dbfb; }
            .crx-tg-avatar { width: 42px; height: 42px; border-radius: 50%; margin-right: 12px; object-fit: cover; background-color: #e0e0e0; flex-shrink: 0; }
            .dark .crx-tg-avatar { background-color: #555; }
            .crx-tg-avatar.is-icon { padding: 8px; color: #555; }
            .dark .crx-tg-avatar.is-icon { color: #ccc; }
            .crx-tg-item.active .crx-tg-avatar.is-icon { color: white; }
            .crx-tg-content { flex-grow: 1; overflow: hidden; }
            .crx-tg-title { font-weight: 600; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .crx-tg-subtitle { font-size: 13px; color: #666; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px; display: flex; align-items: center; }
            .dark .crx-tg-subtitle { color: #aaa; }
            .crx-tg-meta { position: absolute; right: 12px; top: 12px; }
            .crx-tg-badge { background-color: #FFA500; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; }
            .dark .crx-tg-badge { border-color: #252535; }
            .crx-tg-item.active .crx-tg-badge { border-color: #5e47d0; }
            .crx-tg-item.is-waiting { border-left-color: #FFA500 !important; }
            .crx-tg-item.is-alert { border-left-color: #E57373 !important; }
            @keyframes crx-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            .crx-spinner { animation: crx-spin 1s linear infinite; }
            #crx-version-indicator-sidebar { position: relative; cursor: help; width: 36px; height: 36px; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: #e1dbfb; background-color: transparent; transition: background-color 0.15s ease-in-out; margin-bottom: 6px; }
            #crx-version-indicator-sidebar:hover { background-color: #5e47d0; }
            #crx-version-indicator-sidebar .crx-tooltip { visibility: hidden; width: 160px; background-color: #333; color: #fff; text-align: center; border-radius: 6px; padding: 8px; position: absolute; z-index: 100; left: 125%; top: 50%; transform: translateY(-50%); opacity: 0; transition: opacity 0.3s; line-height: 1.4; }
            #crx-version-indicator-sidebar:hover .crx-tooltip { visibility: visible; opacity: 1; }
            #crx-header-btn { background-color: #FB923C; color: white !important; border: 1px solid #F97316; padding: 0 12px; height: 32px; border-radius: 0.25rem; cursor: pointer; font-weight: 500; margin-right: 8px; display: flex; align-items: center; }
            #crx-header-btn:hover { background-color: #F97316; border-color: #EA580C; }
            /* Estilos do Modal... (mantidos do original) */
            ${dynamicStyles}
        `);
    }

    // =================================================================================
    // LÓGICA DE DADOS E PARSING
    // =================================================================================

    /**
     * Extrai dados estruturados de um elemento de chat original (app-chat-list-item/app-queue-item).
     * @param {HTMLElement} itemElement O elemento DOM do chat.
     * @param {number} index O índice para criar um ID único.
     * @returns {object} Objeto com os dados do chat.
     */
    function parseChatItemData(itemElement, index) {
        const spans = Array.from(itemElement.querySelectorAll('span.truncate'));
        const isMyChat = !!itemElement.closest('app-chat-list')?.querySelector('header span[title="Meus chats"], header span:first-child')?.textContent.includes('Meus chats');
        const isWaiting = !!itemElement.querySelector(SELECTORS.waitingStatus);
        const isAlert = !isWaiting && !!itemElement.querySelector(SELECTORS.alertIcon);

        return {
            id: `crx-item-${index}`,
            solicitante: spans[0]?.innerText.trim() || 'Usuário anônimo',
            revenda: spans[1]?.innerText.trim() || 'Sem revenda',
            categoria: itemElement.querySelector(SELECTORS.categoria)?.innerText.trim() || 'Sem Categoria',
            hasNotification: isWaiting || isAlert,
            isWaiting,
            isAlert,
            isActive: itemElement.classList.contains('active'),
            avatarImgSrc: itemElement.querySelector(SELECTORS.avatarImg)?.src,
            isMyChat,
            originalElement: itemElement,
        };
    }

    // =================================================================================
    // LÓGICA DE RENDERIZAÇÃO E ATUALIZAÇÃO DA UI
    // =================================================================================

    /**
     * Cria um elemento DOM para um item de chat, mas não o anexa.
     * @param {object} chatData - Os dados do chat.
     * @returns {HTMLElement} O elemento DOM criado.
     */
    function createChatItemElement(chatData) {
        const item = document.createElement('div');
        item.dataset.itemId = chatData.id;
        item.addEventListener('click', () => chatData.originalElement.click());

        const avatarHtml = chatData.avatarImgSrc
            ? `<img src="${chatData.avatarImgSrc}" class="crx-tg-avatar">`
            : `<div class="crx-tg-avatar is-icon">${ICONS.USER}</div>`;

        const badgeHtml = chatData.hasNotification ? `<div class="crx-tg-meta"><div class="crx-tg-badge"></div></div>` : '';

        item.innerHTML = `
            ${avatarHtml}
            <div class="crx-tg-content">
                <div class="crx-tg-title">${chatData.solicitante}</div>
                <div class="crx-tg-subtitle"><span>${chatData.revenda}</span></div>
            </div>
            ${badgeHtml}
        `;
        updateChatItemElement(item, chatData); // Aplica classes iniciais
        return item;
    }

    /**
     * Atualiza as classes e atributos de um elemento de chat existente.
     * @param {HTMLElement} element - O elemento a ser atualizado.
     * @param {object} data - Os novos dados do chat.
     */
    function updateChatItemElement(element, data) {
        const safeCategory = makeSafeForCSS(data.categoria);
        element.className = 'crx-tg-item'; // Reseta as classes
        element.classList.add(`crx-item-bg-${safeCategory}`);
        if (data.isActive) element.classList.add('active');
        if (data.isAlert) element.classList.add('is-alert');
        if (data.isWaiting) element.classList.add('is-waiting');
    }

    /**
     * Renderiza a estrutura principal da UI (contenedores, controles, etc.).
     * Esta função deve ser chamada apenas uma vez.
     */
    function renderInitialShell() {
        const originalContainer = document.querySelector(SELECTORS.mainContainer);
        if (!originalContainer || document.getElementById('crx-main-container')) return;

        const mainContainer = document.createElement('div');
        mainContainer.id = 'crx-main-container';
        originalContainer.appendChild(mainContainer);

        // Controles
        const controlsContainer = document.createElement('div');
        controlsContainer.className = 'crx-controls-container';
        const layoutBtn = document.createElement('button');
        layoutBtn.id = 'crx-layout-toggle';
        layoutBtn.title = 'Alternar Layout (Abas/Lista)';
        layoutBtn.innerHTML = ICONS.LAYOUT;
        layoutBtn.addEventListener('click', () => {
            STATE.activeLayout = (STATE.activeLayout === 'tabs') ? 'list' : 'tabs';
            GM_setValue('activeLayout', STATE.activeLayout);
            updateFullUI();
        });
        controlsContainer.appendChild(layoutBtn);
        mainContainer.appendChild(controlsContainer);

        // Contenedores para os layouts
        mainContainer.insertAdjacentHTML('beforeend', `
            <div id="crx-tabs-layout-container">
                <div class="crx-filter-tabs"></div>
                <div class="crx-chat-list-container"></div>
            </div>
            <div id="crx-list-layout-container" class="crx-chat-list-container"></div>
        `);
    }

    /**
     * A função principal que reconcilia o DOM.
     * Compara os chats existentes na página com os renderizados e faz o mínimo de alterações necessárias.
     */
    const updateChatList = debounce(() => {
        const allChatItems = Array.from(document.querySelectorAll(SELECTORS.allChatItems));
        if (allChatItems.length === 0 && STATE.renderedChats.size === 0) return; // Nada a fazer

        const newChatsData = new Map(allChatItems.map((el, i) => [el, parseChatItemData(el, i)]).map(entry => [entry[1].id, entry[1]]));
        const newChatIds = new Set(newChatsData.keys());
        const oldChatIds = new Set(STATE.renderedChats.keys());

        // 1. Remover chats que não existem mais
        for (const id of oldChatIds) {
            if (!newChatIds.has(id)) {
                STATE.renderedChats.get(id).element.remove();
                STATE.renderedChats.delete(id);
            }
        }

        // 2. Adicionar chats novos ou atualizar existentes
        for (const [id, data] of newChatsData.entries()) {
            if (oldChatIds.has(id)) {
                // Chat existente -> Atualizar
                const existing = STATE.renderedChats.get(id);
                updateChatItemElement(existing.element, data);
                existing.data = data; // Atualiza os dados armazenados
            } else {
                // Chat novo -> Criar e armazenar
                const newElement = createChatItemElement(data);
                STATE.renderedChats.set(id, { element: newElement, data: data });
            }
        }

        updateFullUI();
    }, CONFIG.UPDATE_DEBOUNCE_MS);

    /**
     * Atualiza a UI completa (layout, filtros, ordenação) com base no estado atual.
     */
    function updateFullUI() {
        const mainContainer = document.getElementById('crx-main-container');
        if (!mainContainer) return;

        mainContainer.className = 'crx-layout-' + STATE.activeLayout;

        const allChatsData = Array.from(STATE.renderedChats.values()).map(item => item.data);
        const myChats = allChatsData.filter(c => c.isMyChat);
        const otherChats = allChatsData.filter(c => !c.isMyChat);
        
        // Ordena os chats por prioridade (alerta > aguardando > normal)
        const sortChats = (a, b) => (b.isAlert ? 2 : b.isWaiting ? 1 : 0) - (a.isAlert ? 2 : a.isWaiting ? 1 : 0);
        myChats.sort(sortChats);
        otherChats.sort(sortChats);

        if (STATE.activeLayout === 'tabs') {
            updateTabsLayout(myChats, otherChats);
        } else {
            updateListLayout(myChats, otherChats);
        }
    }
    
    /** Atualiza o layout de Abas */
    function updateTabsLayout(myChats, otherChats) {
        const tabsContainer = document.querySelector('#crx-tabs-layout-container .crx-filter-tabs');
        const listContainer = document.querySelector('#crx-tabs-layout-container .crx-chat-list-container');
        if (!tabsContainer || !listContainer) return;

        // Atualizar abas
        const allChats = [...myChats, ...otherChats];
        const categoryCounts = allChats.reduce((acc, chat) => {
            acc.set(chat.categoria, (acc.get(chat.categoria) || 0) + 1);
            return acc;
        }, new Map());

        let tabsHtml = `<div class="crx-filter-tab ${STATE.activeFilter === 'Todos' ? 'active' : ''}" data-filter="Todos">Todos <span class="count">${allChats.length}</span></div>`;
        [...categoryCounts.entries()].sort().forEach(([category, count]) => {
            tabsHtml += `<div class="crx-filter-tab ${STATE.activeFilter === category ? 'active' : ''}" data-filter="${category}">${category.replace('Suporte - ','')} <span class="count">${count}</span></div>`;
        });
        tabsContainer.innerHTML = tabsHtml;

        // Anexar eventos às novas abas
        tabsContainer.querySelectorAll('.crx-filter-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                STATE.activeFilter = tab.getAttribute('data-filter');
                updateFullUI();
            });
        });

        // Atualizar lista
        listContainer.innerHTML = ''; // Limpa a lista para re-anexar os elementos na ordem correta
        const fragment = document.createDocumentFragment();

        const filteredMyChats = myChats.filter(chat => STATE.activeFilter === 'Todos' || chat.categoria === STATE.activeFilter);
        if (filteredMyChats.length > 0) {
            const header = document.createElement('div');
            header.className = 'crx-group-header';
            header.textContent = `Meus Chats (${filteredMyChats.length})`;
            fragment.appendChild(header);
            filteredMyChats.forEach(chat => fragment.appendChild(STATE.renderedChats.get(chat.id).element));
        }

        const filteredOtherChats = otherChats.filter(chat => STATE.activeFilter === 'Todos' || chat.categoria === STATE.activeFilter);
        const groupedChats = filteredOtherChats.reduce((acc, chat) => {
            (acc[chat.categoria] = acc[chat.categoria] || []).push(chat);
            return acc;
        }, {});

        Object.keys(groupedChats).sort().forEach(category => {
            const group = groupedChats[category];
            const header = document.createElement('div');
            header.className = 'crx-group-header';
            header.textContent = `${category} (${group.length})`;
            fragment.appendChild(header);
            group.forEach(chat => fragment.appendChild(STATE.renderedChats.get(chat.id).element));
        });
        
        listContainer.appendChild(fragment);
    }
    
    /** Atualiza o layout de Lista */
    function updateListLayout(myChats, otherChats) {
        const listContainer = document.getElementById('crx-list-layout-container');
        if (!listContainer) return;
        
        listContainer.innerHTML = ''; // Limpa para reordenar
        const fragment = document.createDocumentFragment();

        if (myChats.length > 0) {
            const header = document.createElement('div');
            header.className = 'crx-group-header';
            header.textContent = `Meus Chats (${myChats.length})`;
            fragment.appendChild(header);
            myChats.forEach(chat => fragment.appendChild(STATE.renderedChats.get(chat.id).element));
        }

        const groupedChats = otherChats.reduce((acc, chat) => {
            (acc[chat.categoria] = acc[chat.categoria] || []).push(chat);
            return acc;
        }, {});

        Object.keys(groupedChats).sort().forEach(category => {
            const group = groupedChats[category];
            const header = document.createElement('div');
            header.className = 'crx-group-header';
            header.textContent = `${category} (${group.length})`;
            fragment.appendChild(header);
            group.sort((a,b) => a.solicitante.localeCompare(b.solicitante)).forEach(chat => fragment.appendChild(STATE.renderedChats.get(chat.id).element));
        });

        listContainer.appendChild(fragment);
    }


    // =================================================================================
    // LÓGICA DE REGISTRO E MODAL (maioria mantida, com seletores atualizados)
    // =================================================================================
    // ... (As funções capturarDadosPagina, injetarBotaoRegistro, observarTags, abrirModalRegistro, etc., podem ser mantidas como no original, pois sua lógica interna é majoritariamente independente da renderização da lista)
    // Pequeno ajuste em capturarDadosPagina para usar o novo item
    function capturarDadosPagina() {
        let analista = document.querySelector('app-chat-list-container > header span.font-medium')?.innerText.trim() || '';
        const chatHeaderElement = document.querySelector(SELECTORS.chatAgentHeader);
        let numero = '';
        if (chatHeaderElement) {
            const titleElement = chatHeaderElement.querySelector('div > span');
            if(titleElement){
                 const match = titleElement.innerText.match(/#(\d+)/);
                 if(match) numero = match[1];
            }
        }
        
        const originalActiveItem = document.querySelector('app-chat-list-item.active, app-queue-item.active');
        let solicitante = '', revenda = '', servicoSelecionado = '';
        if (originalActiveItem) {
            const spans = Array.from(originalActiveItem.querySelectorAll('span.truncate'));
            solicitante = spans[0]?.innerText.trim() || '';
            revenda = spans[1]?.innerText.trim() || '';
            servicoSelecionado = originalActiveItem.querySelector('span.shrink-0')?.innerText.trim() || '';
        }

        return { analista, numero, revenda, solicitante, servicoSelecionado };
    }

    // O resto das funções do modal (injetarBotaoRegistro, etc.) podem ser coladas aqui sem modificação.


    // =================================================================================
    // INICIALIZAÇÃO E LOOP PRINCIPAL
    // =================================================================================

    /** Função de inicialização principal do script. */
    async function initialize() {
        if (STATE.isInitialized) return;
        STATE.isInitialized = true;

        injectStyles();

        const chatListContainer = await waitForElement(SELECTORS.mainContainer);
        log("Container de chat encontrado. Inicializando a UI customizada.");

        renderInitialShell();
        updateChatList(); // Primeira renderização

        const observer = new MutationObserver(updateChatList);
        observer.observe(chatListContainer, { childList: true, subtree: true });

        // Adiciona outras funcionalidades que precisam ser ativadas
        // (ex: indicador de versão, auto-refresh, etc.)
        // injetarIndicadorDeVersao();
        // setupIdleRefresh();
        log("B.Plus! inicializado e monitorando alterações.");
    }

    // Inicia o script quando a página estiver pronta
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
})();
