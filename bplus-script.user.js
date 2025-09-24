// ==UserScript==
// @name         B.PLUS
// @namespace    http://tampermonkey.net/
// @version      17.0.0 // Híbrido: Fundação estável (v10) + Features e correções de clique (v15).
// @description  Combina a estabilidade da renderização do v10 com os recursos e a precisão de dados do v15, incluindo a correção definitiva para cliques incorretos e a exibição de chats em espera.
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
        SCRIPT_VERSION: GM_info.script.version || '15.0.6',
        UPDATE_INTERVAL_MS: 1500, // Intervalo para verificar mudanças no DOM
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
        allChatItems: 'app-chat-list-item, app-queue-item',
        unreadCountBadge: 'div[class*="bg-red-600"]',
        serviceWarningIcon: 'app-icon[icon="tablerExclamationCircle"]'
    };

    // --- ESTADO DA APLICAÇÃO ---
    const STATE = {
        activeFilter: 'Todos',
        activeLayout: GM_getValue('activeLayout', 'tabs'),
        collapsedGroups: new Set(JSON.parse(GM_getValue('collapsedGroups', '[]'))),
        lastChatCount: 0,
        isInitialized: false,
    };

    // =================================================================================
    // FUNÇÕES UTILITÁRIAS
    // =================================================================================
    const log = (message) => console.log(`[B.Plus! v${CONFIG.SCRIPT_VERSION}] ${message}`);
    const makeSafeForCSS = (name) => name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    const hexToRgba = (hex, alpha) => {
        let r=0,g=0,b=0;
        if(hex.length==4){r=parseInt(hex[1]+hex[1],16);g=parseInt(hex[2]+hex[2],16);b=parseInt(hex[3]+hex[3],16);}
        else if(hex.length==7){r=parseInt(hex.substring(1,3),16);g=parseInt(hex.substring(3,5),16);b=parseInt(hex.substring(5,7),16);}
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
            #bplus-custom-styles{display:none}
            body.bplus-active app-chat-list-container > section > :is(app-chat-list, app-queue-list) { display: none !important; }
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
        let solicitante = 'Usuário Desconhecido';
        let revenda = 'Sem Revenda';
        let categoria = 'Sem Categoria';

        const mainSection = itemElement.querySelector('section');
        if (mainSection) {
            const topDiv = mainSection.querySelector('div');
            if (topDiv) {
                solicitante = topDiv.querySelector('span.font-medium')?.innerText.trim() || solicitante;
                categoria = topDiv.querySelector('span.shrink-0')?.innerText.trim() || categoria;
            }
            const revendaElement = topDiv?.nextElementSibling;
            if (revendaElement && revendaElement.tagName === 'SPAN') {
                const tempRevendaText = revendaElement.innerText.trim();
                const waitingTextMatch = tempRevendaText.match(/Aguardando(\s\(.*\))?/);
                let cleanedRevendaText = tempRevendaText;
                if (waitingTextMatch) cleanedRevendaText = tempRevendaText.replace(waitingTextMatch[0], '').trim();
                if (cleanedRevendaText) revenda = cleanedRevendaText;
            }
        }
        
        const unreadElement = itemElement.querySelector(SELECTORS.unreadCountBadge);
        const unreadCount = unreadElement ? parseInt(unreadElement.innerText, 10) || 0 : 0;
        
        const serviceWarningElement = itemElement.querySelector(SELECTORS.serviceWarningIcon);
        const hasServiceWarning = !!serviceWarningElement;
        const originalServiceWarningButton = hasServiceWarning ? serviceWarningElement.closest('button') : null;

        const isWaiting = Array.from(itemElement.querySelectorAll('app-tag')).some(tag => tag.textContent?.toLowerCase().includes('aguardando'));
        const isAlert = !isWaiting && !!itemElement.querySelector(SELECTORS.alertIcon);

        return {
            solicitante, revenda, categoria, isWaiting, isAlert,
            unreadCount, hasServiceWarning, originalServiceWarningButton,
            isActive: itemElement.classList.contains('active'),
            isMyChat: !!itemElement.closest('app-chat-list')?.querySelector('header span')?.textContent.includes('Meus chats'),
            originalElement: itemElement,
        };
    }

    function createAndAppendCustomItem(container, chatData) {
        const item = document.createElement('div');
        item.addEventListener('click', () => chatData.originalElement.click());
        
        const safeCategory = makeSafeForCSS(chatData.categoria);
        item.className = `crx-tg-item crx-item-bg-${safeCategory}`;
        if(chatData.isActive) item.classList.add('active');
        if(chatData.isAlert) item.classList.add('is-alert');
        if(chatData.isWaiting) item.classList.add('is-waiting');
        item.dataset.category = chatData.categoria;

        item.innerHTML = `
            <div class="crx-tg-avatar is-icon">${ICONS.USER}</div>
            <div class="crx-tg-content">
                <div class="crx-tg-title">${chatData.solicitante}</div>
                <div class="crx-tg-subtitle">
                    <span>${chatData.revenda}</span>
                    <span class="crx-service-warning-icon" title="Serviço incorreto"></span>
                </div>
            </div>
            <div class="crx-tg-meta">
                <span class="crx-unread-badge"></span>
            </div>
        `;
        
        const unreadBadge = item.querySelector('.crx-unread-badge');
        if (chatData.unreadCount > 0) {
            unreadBadge.textContent = chatData.unreadCount;
            unreadBadge.style.display = 'block';
        }

        const warningIcon = item.querySelector('.crx-service-warning-icon');
        if (chatData.hasServiceWarning && chatData.originalServiceWarningButton) {
            warningIcon.innerHTML = ICONS.WARNING;
            warningIcon.style.display = 'inline-flex';
            warningIcon.onclick = (e) => {
                e.stopPropagation();
                chatData.originalServiceWarningButton.click();
            };
        }
        
        container.appendChild(item);
    }
    
    // =================================================================================
    // LÓGICA DE RENDERIZAÇÃO E ATUALIZAÇÃO
    // =================================================================================
    function rebuildAndRenderUI() {
        const allOriginalItems = Array.from(document.querySelectorAll(SELECTORS.allChatItems));
        
        if (allOriginalItems.length === STATE.lastChatCount && document.getElementById('crx-main-container')) {
            // Se o número de chats não mudou, podemos pular a reconstrução completa para evitar piscar a tela
            // Apenas atualizamos o filtro se necessário.
            if(STATE.activeLayout === 'tabs') applyChatFilter();
            return;
        }
        STATE.lastChatCount = allOriginalItems.length;

        const mainContainer = document.getElementById('crx-main-container');
        if (!mainContainer) return;

        mainContainer.className = 'crx-layout-' + STATE.activeLayout;

        const allChatsData = allOriginalItems.map(parseChatItemData);
        
        const sortFn = (a, b) => (b.isAlert - a.isAlert) || (b.isWaiting - a.isWaiting);
        const waitingChats = allChatsData.filter(c => c.isWaiting).sort(sortFn);
        const remaining = allChatsData.filter(c => !c.isWaiting);
        const myChats = remaining.filter(c => c.isMyChat).sort(sortFn);
        const otherChats = remaining.filter(c => !c.isMyChat).sort(sortFn);

        if (STATE.activeLayout === 'tabs') {
            updateTabsLayout(waitingChats, myChats, otherChats);
        } else {
            updateListLayout(waitingChats, myChats, otherChats);
        }
    }

    function updateTabsLayout(waiting, my, other) {
        let container = document.getElementById('crx-tabs-layout-container');
        if(!container) return;
        
        const allChats = [...waiting, ...my, ...other];
        const counts = allChats.reduce((a, c) => (a.set(c.categoria, (a.get(c.categoria) || 0) + 1), a), new Map());
        
        let tabsHtml = `<div class="crx-filter-tab ${STATE.activeFilter === 'Todos' ? 'active' : ''}" data-filter="Todos">Todos <span class="count">${allChats.length}</span></div>` + 
                       [...counts.entries()].sort().map(([cat, cnt]) => `<div class="crx-filter-tab ${STATE.activeFilter === cat ? 'active' : ''}" data-filter="${cat}">${cat.replace('Suporte - ','')} <span class="count">${cnt}</span></div>`).join('');
        
        const tabsContainer = container.querySelector('.crx-filter-tabs');
        if (tabsContainer) tabsContainer.innerHTML = tabsHtml;

        const listContainer = container.querySelector('.crx-chat-list-container');
        if (listContainer) {
            listContainer.innerHTML = '';
            appendGroupsToContainer(listContainer, waiting, my, other);
            applyChatFilter();
        }

        tabsContainer.querySelectorAll('.crx-filter-tab').forEach(t => t.onclick = (e) => {
            STATE.activeFilter = e.currentTarget.dataset.filter;
            rebuildAndRenderUI();
        });
    }

    function updateListLayout(waiting, my, other) {
        let listContainer = document.getElementById('crx-list-layout-container');
        if(!listContainer) return;
        listContainer.innerHTML = '';
        appendGroupsToContainer(listContainer, waiting, my, other);
    }
    
    function appendGroupsToContainer(container, waiting, my, other) {
        appendGroupToFragment(container, "Aguardando Atendimento", waiting, "group_waiting");
        appendGroupToFragment(container, "Meus Chats", my, "group_mychats");

        const grouped = other.reduce((a, c) => ((a[c.categoria] = a[c.categoria] || []).push(c), a), {});
        Object.keys(grouped).sort().forEach(cat => appendGroupToFragment(container, cat, grouped[cat], `group_${makeSafeForCSS(cat)}`));
    }

    function appendGroupToFragment(container, title, chats, groupKey) {
        if (chats.length === 0) return;

        const isCollapsed = STATE.collapsedGroups.has(groupKey);
        const header = document.createElement('div');
        header.className = `crx-group-header ${isCollapsed ? 'collapsed' : ''}`;
        header.dataset.groupKey = groupKey;
        header.dataset.originalTitle = title;
        if (groupKey === 'group_waiting') header.classList.add('group-waiting');
        header.innerHTML = `<span>${title} (${chats.length})</span><span class="crx-chevron">${ICONS.CHEVRON}</span>`;
        
        const itemsContainer = document.createElement('div');
        itemsContainer.className = `crx-chat-group-items ${isCollapsed ? 'collapsed' : ''}`;
        
        chats.forEach(chatData => createAndAppendCustomItem(itemsContainer, chatData));
        
        header.addEventListener('click', () => {
            STATE.collapsedGroups.has(groupKey) ? STATE.collapsedGroups.delete(groupKey) : STATE.collapsedGroups.add(groupKey);
            GM_setValue('collapsedGroups', JSON.stringify(Array.from(STATE.collapsedGroups)));
            header.classList.toggle('collapsed');
            itemsContainer.classList.toggle('collapsed');
        });

        container.append(header, itemsContainer);
    }

    function applyChatFilter() {
        const listContainer = document.querySelector('#crx-tabs-layout-container .crx-chat-list-container');
        if (!listContainer) return;

        listContainer.querySelectorAll('.crx-group-header').forEach(header => {
            const itemsContainer = header.nextElementSibling;
            if (!itemsContainer) return;

            let visibleItemsCount = 0;
            Array.from(itemsContainer.children).forEach(item => {
                const isVisible = STATE.activeFilter === 'Todos' || item.dataset.category === STATE.activeFilter;
                item.style.display = isVisible ? '' : 'none';
                if (isVisible) visibleItemsCount++;
            });

            header.style.display = visibleItemsCount > 0 ? '' : 'none';
            header.querySelector('span:first-child').textContent = `${header.dataset.originalTitle} (${visibleItemsCount})`;
        });
    }

    // =================================================================================
    // INICIALIZAÇÃO
    // =================================================================================
    function initialize() {
        if (STATE.isInitialized) return;
        STATE.isInitialized = true;
        
        injectStyles();
        
        const mainSection = document.querySelector(SELECTORS.mainContainer);
        if (!mainSection) { log("ERRO: Container principal não encontrado."); return; }
        
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
            <div id="crx-list-layout-container" class="crx-chat-list-container"></div>`;
        mainSection.appendChild(shell);

        document.getElementById('crx-layout-toggle').addEventListener('click', () => {
            STATE.activeLayout = (STATE.activeLayout === 'tabs') ? 'list' : 'tabs';
            GM_setValue('activeLayout', STATE.activeLayout);
            rebuildAndRenderUI();
        });

        document.body.classList.add('bplus-active');
        
        // Usa um MutationObserver para disparar a reconstrução de forma eficiente
        const observer = new MutationObserver(rebuildAndRenderUI);
        observer.observe(mainSection, { childList: true, subtree: true });

        // Execução inicial
        rebuildAndRenderUI();
        
        log("B.Plus! carregado e monitorando.");
    }
    
    waitForElement(SELECTORS.allChatItems).then(initialize);
})();
