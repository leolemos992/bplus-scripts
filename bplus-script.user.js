// ==UserScript==
// @name         B.Plus! Interface (React Edition)
// @namespace    http://tampermonkey.net/
// @version      1.02
// @description  Versão funcional e completa da interface com React, corrigindo o bug da lista em branco e implementando todas as funcionalidades visuais.
// @author       Jose Leonardo Lemos
// @match        https://*.beemore.com/*
// @require      https://unpkg.com/react@18/umd/react.production.min.js
// @require      https://unpkg.com/react-dom@18/umd/react-dom.production.min.js
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_info
// ==/UserScript==

(function() {
    'use strict';

    // --- CONFIGURAÇÕES GERAIS ---
    const SCRIPT_VERSION = GM_info.script.version || '10.1';
    const CATEGORY_COLORS = {
        'Suporte - PDV': '#E57373', 'Suporte - Retaguarda': '#64B5F6', 'Suporte - Fiscal': '#81C784',
        'Suporte - Web': '#FFD54F', 'Suporte - Mobile': '#FFB74D',
        'Sem Categoria': '#9575CD', 'default': '#BDBDBD'
    };
    const e = React.createElement;

    // --- FUNÇÕES AUXILIARES ---
    function hexToRgba(hex, alpha) {
        let r = 0, g = 0, b = 0;
        if (hex.length == 4) { r = parseInt(hex[1] + hex[1], 16); g = parseInt(hex[2] + hex[2], 16); b = parseInt(hex[3] + hex[3], 16); }
        else if (hex.length == 7) { r = parseInt(hex.substring(1, 3), 16); g = parseInt(hex.substring(3, 5), 16); b = parseInt(hex.substring(5, 7), 16); }
        return `rgba(${r},${g},${b},${alpha})`;
    }

    // --- INJEÇÃO DE ESTILOS ---
    function injectStyles() {
        if (document.getElementById('bplus-custom-styles')) return;
        let styles = '';
        for (const category in CATEGORY_COLORS) {
            const safeCategory = category.replace(/[\s-]+/g, '-').toLowerCase();
            const color = CATEGORY_COLORS[category];
            styles += `
                .crx-item-bg-${safeCategory} { background-color: ${hexToRgba(color, 0.1)} !important; }
                .dark .crx-item-bg-${safeCategory} { background-color: ${hexToRgba(color, 0.15)} !important; }
                .crx-tg-item.crx-border-${safeCategory} { border-left-color: ${color} !important; }
                .crx-filter-tab[data-filter="${category}"].active { background-color: ${color} !important; color: white !important; }
                .dark .crx-filter-tab[data-filter="${category}"].active .count { background-color: rgba(0,0,0,0.2); color: white; }
                .crx-group-header-${safeCategory} { background-color: ${color} !important; color: white; }
            `;
        }
        GM_addStyle(`
            app-chat-list-container > section { display: none !important; }
            #bplus-react-root { height: 100%; }
            .crx-main-container { display: flex; flex-direction: column; height: 100%; background-color: #fff; }
            .dark .crx-main-container { background-color: #2b2636; }
            .crx-filter-tabs { display: flex; flex-shrink: 0; overflow-x: auto; padding: 0 8px; border-bottom: 1px solid #e0e0e0; scrollbar-width: thin; scrollbar-color: #ccc #f0f0f0; }
            .dark .crx-filter-tabs { border-bottom-color: #3e374e; scrollbar-color: #555 #3e374e; }
            .crx-filter-tabs::-webkit-scrollbar { height: 5px; } .crx-filter-tabs::-webkit-scrollbar-track { background: #f0f0f0; } .crx-filter-tabs::-webkit-scrollbar-thumb { background-color: #ccc; border-radius: 10px; }
            .dark .crx-filter-tabs::-webkit-scrollbar-track { background: #3e374e; } .dark .crx-filter-tabs::-webkit-scrollbar-thumb { background-color: #555; }
            .crx-filter-tab { padding: 8px 6px; margin: 0 6px; font-size: 13px; font-weight: 500; color: #666; cursor: pointer; border-bottom: 2px solid transparent; white-space: nowrap; transition: all 0.2s ease-in-out; }
            .dark .crx-filter-tab { color: #aaa; }
            .crx-filter-tab .count { background-color: #f0f0f0; color: #555; border-radius: 10px; padding: 1px 7px; font-size: 11px; margin-left: 6px; }
            .dark .crx-filter-tab .count { background-color: #3e374e; color: #ccc; }
            .crx-filter-tab.active { font-weight: 600; border-radius: 6px 6px 0 0; border-bottom: none; }
            #crx-chat-list-container { flex-grow: 1; overflow-y: auto; }
            .crx-group-header { font-size: 0.8rem; font-weight: 600; text-shadow: 1px 1px 2px rgba(0,0,0,0.2); padding: 6px 12px; text-transform: uppercase; margin-top: 10px; position: sticky; top: 0; z-index: 10; }
            .crx-tg-item { display: flex; align-items: center; padding: 8px 12px; border-bottom: 1px solid #f0f0f0; cursor: pointer; position: relative; transition: background-color 0.15s ease-in-out; border-left: 4px solid transparent; }
            .dark .crx-tg-item { border-bottom-color: #3e374e; }
            .crx-tg-item:hover { background-color: #f5f5f5 !important; }
            .dark .crx-tg-item:hover { background-color: #3e374e !important; }
            .crx-tg-item.active { background-color: #e3f2fd !important; }
            .dark .crx-tg-item.active { background-color: #4a4a6a !important; }
            .crx-tg-avatar { width: 42px; height: 42px; border-radius: 50%; margin-right: 12px; object-fit: cover; background-color: #e0e0e0; flex-shrink: 0; }
            .dark .crx-tg-avatar { background-color: #555; }
            .crx-tg-content { flex-grow: 1; overflow: hidden; }
            .crx-tg-title { font-weight: 600; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .crx-tg-subtitle { font-size: 13px; color: #666; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: flex; align-items: center; gap: 8px; }
            .dark .crx-tg-subtitle { color: #aaa; }
            .crx-tg-meta { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); }
            .crx-tg-badge { background-color: #FFA500; border-radius: 50%; width: 10px; height: 10px; }
        `);
    }

    // --- CAPTURA DE DADOS ---
    function scrapeBeemoreData() {
        const allItems = document.querySelectorAll('app-chat-list-item, app-queue-item');
        return Array.from(allItems).map((item, index) => {
            const isMyChat = !!item.closest('app-chat-list')?.querySelector('header span')?.textContent.includes('Meus chats');
            const spans = Array.from(item.querySelectorAll('span.truncate'));
            const categoriaElement = item.querySelector('span.shrink-0');
            return {
                id: `chat-${index}-${spans[0]?.innerText || ''}`,
                solicitante: spans[0]?.innerText.trim() || 'Usuário anônimo',
                revenda: spans[1]?.innerText.trim() || 'Sem revenda',
                categoria: categoriaElement ? categoriaElement.innerText.trim() : 'Sem Categoria',
                hasNotification: !!item.querySelector('app-icon[icon="tablerAlertCircle"], span[class*="text-red"]'),
                isActive: item.classList.contains('active'),
                avatarImgSrc: item.querySelector('app-user-picture img')?.src,
                isMyChat: isMyChat,
                originalElement: item
            };
        });
    }

    // --- COMPONENTES REACT ---
    const ChatItem = ({ chat }) => {
        const safeCategory = chat.categoria.replace(/[\s-]+/g, '-').toLowerCase();
        return e('div', {
                className: `crx-tg-item ${chat.isActive ? 'active' : ''} crx-item-bg-${safeCategory} crx-border-${safeCategory}`,
                onClick: () => chat.originalElement.click()
            },
            e('img', { src: chat.avatarImgSrc, className: 'crx-tg-avatar' }),
            e('div', { className: 'crx-tg-content' },
                e('div', { className: 'crx-tg-title' }, chat.solicitante),
                e('div', { className: 'crx-tg-subtitle' }, chat.revenda)
            ),
            chat.hasNotification && e('div', { className: 'crx-tg-meta' }, e('div', { className: 'crx-tg-badge' }))
        );
    };

    const ChatList = ({ chats, title }) => {
        if (!chats || chats.length === 0) return null;
        return e(React.Fragment, null,
            e('div', { className: 'crx-group-header' }, `${title} [${chats.length}]`),
            ...chats.map(chat => e(ChatItem, { key: chat.id, chat }))
        );
    };

    const App = () => {
        const [chats, setChats] = React.useState([]);
        const [activeFilter, setActiveFilter] = React.useState('Todos');
        
        React.useEffect(() => {
            const targetNode = document.querySelector('app-chat-list-container > section');
            if (!targetNode) return;
            const updateData = () => setChats(scrapeBeemoreData());
            const observer = new MutationObserver(updateData);
            observer.observe(targetNode, { childList: true, subtree: true });
            updateData();
            return () => observer.disconnect();
        }, []);

        const allCategories = [...new Set(chats.map(c => c.categoria))].sort();
        const categoryCounts = chats.reduce((acc, chat) => {
            acc[chat.categoria] = (acc[chat.categoria] || 0) + 1;
            return acc;
        }, {});

        const myChats = chats.filter(c => c.isMyChat && (activeFilter === 'Todos' || c.categoria === activeFilter));
        const otherChats = chats.filter(c => !c.isMyChat && (activeFilter === 'Todos' || c.categoria === activeFilter));

        return e('div', { className: 'crx-main-container' },
            e('div', { className: 'crx-filter-tabs' },
                e('div', {
                    className: `crx-filter-tab ${activeFilter === 'Todos' ? 'active' : ''}`,
                    onClick: () => setActiveFilter('Todos'),
                    'data-filter': 'Todos'
                }, 'Todos', e('span', { className: 'count' }, chats.length)),
                ...allCategories.map(cat => e('div', {
                    key: cat,
                    className: `crx-filter-tab ${activeFilter === cat ? 'active' : ''}`,
                    onClick: () => setActiveFilter(cat),
                    'data-filter': cat
                }, cat.replace('Suporte - ', ''), e('span', { className: 'count' }, categoryCounts[cat] || 0)))
            ),
            e('div', { id: 'crx-chat-list-container' },
                e(ChatList, { chats: myChats, title: 'Meus Chats' }),
                e(ChatList, { chats: otherChats, title: 'Fila de Atendimento' })
            )
        );
    };
    
    // --- INICIALIZAÇÃO ---
    function initialize() {
        const targetNode = document.querySelector('app-chat-list-container');
        const originalList = document.querySelector('app-chat-list-container > section');
        if (!targetNode || !originalList) return;
        
        originalList.style.display = 'none'; // Oculta a lista original

        let reactRootEl = document.getElementById('bplus-react-root');
        if (!reactRootEl) {
            reactRootEl = document.createElement('div');
            reactRootEl.id = 'bplus-react-root';
            reactRootEl.style.height = 'calc(100% - 120px)'; // Ajusta a altura para caber o header
            targetNode.appendChild(reactRootEl);
            injectStyles();
            ReactDOM.createRoot(reactRootEl).render(e(App));
        }
    }

    const initObserver = new MutationObserver((mutations, obs) => {
        if (document.querySelector('app-chat-list-container > section')) {
            initialize();
            obs.disconnect();
        }
    });
    initObserver.observe(document.body, { childList: true, subtree: true });

})();
