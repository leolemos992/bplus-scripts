// ==UserScript==
// @name         B.PLUS
// @namespace    http://tampermonkey.net/
// @version      16.5 // Correção crítica de clique: Garante que o chat correto seja aberto.
// @description  Renderização otimizada de chats com correção de referência de clique para garantir a abertura correta da conversa.
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
        SCRIPT_VERSION: GM_info.script.version || '15.0.5',
        UPDATE_DEBOUNCE_MS: 250, // Reduzido para resposta mais rápida
    };

    // --- ÍCONES SVG ---
    const ICONS = {
        USER: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"></path></svg>`,
        LAYOUT: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>`,
        CHEVRON: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"></path></svg>`,
        WARNING: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"></path></svg>`
    };

    // --- SELETORES DE DOM ---
    const SELECTORS = {
        mainContainer: 'app-chat-list-container > section',
        originalChatLists: 'app-chat-list, app-queue-list',
        allChatItems: 'app-chat-list-item, app-queue-item',
        alertIcon: 'app-icon[icon="tablerAlertCircle"]',
        statusTag: 'app-tag',
        unreadCountBadge: 'div[class*="bg-red-600"]',
        serviceWarningIcon: 'app-icon[icon="tablerExclamationCircle"]'
    };

    // --- ESTADO DA APLICAÇÃO ---
    const STATE = {
        activeFilter: 'Todos',
        activeLayout: GM_getValue('activeLayout', 'tabs'),
        collapsedGroups: new Set(JSON.parse(GM_getValue('collapsedGroups', '[]'))),
        // A chave será o elemento HTML original, e o valor será o {dados, elemento customizado}
        // Isso nos permite associar diretamente o elemento original ao seu gêmeo customizado.
        renderedChats: new Map(),
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
        const CATEGORY_COLORS = { /* ... Cores ... */ };
        let dynamicStyles = '';
        GM_addStyle(`
            #bplus-custom-styles{display:none}
            body.bplus-active app-chat-list-container>section>:is(app-chat-list,app-queue-list){display:none!important}
            #crx-main-container{display:flex;flex-direction:column;height:100%;overflow:hidden}
            .crx-layout-tabs #crx-list-layout-container,.crx-layout-list #crx-tabs-layout-container{display:none}
            .crx-controls-container{display:flex;justify-content:flex-end;padding:4px 8px;background-color:var(--primary-100,#fff);border-bottom:1px solid var(--border-color,#e0e0e0)}
            .dark .crx-controls-container{background-color:var(--primary-700,#252535);border-bottom-color:var(--border-dark,#3e374e)}
            #crx-layout-toggle{background:0 0;border:none;color:var(--text-color-secondary,#666);cursor:pointer;padding:6px;border-radius:4px;transition:background-color .2s}
            #crx-layout-toggle:hover{background-color:var(--primary-200,#eee)}
            .dark #crx-layout-toggle{color:var(--text-color-dark-secondary,#aaa)}
            .dark #crx-layout-toggle:hover{background-color:var(--primary-600,#3e374e)}
            .crx-filter-tabs{display:flex;flex-shrink:0;overflow-x:auto;overflow-y:hidden;height:48px;align-items:center;padding:0 8px;background-color:var(--primary-100,#fff);border-bottom:1px solid var(--border-color,#e0e0e0)}
            .dark .crx-filter-tabs{background-color:var(--primary-700,#252535);border-bottom-color:var(--border-dark,#3e374e)}
            .crx-filter-tab{padding:8px 12px;margin:0 4px;border-radius:6px;font-size:13px;font-weight:500;color:var(--text-color-secondary,#666);cursor:pointer;white-space:nowrap;transition:all .2s}
            .dark .crx-filter-tab{color:var(--text-color-dark-secondary,#aaa)}
            .crx-filter-tab.active{font-weight:600}
            .crx-filter-tab .count{background-color:var(--primary-200,#e0e0e0);color:var(--text-color-tertiary,#555);border-radius:10px;padding:1px 6px;font-size:11px;margin-left:6px}
            .dark .crx-filter-tab .count{background-color:var(--primary-600,#3e374e);color:var(--text-color-dark-tertiary,#ccc)}
            .crx-group-header{display:flex;align-items:center;justify-content:space-between;padding:12px 12px 4px;font-size:13px;font-weight:600;color:var(--text-color-secondary,#6c757d);text-transform:uppercase;position:sticky;top:0;background:inherit;z-index:10;cursor:pointer;user-select:none;border-bottom:1px solid var(--border-color,#e0e0e0)}
            .dark .crx-group-header{color:var(--text-color-dark-secondary,#a0a0b0);border-bottom-color:var(--border-dark,#3e374e)}
            .crx-group-header.group-waiting{color:#e67e22}.dark .crx-group-header.group-waiting{color:#f39c12}
            .crx-group-header .crx-chevron{transition:transform .2s ease-in-out}
            .crx-group-header.collapsed .crx-chevron{transform:rotate(-90deg)}
            .crx-chat-group-items.collapsed{display:none}
            .crx-chat-list-container{flex-grow:1;overflow-y:auto;background-color:var(--primary-100,#fff)}
            .dark .crx-chat-list-container{background-color:var(--primary-700,#252535)}
            .crx-tg-item{position: relative; display:flex;align-items:center;padding:8px 12px;border-bottom:1px solid var(--border-color,#f0f0f0);cursor:pointer;border-left:5px solid transparent;transition:background-color .15s}
            .dark .crx-tg-item{border-bottom-color:var(--border-dark,#3e374e)}
            .crx-tg-item.active{background-color:var(--primary-color,#5e47d0)!important;color:#fff;border-left-color:var(--primary-color,#5e47d0)!important}
            .crx-tg-item.active .crx-tg-avatar,.crx-tg-item.active .crx-tg-subtitle,.crx-tg-item.active .crx-tg-title{color:#fff!important}
            .crx-tg-item.is-waiting{border-left-color:#ffa500!important;background-color:${hexToRgba('#FFA500',.08)}!important}
            .dark .crx-tg-item.is-waiting{background-color:${hexToRgba('#FFA500',.18)}!important}
            .crx-tg-item.is-alert{border-left-color:#e57373!important}
            .crx-tg-avatar{flex-shrink:0;width:32px;height:32px;display:flex;align-items:center;justify-content:center;border-radius:50%;background-color:var(--primary-200,#e0e0e0);color:var(--text-color-tertiary,#555)}
            .dark .crx-tg-avatar{background-color:var(--primary-600,#3e374e);color:var(--text-color-dark-tertiary,#ccc)}
            .crx-tg-avatar svg{width:20px;height:20px}
            .crx-tg-content{flex-grow:1;min-width:0;margin-left:8px}
            .crx-tg-title{font-weight:500;font-size:14px;color:var(--text-color-primary,#333);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
            .dark .crx-tg-title{color:var(--text-color-dark-primary,#f0f0f0)}
            .crx-tg-subtitle{display:flex;align-items:center;font-size:11px;color:var(--text-color-tertiary,#777);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px}
            .dark .crx-tg-subtitle{color:var(--text-color-dark-tertiary,#b0b0b0)}
            .crx-tg-subtitle > span:first-child { flex-shrink: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
            .crx-tg-meta { display: flex; flex-direction: column; align-items: flex-end; justify-content: flex-start; margin-left: 8px; flex-shrink: 0; height: 100%; padding-top: 2px;}
            .crx-unread-badge { display: none; background-color: #ef4444; color: white; font-size: 10px; font-weight: 600; border-radius: 9999px; min-width: 18px; height: 18px; padding: 2px 5px; text-align: center; line-height: 14px; }
            .crx-service-warning-icon { display: none; align-items: center; justify-content: center; color: #f59e0b; margin-left: 4px; flex-shrink: 0; cursor: pointer; }
            .crx-service-warning-icon svg { width: 14px; height: 14px; }
            ${dynamicStyles}
        `);
    }

    // =================================================================================
    // LÓGICA DE DADOS E RENDERIZAÇÃO
    // =================================================================================
    function parseChatItemData(itemElement) {
        // ... (lógica de parsing inalterada) ...
        return { /* ... dados do chat ... */ };
    }

    function createChatItemElement(chatData) {
        const item = document.createElement('div');
        // A MUDANÇA MAIS IMPORTANTE:
        // O event listener agora está vinculado diretamente à referência do elemento original
        // que foi passada no objeto chatData. Isso é garantido e sempre atualizado.
        item.addEventListener('click', () => chatData.originalElement.click());
        item.innerHTML = `
            <div class="crx-tg-avatar is-icon">${ICONS.USER}</div>
            <div class="crx-tg-content">
                <div class="crx-tg-title"></div>
                <div class="crx-tg-subtitle">
                    <span></span>
                    <span class="crx-service-warning-icon" title="Serviço incorreto"></span>
                </div>
            </div>
            <div class="crx-tg-meta">
                <span class="crx-unread-badge"></span>
            </div>
        `;
        updateChatItemElement(item, chatData);
        return item;
    }

    function updateChatItemElement(element, data) {
        // ... (lógica de atualização inalterada) ...
    }
    
    // As funções que não precisam de alteração foram omitidas para manter o código limpo.
    // O código completo deve ser usado no script final.
    function renderInitialShell(container) { /* ... */ }
    function updateFullUI(forceRebuild = false) { /* ... */ }
    function appendGroupToFragment(fragment, title, chats, groupKey) { /* ... */ }
    function applyChatFilter() { /* ... */ }
    function updateTabsLayout(waiting, my, other) { /* ... */ }
    function updateListLayout(waiting, my, other) { /* ... */ }
    
    // =================================================================================
    // NÚCLEO DA CORREÇÃO - LÓGICA DE SINCRONIZAÇÃO
    // =================================================================================
    const updateChatList = debounce(() => {
        // 1. Obtém a lista atual de todos os itens de chat originais do Beemore.
        const allOriginalItems = Array.from(document.querySelectorAll(SELECTORS.allChatItems));
        
        // 2. Cria um novo Map para armazenar a nova lista de chats renderizados.
        //    Isso garante que estamos sempre trabalhando com dados frescos.
        const newRenderedChats = new Map();
        
        // 3. Itera sobre cada item original encontrado na página.
        allOriginalItems.forEach(originalElement => {
            // Extrai os dados visuais do elemento original.
            const data = parseChatItemData(originalElement);
            
            // Cria um novo elemento customizado para a nossa UI.
            // O `chatData` passado para esta função contém a referência `originalElement`,
            // que é a chave para o clique funcionar corretamente.
            const customElement = createChatItemElement(data);
            
            // Armazena no novo Map, usando o elemento original como chave.
            newRenderedChats.set(originalElement, { data: data, element: customElement });
        });
        
        // 4. Substitui completamente o estado antigo pelo novo.
        //    Isso descarta quaisquer referências antigas e inválidas.
        STATE.renderedChats = newRenderedChats;
        
        // 5. Força uma reconstrução completa da UI com os novos elementos e referências corretas.
        updateFullUI(true);

    }, CONFIG.UPDATE_DEBOUNCE_MS);

    // ... (O resto do script que não foi alterado)

    async function initialize() {
        if (STATE.isInitialized) return;
        injectStyles();
        await waitForElement(SELECTORS.allChatItems);
        log("Chats originais detectados. Iniciando UI do B.Plus!.");

        STATE.isInitialized = true;
        const mainSection = document.querySelector(SELECTORS.mainContainer);
        if (!mainSection) { log("ERRO: Container principal não encontrado."); return; }

        renderInitialShell(mainSection);
        document.body.classList.add('bplus-active');
        
        // Primeira execução para popular a lista
        updateChatList();

        // Observa o container para futuras mudanças
        const observer = new MutationObserver(updateChatList);
        observer.observe(mainSection, { childList: true, subtree: true });
        log("B.Plus! carregado e monitorando.");
    }
    
    if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', initialize); } else { initialize(); }
})();
