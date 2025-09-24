// ==UserScript==
// @name         B.Plus! - Otimizado v2.1 (Correção Visual)
// @namespace    http://tampermonkey.net/
// @version      14.1.0
// @description  Corrige a visualização de chats quebrada, mantendo os grupos recolhíveis e o separador para "Aguardando".
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
        SCRIPT_VERSION: GM_info.script.version || '14.1.0',
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
        statusTagSpan: 'app-tag span',
    };

    // --- ESTADO DA APLICAÇÃO ---
    const STATE = {
        activeFilter: 'Todos',
        activeLayout: GM_getValue('activeLayout', 'tabs'),
        collapsedGroups: new Set(JSON.parse(GM_getValue('collapsedGroups', '[]'))),
        renderedChats: new Map(),
        isInitialized: false,
    };

    // =================================================================================
    // FUNÇÕES UTILITÁRIAS
    // =================================================================================
    const log = (message) => console.log(`[B.Plus! v${CONFIG.SCRIPT_VERSION}] ${message}`);
    const debounce = (func, delay) => {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    };
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
            #bplus-custom-styles { display: none; }
            /* CORREÇÃO VISUAL: Esconde a lista original sem usar display:none */
            app-chat-list-container > section > ${SELECTORS.originalChatLists} {
                position: absolute !important; opacity: 0 !important;
                width: 0 !important; height: 0 !important;
                overflow: hidden !important; pointer-events: none !important;
                z-index: -999 !important;
            }

            #crx-main-container { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
            .crx-layout-tabs #crx-list-layout-container, .crx-layout-list #crx-tabs-layout-container { display: none; }

            .crx-filter-tabs {
                display: flex; flex-shrink: 0; overflow-x: auto; overflow-y: hidden;
                height: 48px; align-items: center; padding: 0 8px;
                background-color: #fff; border-bottom: 1px solid #e0e0e0;
            }
            .dark .crx-filter-tabs { background-color: #252535; border-bottom-color: #3e374e; }
            .crx-filter-tab { padding: 8px 12px; margin: 0 4px; border-radius: 6px; font-size: 13px; font-weight: 500; color: #666; cursor: pointer; white-space: nowrap; transition: all 0.2s; }
            .dark .crx-filter-tab { color: #aaa; }
            .crx-filter-tab:hover { background-color: #f0f0f0; }
            .dark .crx-filter-tab:hover { background-color: #3e374e; }
            .crx-filter-tab.active { font-weight: 600; }
            .crx-filter-tab .count { background-color: #e0e0e0; color: #555; border-radius: 10px; padding: 1px 6px; font-size: 11px; margin-left: 6px; }
            .dark .crx-filter-tab .count { background-color: #3e374e; color: #ccc; }

            .crx-group-header {
                display: flex; align-items: center; justify-content: space-between;
                padding: 12px 12px 4px; font-size: 13px; font-weight: 600; color: #6c757d;
                text-transform: uppercase; position: sticky; top: 0; background: inherit; z-index: 10;
                cursor: pointer; user-select: none; border-bottom: 1px solid #e0e0e0;
            }
            .dark .crx-group-header { color: #a0a0b0; border-bottom-color: #3e374e; }
            .crx-group-header.group-waiting { color: #e67e22; } /* Destaque para grupo "Aguardando" */
            .dark .crx-group-header.group-waiting { color: #f39c12; }
            .crx-group-header .crx-chevron { transition: transform 0.2s ease-in-out; }
            .crx-group-header.collapsed .crx-chevron { transform: rotate(-90deg); }
            .crx-chat-group-items.collapsed { display: none; }

            .crx-chat-list-container { flex-grow: 1; overflow-y: auto; background-color: #fff; }
            .dark .crx-chat-list-container { background-color: #252535; }
            .crx-tg-item { display: flex; align-items: center; padding: 8px 12px; border-bottom: 1px solid #f0f0f0; cursor: pointer; border-left: 5px solid transparent; transition: background-color 0.15s; }
            .dark .crx-tg-item { border-bottom-color: #3e374e; }
            .crx-tg-item.active { background-color: #5e47d0 !important; color: white; border-left-color: #5e47d0 !important; }
            .crx-tg-item.is-waiting { border-left-color: #FFA500 !important; background-color: ${hexToRgba('#FFA500', 0.08)} !important; }
            .dark .crx-tg-item.is-waiting { background-color: ${hexToRgba('#FFA500', 0.18)} !important; }
            .crx-tg-item.is-alert { border-left-color: #E57373 !important; }
            ${dynamicStyles}
        `);
    }

    // =================================================================================
    // LÓGICA DE DADOS E RENDERIZAÇÃO
    // =================================================================================
    function parseChatItemData(itemElement, index) {
        const spans = Array.from(itemElement.querySelectorAll('span.truncate'));
        const isWaiting = Array.from(itemElement.querySelectorAll(SELECTORS.statusTagSpan))
                               .some(span => span.textContent?.includes('Aguardando'));
        const isAlert = !isWaiting && !!itemElement.querySelector(SELECTORS.alertIcon);

        return {
            id: `crx-item-${index}`,
            solicitante: spans[0]?.innerText.trim() || 'Usuário',
            revenda: spans[1]?.innerText.trim() || 'Sem Revenda',
            categoria: itemElement.querySelector('span.shrink-0')?.innerText.trim() || 'Sem Categoria',
            isWaiting, isAlert,
            isActive: itemElement.classList.contains('active'),
            isMyChat: !!itemElement.closest('app-chat-list')?.querySelector('header span')?.textContent.includes('Meus chats'),
            originalElement: itemElement,
        };
    }

    function createChatItemElement(chatData) {
        const item = document.createElement('div');
        item.dataset.itemId = chatData.id;
        item.addEventListener('click', () => chatData.originalElement.click());
        item.innerHTML = `
            <div class="crx-tg-avatar is-icon">${ICONS.USER}</div>
            <div class="crx-tg-content">
                <div class="crx-tg-title">${chatData.solicitante}</div>
                <div class="crx-tg-subtitle"><span>${chatData.revenda}</span></div>
            </div>`;
        updateChatItemElement(item, chatData);
        return item;
    }

    function updateChatItemElement(element, data) {
        const safeCategory = makeSafeForCSS(data.categoria);
        element.className = 'crx-tg-item'; // Reseta classes
        element.classList.add(`crx-item-bg-${safeCategory}`);
        if (data.isActive) element.classList.add('active');
        if (data.isAlert) element.classList.add('is-alert');
        if (data.isWaiting) element.classList.add('is-waiting');
    }

    function renderInitialShell(container) {
        container.innerHTML = `
            <div id="crx-main-container">
                <div class="crx-controls-container">
                    <button id="crx-layout-toggle" title="Alternar Layout">${ICONS.LAYOUT}</button>
                </div>
                <div id="crx-tabs-layout-container">
                    <div class="crx-filter-tabs"></div>
                    <div class="crx-chat-list-container"></div>
                </div>
                <div id="crx-list-layout-container" class="crx-chat-list-container"></div>
            </div>`;
        
        document.getElementById('crx-layout-toggle').addEventListener('click', () => {
            STATE.activeLayout = (STATE.activeLayout === 'tabs') ? 'list' : 'tabs';
            GM_setValue('activeLayout', STATE.activeLayout);
            updateFullUI();
        });
    }

    const updateChatList = debounce(() => {
        const allChatItems = Array.from(document.querySelectorAll(SELECTORS.allChatItems));
        const newChatsData = new Map(allChatItems.map((el, i) => [el, parseChatItemData(el, i)]).map(entry => [entry[1].id, entry[1]]));
        const oldChatIds = new Set(STATE.renderedChats.keys());

        for (const id of oldChatIds) {
            if (!newChatsData.has(id)) {
                STATE.renderedChats.get(id)?.element.remove();
                STATE.renderedChats.delete(id);
            }
        }

        for (const [id, data] of newChatsData.entries()) {
            if (oldChatIds.has(id)) {
                const existing = STATE.renderedChats.get(id);
                updateChatItemElement(existing.element, data);
                existing.data = data;
            } else {
                const newElement = createChatItemElement(data);
                STATE.renderedChats.set(id, { element: newElement, data: data });
            }
        }
        updateFullUI();
    }, CONFIG.UPDATE_DEBOUNCE_MS);

    function updateFullUI() {
        const mainContainer = document.getElementById('crx-main-container');
        if (!mainContainer) return;
        mainContainer.className = 'crx-layout-' + STATE.activeLayout;

        const allChatsData = Array.from(STATE.renderedChats.values()).map(item => item.data);
        const sortFn = (a, b) => (b.isAlert ? 1 : 0) - (a.isAlert ? 1 : 0);

        const waitingChats = allChatsData.filter(c => c.isWaiting).sort(sortFn);
        const remainingChats = allChatsData.filter(c => !c.isWaiting);
        const myChats = remainingChats.filter(c => c.isMyChat).sort(sortFn);
        const otherChats = remainingChats.filter(c => !c.isMyChat).sort(sortFn);

        if (STATE.activeLayout === 'tabs') {
            updateTabsLayout(waitingChats, myChats, otherChats);
        } else {
            updateListLayout(waitingChats, myChats, otherChats);
        }
    }

    function appendGroupToFragment(fragment, title, chats, groupKey) {
        if (chats.length === 0) return;
        const isCollapsed = STATE.collapsedGroups.has(groupKey);
        
        const header = document.createElement('div');
        header.className = `crx-group-header ${isCollapsed ? 'collapsed' : ''}`;
        if (groupKey === 'group_waiting') header.classList.add('group-waiting');
        header.innerHTML = `<span>${title} (${chats.length})</span><span class="crx-chevron">${ICONS.CHEVRON}</span>`;

        const itemsContainer = document.createElement('div');
        itemsContainer.className = `crx-chat-group-items ${isCollapsed ? 'collapsed' : ''}`;
        chats.forEach(chat => itemsContainer.appendChild(STATE.renderedChats.get(chat.id).element));
        
        header.addEventListener('click', () => {
            STATE.collapsedGroups.has(groupKey) ? STATE.collapsedGroups.delete(groupKey) : STATE.collapsedGroups.add(groupKey);
            GM_setValue('collapsedGroups', JSON.stringify(Array.from(STATE.collapsedGroups)));
            header.classList.toggle('collapsed');
            itemsContainer.classList.toggle('collapsed');
        });
        fragment.append(header, itemsContainer);
    }
    
    function updateTabsLayout(waitingChats, myChats, otherChats) {
        const tabsContainer = document.querySelector('#crx-tabs-layout-container .crx-filter-tabs');
        const listContainer = document.querySelector('#crx-tabs-layout-container .crx-chat-list-container');
        if (!tabsContainer || !listContainer) return;
        
        const allChats = [...waitingChats, ...myChats, ...otherChats];
        const categoryCounts = allChats.reduce((acc, chat) => (acc.set(chat.categoria, (acc.get(chat.categoria) || 0) + 1), acc), new Map());
        tabsContainer.innerHTML = `<div class="crx-filter-tab ${STATE.activeFilter === 'Todos' ? 'active' : ''}" data-filter="Todos">Todos <span class="count">${allChats.length}</span></div>` +
            [...categoryCounts.entries()].sort().map(([category, count]) =>
                `<div class="crx-filter-tab ${STATE.activeFilter === category ? 'active' : ''}" data-filter="${category}">${category.replace('Suporte - ','')} <span class="count">${count}</span></div>`
            ).join('');
        tabsContainer.querySelectorAll('.crx-filter-tab').forEach(tab => tab.addEventListener('click', () => { STATE.activeFilter = tab.dataset.filter; updateFullUI(); }));

        listContainer.innerHTML = '';
        const fragment = document.createDocumentFragment();
        const filterFn = chat => STATE.activeFilter === 'Todos' || chat.categoria === STATE.activeFilter;

        appendGroupToFragment(fragment, "Aguardando Atendimento", waitingChats.filter(filterFn), "group_waiting");
        appendGroupToFragment(fragment, "Meus Chats", myChats.filter(filterFn), "group_mychats");
        
        const groupedChats = otherChats.filter(filterFn).reduce((acc, chat) => ((acc[chat.categoria] = acc[chat.categoria] || []).push(chat), acc), {});
        Object.keys(groupedChats).sort().forEach(category => appendGroupToFragment(fragment, category, groupedChats[category], `group_${makeSafeForCSS(category)}`));
        
        listContainer.appendChild(fragment);
    }
    
    function updateListLayout(waitingChats, myChats, otherChats) {
        const listContainer = document.getElementById('crx-list-layout-container');
        if (!listContainer) return;
        listContainer.innerHTML = '';
        const fragment = document.createDocumentFragment();

        appendGroupToFragment(fragment, "Aguardando Atendimento", waitingChats, "group_waiting");
        appendGroupToFragment(fragment, "Meus Chats", myChats, "group_mychats");

        const groupedChats = otherChats.reduce((acc, chat) => ((acc[chat.categoria] = acc[chat.categoria] || []).push(chat), acc), {});
        Object.keys(groupedChats).sort().forEach(category => appendGroupToFragment(fragment, category, groupedChats[category], `group_${makeSafeForCSS(category)}`));

        listContainer.appendChild(fragment);
    }

    // =================================================================================
    // INICIALIZAÇÃO
    // =================================================================================
    async function initialize() {
        if (STATE.isInitialized) return;
        STATE.isInitialized = true;

        injectStyles();
        const mainSection = await waitForElement(SELECTORS.mainContainer);
        log("Container de chat encontrado. Inicializando UI.");

        renderInitialShell(mainSection);
        updateChatList();

        const observer = new MutationObserver(updateChatList);
        observer.observe(mainSection, { childList: true, subtree: true });
        
        log("B.Plus! inicializado e monitorando alterações.");
    }

    // Garante que o script execute no momento certo
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
})();
