// ==UserScript==
// @name         Beemore+ Custom Chat UI
// @namespace    http://tampermonkey.net/
// @version      1.02
// @description  Substitui a interface de chat do Beemore por uma UI customizada com React, inspirada no Telegram.
// @author       Jose Leonardo Lemos
// @match        https://*.beemore.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @grant        GM_info
// @require      https://unpkg.com/react@18/umd/react.production.min.js
// @require      https://unpkg.com/react-dom@18/umd/react-dom.production.min.js
// @require      https://unpkg.com/@babel/standalone/babel.min.js
// ==/UserScript==

/* @jsx React.createElement */

(function() {
    'use strict';

    // Evita que o script rode em iframes
    if (window.top !== window.self) {
        return;
    }

    // --- CONFIGURAÇÕES ---
    const SCRIPT_VERSION = GM_info.script.version;
    const INACTIVITY_TIMEOUT_SECONDS = 90; // Tempo em segundos para o refresh automático

    // Mapeamento de cores para categorias. Adicione mais se necessário.
    const CATEGORY_COLORS = {
        default: { bg: 'bg-gray-200', text: 'text-gray-800', hoverBg: 'hover:bg-gray-300' },
        'PDV': { bg: 'bg-blue-200', text: 'text-blue-800', hoverBg: 'hover:bg-blue-300' },
        'Fiscal': { bg: 'bg-green-200', text: 'text-green-800', hoverBg: 'hover:bg-green-300' },
        'Financeiro': { bg: 'bg-yellow-200', text: 'text-yellow-800', hoverBg: 'hover:bg-yellow-300' },
        'Técnico': { bg: 'bg-red-200', text: 'text-red-800', hoverBg: 'hover:bg-red-300' },
        'Implantação': { bg: 'bg-purple-200', text: 'text-purple-800', hoverBg: 'hover:bg-purple-300' },
    };

    // --- FUNÇÕES AUXILIARES ---
    /**
     * Gera uma cor consistente baseada no nome da categoria.
     * @param {string} categoryName - O nome da categoria.
     * @returns {object} - Objeto com classes de cor (bg, text, hoverBg).
     */
    const getCategoryAppearance = (categoryName) => {
        for (const key in CATEGORY_COLORS) {
            if (categoryName.toLowerCase().includes(key.toLowerCase())) {
                return CATEGORY_COLORS[key];
            }
        }
        return CATEGORY_COLORS.default;
    };

    /**
     * Abrevia o nome da categoria para exibição nas abas.
     * @param {string} categoryName - O nome completo da categoria.
     * @returns {string} - O nome abreviado.
     */
    const abbreviateCategory = (categoryName) => {
        if (categoryName === "Sem Categoria") return "N/C";
        const parts = categoryName.split(/[- ]/);
        return parts[parts.length - 1] || "Chat";
    };


    // --- INJEÇÃO DE ESTILOS (CSS) ---
    GM_addStyle(`
        /* Oculta a lista de chats original do Beemore */
        app-chat-list-container > section {
            display: none !important;
        }

        /* Estilo para o container root do React */
        #beemore-plus-root {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            height: 100%;
            display: flex;
            flex-direction: column;
        }

        /* Indicador de Versão "B+" */
        #bplus-version-indicator {
            position: relative;
            padding: 10px;
            margin: 5px 0;
            text-align: center;
            cursor: pointer;
        }
        #bplus-version-indicator .bplus-icon {
            font-size: 24px;
            font-weight: bold;
            color: #ff9800; /* Laranja */
        }
        #bplus-version-indicator .bplus-tooltip {
            visibility: hidden;
            width: 180px;
            background-color: #333;
            color: #fff;
            text-align: center;
            border-radius: 6px;
            padding: 5px 0;
            position: absolute;
            z-index: 100;
            bottom: 125%;
            left: 50%;
            margin-left: -90px;
            opacity: 0;
            transition: opacity 0.3s;
        }
        #bplus-version-indicator:hover .bplus-tooltip {
            visibility: visible;
            opacity: 1;
        }

        /* --- CLASSES DE UTILITÁRIO (Inspiradas no Tailwind CSS) --- */
        /* Flexbox & Layout */
        .flex { display: flex; }
        .flex-col { flex-direction: column; }
        .items-center { align-items: center; }
        .justify-between { justify-content: space-between; }
        .flex-grow { flex-grow: 1; }
        .flex-shrink-0 { flex-shrink: 0; }

        /* Espaçamento */
        .p-2 { padding: 0.5rem; }
        .px-3 { padding-left: 0.75rem; padding-right: 0.75rem; }
        .py-1 { padding-top: 0.25rem; padding-bottom: 0.25rem; }
        .py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; }
        .m-1 { margin: 0.25rem; }
        .ml-3 { margin-left: 0.75rem; }
        .space-x-2 > :not([hidden]) ~ :not([hidden]) { margin-left: 0.5rem; }

        /* Tipografia */
        .text-sm { font-size: 0.875rem; }
        .text-xs { font-size: 0.75rem; }
        .font-bold { font-weight: 700; }
        .truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        /* Cores (geradas dinamicamente, mas com fallbacks) */
        .text-gray-600 { color: #4B5563; }
        .bg-gray-100 { background-color: #F3F4F6; }
        .bg-gray-200 { background-color: #E5E7EB; }
        .bg-gray-300 { background-color: #D1D5DB; }
        .bg-blue-200 { background-color: #BFDBFE; }
        .hover\\:bg-blue-300:hover { background-color: #93C5FD; }
        .text-blue-800 { color: #1E40AF; }
        .bg-green-200 { background-color: #A7F3D0; }
        .hover\\:bg-green-300:hover { background-color: #6EE7B7; }
        .text-green-800 { color: #065F46; }
        .bg-yellow-200 { background-color: #FDE68A; }
        .hover\\:bg-yellow-300:hover { background-color: #FCD34D; }
        .text-yellow-800 { color: #92400E; }
        .bg-red-200 { background-color: #FECACA; }
        .hover\\:bg-red-300:hover { background-color: #FCA5A5; }
        .text-red-800 { color: #991B1B; }
        .bg-purple-200 { background-color: #DDD6FE; }
        .hover\\:bg-purple-300:hover { background-color: #C4B5FD; }
        .text-purple-800 { color: #5B21B6; }
        .bg-white { background-color: #FFFFFF; }
        .hover\\:bg-gray-100:hover { background-color: #F3F4F6; }

        /* Bordas e Formas */
        .rounded-full { border-radius: 9999px; }
        .rounded-lg { border-radius: 0.5rem; }
        .shadow-sm { box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05); }

        /* Outros */
        .cursor-pointer { cursor: pointer; }
        .overflow-y-auto { overflow-y: auto; }
        .overflow-x-auto { overflow-x: auto; }
        .whitespace-nowrap { white-space: nowrap; }

        /* Componentes Customizados */
        .bplus-chat-item.selected {
            background-color: #3B82F6 !important; /* Azul de seleção */
            color: white;
        }
        .bplus-chat-item.selected .text-gray-600 {
            color: #E5E7EB;
        }
        .bplus-notification-dot {
            width: 1.25rem;
            height: 1.25rem;
            border-radius: 9999px;
            background-color: #F97316; /* Laranja */
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 0.75rem;
            font-weight: bold;
        }
    `);

    // --- LÓGICA PRINCIPAL DO SCRIPT ---

    /**
     * Função principal que inicializa a aplicação React e outras funcionalidades.
     */
    function runApp() {
        const originalListContainer = document.querySelector('app-chat-list-container');
        if (!originalListContainer || document.getElementById('beemore-plus-root')) {
            return; // Já foi iniciado ou o container não existe
        }

        const originalList = originalListContainer.querySelector('section');
        if (originalList) {
            originalList.style.display = 'none'; // Oculta a lista original
        }

        // Cria o ponto de montagem para a aplicação React
        const reactRoot = document.createElement('div');
        reactRoot.id = 'beemore-plus-root';
        originalListContainer.prepend(reactRoot);

        // O código React e JSX é colocado dentro de uma string de template
        const jsxString = `
            const { useState, useEffect, useMemo, useCallback } = React;

            // --- COMPONENTES REACT ---

            const ChatItem = ({ chat, colors }) => {
                const handleClick = () => {
                    if (chat.originalElementRef) {
                        chat.originalElementRef.click();
                    }
                };

                const itemClasses = [
                    'bplus-chat-item',
                    'flex', 'items-center', 'p-2', 'cursor-pointer', 'transition-colors', 'duration-150',
                    colors.bg, colors.hoverBg,
                    chat.isSelected ? 'selected' : ''
                ].join(' ');

                return (
                    <div className={itemClasses} onClick={handleClick}>
                        <img src={chat.avatarUrl} className="w-12 h-12 rounded-full flex-shrink-0" alt="Avatar" />
                        <div className="ml-3 flex-grow truncate">
                            <p className="font-bold truncate">{chat.solicitante}</p>
                            <p className="text-sm text-gray-600 truncate">{chat.revenda}</p>
                        </div>
                        <div className="flex-shrink-0 ml-2">
                            {chat.hasNotification && <div className="bplus-notification-dot">!</div>}
                        </div>
                    </div>
                );
            };

            const CollapsibleCategory = ({ category, chats, colors }) => {
                const [isExpanded, setIsExpanded] = useState(true);

                // Memoriza estado de expansão/recolhimento
                useEffect(() => {
                    const savedState = GM_getValue('category_state_' + category, true);
                    setIsExpanded(savedState);
                }, [category]);

                const toggle = () => {
                    const newState = !isExpanded;
                    setIsExpanded(newState);
                    GM_setValue('category_state_' + category, newState);
                };

                return (
                    <div>
                        <div
                            className={'flex justify-between items-center p-2 cursor-pointer ' + colors.bg}
                            onClick={toggle}
                        >
                            <h3 className={'font-bold ' + colors.text}>{category}</h3>
                            <span className={'px-2 py-1 text-xs rounded-full font-bold ' + colors.text}>
                                {chats.length}
                            </span>
                        </div>
                        {isExpanded && (
                            <div>
                                {chats.map(chat => <ChatItem key={chat.id} chat={chat} colors={getCategoryAppearance(chat.categoria)} />)}
                            </div>
                        )}
                    </div>
                );
            };


            const App = () => {
                const [chats, setChats] = useState([]);
                const [layout, setLayout] = useState(GM_getValue('bplus_layout_pref', 'Abas'));
                const [activeTab, setActiveTab] = useState('Todos');

                // Salva a preferência de layout quando ela muda
                useEffect(() => {
                    GM_setValue('bplus_layout_pref', layout);
                }, [layout]);

                // Efeito para observar o DOM e extrair os dados dos chats
                useEffect(() => {
                    const targetNode = document.querySelector('app-chat-list-container > section');
                    if (!targetNode) return;

                    const parseChats = () => {
                        const chatElements = targetNode.querySelectorAll('app-chat-list-item, app-queue-item');
                        const parsedData = Array.from(chatElements).map((el, index) => {
                            // AJUSTAR SELETORES AQUI, SE NECESSÁRIO
                            const solicitante = el.querySelector('.name-solicitant')?.textContent.trim() || 'Desconhecido';
                            const revenda = el.querySelector('.company-solicitant')?.textContent.trim() || 'N/A';
                            // Tenta encontrar a categoria em um elemento específico.
                            const categoriaEl = el.querySelector('.info-wrapper p:last-child');
                            const categoria = categoriaEl && !categoriaEl.textContent.includes('@') ? categoriaEl.textContent.trim() : 'Sem Categoria';
                            const hasNotification = !!el.querySelector('.notification'); // Um ícone ou badge de notificação
                            const isSelected = el.classList.contains('active');
                            const avatarUrl = el.querySelector('app-avatar img')?.src || 'https://via.placeholder.com/50';
                            // Verifica se o chat está na lista de "Meus" ou "Outros"
                            const ownership = el.closest('#div-meus-atendimentos') ? 'Meus chats' : 'Outros';

                            return {
                                id: solicitante + '-' + index, // Chave única simples
                                solicitante,
                                revenda,
                                categoria,
                                hasNotification,
                                isSelected,
                                avatarUrl,
                                ownership,
                                originalElementRef: el,
                            };
                        });
                        setChats(parsedData);
                    };

                    const observer = new MutationObserver(parseChats);
                    observer.observe(targetNode, { childList: true, subtree: true });

                    parseChats(); // Parse inicial

                    return () => observer.disconnect();
                }, []);

                const categories = useMemo(() => {
                    const uniqueCategories = [...new Set(chats.map(c => c.categoria))];
                    return ['Todos', ...uniqueCategories.sort()];
                }, [chats]);

                const filteredChats = useMemo(() => {
                    if (activeTab === 'Todos') return chats;
                    return chats.filter(chat => chat.categoria === activeTab);
                }, [chats, activeTab]);

                const groupedChats = useMemo(() => {
                    return chats.reduce((acc, chat) => {
                        const category = chat.categoria;
                        if (!acc[category]) {
                            acc[category] = [];
                        }
                        acc[category].push(chat);
                        return acc;
                    }, {});
                }, [chats]);

                return (
                    <div className="h-full flex flex-col bg-white">
                        {/* Painel de Controle */}
                        <div className="p-2 bg-gray-100 flex-shrink-0 flex justify-between items-center shadow-sm">
                            <h2 className="font-bold text-lg">Beemore+</h2>
                            <div>
                                <button
                                    onClick={() => setLayout(layout === 'Abas' ? 'Lista' : 'Abas')}
                                    className="px-3 py-1 text-sm bg-gray-300 rounded-lg"
                                >
                                    Alternar Layout: {layout}
                                </button>
                            </div>
                        </div>

                        {/* Layout de Abas */}
                        {layout === 'Abas' && (
                            <div className="flex-shrink-0 overflow-x-auto whitespace-nowrap p-2 bg-gray-100">
                                {categories.map(cat => {
                                    const count = cat === 'Todos' ? chats.length : chats.filter(c => c.categoria === cat).length;
                                    if(count === 0 && cat !== 'Todos') return null;
                                    const colors = getCategoryAppearance(cat);
                                    const isActive = activeTab === cat;
                                    const tabClasses = \`
                                        inline-block px-3 py-1 m-1 rounded-lg cursor-pointer text-sm font-bold
                                        \${isActive ? colors.bg + ' ' + colors.text : 'bg-gray-200'}
                                    \`;
                                    return (
                                        <div key={cat} className={tabClasses} onClick={() => setActiveTab(cat)}>
                                            {abbreviateCategory(cat)} ({count})
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Lista de Chats */}
                        <div className="flex-grow overflow-y-auto">
                            {layout === 'Abas' && activeTab === 'Todos' && Object.keys(groupedChats).map(category => (
                                <CollapsibleCategory
                                    key={category}
                                    category={category}
                                    chats={groupedChats[category]}
                                    colors={getCategoryAppearance(category)}
                                />
                            ))}
                             {layout === 'Abas' && activeTab !== 'Todos' && filteredChats.map(chat => (
                                <ChatItem key={chat.id} chat={chat} colors={getCategoryAppearance(chat.categoria)} />
                            ))}
                            {layout === 'Lista' && Object.keys(groupedChats).map(category => (
                                <CollapsibleCategory
                                    key={category}
                                    category={category}
                                    chats={groupedChats[category]}
                                    colors={getCategoryAppearance(category)}
                                />
                            ))}
                        </div>
                    </div>
                );
            };

            // --- FUNÇÕES AUXILIARES GLOBAIS PARA O REACT ---
            const CATEGORY_COLORS = ${JSON.stringify(CATEGORY_COLORS)};

            const getCategoryAppearance = (categoryName) => {
                 for (const key in CATEGORY_COLORS) {
                    if (categoryName.toLowerCase().includes(key.toLowerCase())) {
                        return CATEGORY_COLORS[key];
                    }
                }
                return CATEGORY_COLORS.default;
            };

            const abbreviateCategory = (categoryName) => {
                if (categoryName === "Sem Categoria") return "N/C";
                const parts = categoryName.split(/[- ]/);
                return parts[parts.length - 1] || "Chat";
            };

            // Renderiza a aplicação React no DOM
            const container = document.getElementById('beemore-plus-root');
            const root = ReactDOM.createRoot(container);
            root.render(<App />);
        `;

        // Transforma o JSX em JS puro usando Babel e o executa
        try {
            const transformedCode = Babel.transform(jsxString, { presets: ['react'] }).code;
            const script = document.createElement('script');
            script.textContent = transformedCode;
            document.body.appendChild(script).remove(); // Adiciona, executa e remove o script
        } catch (e) {
            console.error("Erro ao transformar JSX:", e);
        }
    }


    /**
     * Adiciona o indicador de versão "B+" na barra lateral.
     */
    function addVersionIndicator() {
        // AJUSTAR SELETOR para a barra lateral esquerda, se necessário
        const sidebar = document.querySelector('app-sidebar .content-wrapper');
        if (sidebar && !document.getElementById('bplus-version-indicator')) {
            const indicator = document.createElement('div');
            indicator.id = 'bplus-version-indicator';
            indicator.innerHTML = `
                <div class="bplus-icon">B+</div>
                <span class="bplus-tooltip">Beemore+ v${SCRIPT_VERSION} - Operacional</span>
            `;
            sidebar.appendChild(indicator);
        }
    }

    /**
     * Configura o refresh automático por inatividade.
     */
    function setupInactivityRefresh() {
        let inactivityTimer;

        const resetTimer = () => {
            clearTimeout(inactivityTimer);
            inactivityTimer = setTimeout(() => {
                // Verifica se há um chat ativo antes de dar refresh
                // AJUSTAR SELETOR para o item de chat ativo/selecionado
                const activeChat = document.querySelector('app-chat-list-container > section .active');
                if (!activeChat && window.location.href.includes('/chat')) {
                    console.log('Beemore+: Inatividade detectada. Atualizando lista de chats.');
                    // AJUSTAR SELETORES para os links de navegação
                    const dashboardLink = document.querySelector('a.nav-link[href="/dashboard"]');
                    const chatLink = document.querySelector('a.nav-link[href="/chat"]');

                    if (dashboardLink && chatLink) {
                        dashboardLink.click();
                        setTimeout(() => chatLink.click(), 1000); // Espera 1s para voltar
                    }
                } else {
                     console.log('Beemore+: Inatividade detectada, mas um chat está ativo. Refresh cancelado.');
                }
            }, INACTIVITY_TIMEOUT_SECONDS * 1000);
        };

        window.addEventListener('mousemove', resetTimer, false);
        window.addEventListener('mousedown', resetTimer, false);
        window.addEventListener('keypress', resetTimer, false);

        resetTimer(); // Inicia o timer
    }

    // --- PONTO DE ENTRADA ---
    // Espera o container da lista de chats carregar antes de iniciar tudo
    const initObserver = new MutationObserver((mutations, obs) => {
        const chatListContainer = document.querySelector('app-chat-list-container');
        if (chatListContainer) {
            runApp();
            addVersionIndicator();
            setupInactivityRefresh();
            obs.disconnect(); // Para de observar uma vez que o app foi iniciado
        }
    });

    initObserver.observe(document.body, {
        childList: true,
        subtree: true
    });

})();
