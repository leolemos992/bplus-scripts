// ==UserScript==
// @name         B.Plus! Interface (Redesenhada)
// @namespace    http://tampermonkey.net/
// @version      1.03
// @description  Interface redesenhada com React, agrupando chats por categorias com cabeçalhos coloridos, inspirada no novo design.
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
    const SCRIPT_VERSION = GM_info.script.version || '2.0';
    const CATEGORY_COLORS = {
        'Suporte - Mobile': '#4A90E2',      // Azul
        'Suporte - PDV': '#D0021B',         // Vermelho
        'Suporte - Retaguarda': '#417505',  // Verde
        'Suporte - Fiscal': '#F5A623',      // Laranja
        'Suporte - Web': '#BD10E0',         // Roxo
        'Sem Categoria': '#777777',         // Cinza
        'default': '#BDBDBD'
    };
    const e = React.createElement;

    // --- INJEÇÃO DE ESTILOS ---
    function injectStyles() {
        if (document.getElementById('bplus-custom-styles-v2')) return;
        let styles = `
            /* Oculta a interface original do Beemore */
            app-chat-list-container > section { display: none !important; }
            #bplus-react-root { height: 100%; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
            .crx-main-container { display: flex; flex-direction: column; height: 100%; background-color: #F8F9FA; }
            .dark .crx-main-container { background-color: #212529; }

            /* Estilo da lista de chats */
            #crx-chat-list-container { flex-grow: 1; overflow-y: auto; padding: 0; }

            /* Cabeçalho do Grupo de Categoria */
            .crx-group-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 8px 12px;
                font-size: 0.75rem; /* 12px */
                font-weight: 700;
                color: white;
                text-transform: uppercase;
                cursor: pointer;
                position: sticky;
                top: 0;
                z-index: 10;
                border-radius: 4px;
                margin: 8px 8px 0 8px;
                transition: filter 0.2s;
            }
            .crx-group-header:hover { filter: brightness(0.95); }
            .crx-group-header .arrow {
                transition: transform 0.2s ease-in-out;
                font-size: 1rem;
            }
            .crx-group-header.collapsed .arrow { transform: rotate(-90deg); }
            .crx-chat-group.collapsed .crx-group-content { display: none; }

            /* Itens individuais do Chat */
            .crx-group-content { padding: 0 8px; }
            .crx-tg-item {
                display: flex;
                align-items: center;
                padding: 10px 8px;
                background-color: #fff;
                border-bottom: 1px solid #E9ECEF;
                cursor: pointer;
                transition: background-color 0.15s ease-in-out;
            }
            .crx-group-content > .crx-tg-item:last-child { border-bottom: none; }
            .dark .crx-tg-item { background-color: #343A40; border-bottom-color: #495057; }
            .crx-tg-item:hover { background-color: #F1F3F5; }
            .dark .crx-tg-item:hover { background-color: #495057; }

            /* Item ativo (conversa selecionada) */
            .crx-tg-item.active { background-color: #E6F7FF !important; }
            .dark .crx-tg-item.active { background-color: #0d3c5a !important; }

            /* Avatar e Conteúdo */
            .crx-tg-avatar {
                width: 40px;
                height: 40px;
                border-radius: 50%;
                margin-right: 12px;
                object-fit: cover;
                flex-shrink: 0;
            }
            .crx-tg-content {
                flex-grow: 1;
                overflow: hidden;
            }
            .crx-tg-title {
                font-weight: 600;
                font-size: 0.9rem; /* 14.4px */
                color: #212529;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .dark .crx-tg-title { color: #F8F9FA; }
            .crx-tg-subtitle {
                font-size: 0.8rem; /* 12.8px */
                color: #6C757D;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .dark .crx-tg-subtitle { color: #ADB5BD; }

            /* Meta (Notificação e Hora) */
            .crx-tg-meta {
                text-align: right;
                flex-shrink: 0;
                margin-left: 10px;
            }
            .crx-tg-time {
                font-size: 0.75rem; /* 12px */
                color: #6C757D;
                margin-bottom: 4px;
            }
            .dark .crx-tg-time { color: #ADB5BD; }
            .crx-tg-badge {
                background-color: #D0021B; /* Vermelho para destaque */
                color: white;
                border-radius: 10px;
                width: 20px;
                height: 20px;
                font-size: 0.75rem;
                font-weight: bold;
                display: flex;
                align-items: center;
                justify-content: center;
                margin-left: auto;
            }
        `;

        for (const category in CATEGORY_COLORS) {
            const safeCategory = category.replace(/[\s-]+/g, '-').toLowerCase();
            const color = CATEGORY_COLORS[category] || CATEGORY_COLORS['default'];
            styles += `.crx-group-header-${safeCategory} { background-color: ${color}; }`;
        }

        GM_addStyle(styles, 'bplus-custom-styles-v2');
    }

    // --- CAPTURA DE DADOS ---
    function scrapeBeemoreData() {
        const allItems = document.querySelectorAll('app-chat-list-item, app-queue-item');
        return Array.from(allItems).map((item, index) => {
            const spans = Array.from(item.querySelectorAll('span.truncate'));
            const categoriaElement = item.querySelector('span.shrink-0');
            const timeElement = item.querySelector('.text-right > span.truncate');

            // Heurística para contar notificações (pode precisar de ajuste)
            const notificationBadge = item.querySelector('span.absolute');
            const unreadCount = notificationBadge ? parseInt(notificationBadge.innerText, 10) || 1 : 0;

            return {
                id: `chat-${index}-${spans[0]?.innerText || ''}`,
                solicitante: spans[0]?.innerText.trim() || 'Usuário anônimo',
                revenda: spans[1]?.innerText.trim() || 'Sem revenda',
                categoria: categoriaElement ? categoriaElement.innerText.trim().replace('Suporte ', 'Suporte - ') : 'Sem Categoria',
                time: timeElement ? timeElement.innerText.trim() : '',
                unreadCount: unreadCount,
                isActive: item.classList.contains('active'),
                avatarImgSrc: item.querySelector('app-user-picture img')?.src,
                originalElement: item
            };
        });
    }

    // --- COMPONENTES REACT ---
    const ChatItem = ({ chat }) => {
        return e('div', {
                className: `crx-tg-item ${chat.isActive ? 'active' : ''}`,
                onClick: () => chat.originalElement.click()
            },
            e('img', { src: chat.avatarImgSrc, className: 'crx-tg-avatar' }),
            e('div', { className: 'crx-tg-content' },
                e('div', { className: 'crx-tg-title' }, chat.solicitante),
                e('div', { className: 'crx-tg-subtitle' }, chat.revenda)
            ),
            e('div', { className: 'crx-tg-meta' },
                e('div', { className: 'crx-tg-time' }, chat.time),
                chat.unreadCount > 0 && e('div', { className: 'crx-tg-badge' }, chat.unreadCount)
            )
        );
    };

    const ChatGroup = ({ category, chats }) => {
        const [isCollapsed, setIsCollapsed] = React.useState(false);

        if (!chats || chats.length === 0) return null;

        const safeCategory = category.replace(/[\s-]+/g, '-').toLowerCase();
        const headerClass = `crx-group-header crx-group-header-${safeCategory} ${isCollapsed ? 'collapsed' : ''}`;

        return e('div', { className: `crx-chat-group ${isCollapsed ? 'collapsed' : ''}` },
            e('div', {
                className: headerClass,
                onClick: () => setIsCollapsed(!isCollapsed)
            },
                e('span', null, `${category} (${chats.length})`),
                e('span', { className: 'arrow' }, '▼')
            ),
            e('div', { className: 'crx-group-content' },
                ...chats.map(chat => e(ChatItem, { key: chat.id, chat }))
            )
        );
    };

    const App = () => {
        const [chats, setChats] = React.useState([]);

        React.useEffect(() => {
            const targetNode = document.querySelector('app-chat-list-container > section');
            if (!targetNode) return;
            const updateData = () => setChats(scrapeBeemoreData());
            const observer = new MutationObserver(updateData);
            observer.observe(targetNode, { childList: true, subtree: true });
            updateData(); // Carga inicial
            return () => observer.disconnect();
        }, []);

        const groupedChats = chats.reduce((acc, chat) => {
            const category = chat.categoria || 'Sem Categoria';
            if (!acc[category]) {
                acc[category] = [];
            }
            acc[category].push(chat);
            return acc;
        }, {});

        // Ordena as categorias para manter uma ordem consistente
        const sortedCategories = Object.keys(groupedChats).sort((a, b) => a.localeCompare(b));

        return e('div', { className: 'crx-main-container' },
            e('div', { id: 'crx-chat-list-container' },
                sortedCategories.map(category =>
                    e(ChatGroup, {
                        key: category,
                        category: category,
                        chats: groupedChats[category]
                    })
                )
            )
        );
    };

    // --- INICIALIZAÇÃO ---
    function initialize() {
        const targetNode = document.querySelector('app-chat-list-container');
        if (!targetNode) return;
        
        let reactRootEl = document.getElementById('bplus-react-root');
        if (!reactRootEl) {
            reactRootEl = document.createElement('div');
            reactRootEl.id = 'bplus-react-root';
            // Ajusta a altura considerando o espaço do header da página original
            reactRootEl.style.height = 'calc(100% - 60px)';
            targetNode.appendChild(reactRootEl);
            injectStyles();
            ReactDOM.createRoot(reactRootEl).render(e(App));
        }
    }

    const initObserver = new MutationObserver((mutations, obs) => {
        if (document.querySelector('app-chat-list-container > section')) {
            initialize();
            obs.disconnect(); // Roda apenas uma vez
        }
    });
    initObserver.observe(document.body, { childList: true, subtree: true });

})();
