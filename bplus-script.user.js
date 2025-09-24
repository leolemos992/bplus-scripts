// ==UserScript==
// @name         Beemore+ Chat Interface
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Substitui a lista de chats do Beemore por uma UI customizada com React, inspirada no Telegram.
// @author       Jose Leonardo Lemos
// @match        https://*.beemore.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @require      https://unpkg.com/react@18/umd/react.production.min.js
// @require      https://unpkg.com/react-dom@18/umd/react-dom.production.min.js
// @require      https://unpkg.com/@babel/standalone/babel.min.js
// ==/UserScript==
/* jshint esversion: 11 */

(function() {
    'use strict';

    const SCRIPT_VERSION = '1.0';

    //--- CONFIGURAÇÕES ---//
    const INACTIVITY_REFRESH_SECONDS = 90; // Tempo em segundos para o auto-refresh

    //--- INJEÇÃO DE ESTILOS E SCRIPTS ---//
    function injectTailwind() {
        const script = document.createElement('script');
        script.src = 'https://cdn.tailwindcss.com';
        document.head.appendChild(script);

        const style = document.createElement('style');
        style.type = 'text/css';
        style.innerHTML = `
            /* Estilo para a barra de rolagem customizada */
            .custom-scrollbar::-webkit-scrollbar {
                width: 8px;
                height: 8px;
            }
            .custom-scrollbar::-webkit-scrollbar-track {
                background: #2d283a;
            }
            .custom-scrollbar::-webkit-scrollbar-thumb {
                background-color: #584d70;
                border-radius: 10px;
                border: 2px solid #2d283a;
            }
            .tooltip {
                visibility: hidden;
                background-color: #1f1b29;
                color: #fff;
                text-align: center;
                border-radius: 6px;
                padding: 5px 10px;
                position: absolute;
                z-index: 100;
                bottom: 125%;
                left: 50%;
                margin-left: -60px;
                opacity: 0;
                transition: opacity 0.3s;
                width: 120px;
            }
            .tooltip::after {
                content: "";
                position: absolute;
                top: 100%;
                left: 50%;
                margin-left: -5px;
                border-width: 5px;
                border-style: solid;
                border-color: #1f1b29 transparent transparent transparent;
            }
            #bplus-indicator:hover .tooltip {
                visibility: visible;
                opacity: 1;
            }
        `;
        document.head.appendChild(style);
    }

    //--- LÓGICA DE EXTRAÇÃO DE DADOS (PARSER) ---//
    function parseChatItem(itemElement, ownership) {
        try {
            const isQueueItem = itemElement.tagName.toLowerCase() === 'app-queue-item';
            
            const solicitanteElem = itemElement.querySelector('section > div:nth-child(1) > span:nth-child(1)');
            const solicitante = solicitanteElem ? solicitanteElem.textContent.trim() : 'N/A';

            const revendaElem = isQueueItem
                ? itemElement.querySelector('section > span:nth-child(2)')
                : itemElement.querySelector('section > span:nth-child(2) > span:nth-child(1)');
            const revenda = revendaElem ? revendaElem.textContent.trim() : 'N/A';

            const categoriaElem = itemElement.querySelector('section > div:nth-child(1) > span:nth-child(2)');
            const categoria = categoriaElem ? categoriaElem.textContent.trim() : 'Sem Categoria';

            const avatarElem = itemElement.querySelector('app-user-picture img');
            const avatarUrl = avatarElem ? avatarElem.src : null;

            const hasNotification = !!itemElement.querySelector('app-icon[icon="tablerAlertCircle"]') ||
                                    (isQueueItem && !!itemElement.querySelector('app-tag'));
            
            const isSelected = itemElement.classList.contains('active');

            return {
                id: `${ownership}-${solicitante}-${revenda}`,
                solicitante,
                revenda,
                categoria,
                avatarUrl,
                hasNotification,
                isSelected,
                ownership,
                originalElement: itemElement,
            };
        } catch (error) {
            console.error('Beemore+ Error parsing chat item:', error, itemElement);
            return null;
        }
    }

    function scrapeData() {
        const chats = [];
        const myChatsContainer = document.querySelector('app-chat-list:nth-of-type(1)');
        const otherChatsContainer = document.querySelector('app-chat-list:nth-of-type(2)');

        if (myChatsContainer) {
            const myChatItems = myChatsContainer.querySelectorAll('app-chat-list-item, app-queue-item');
            myChatItems.forEach(item => {
                const parsed = parseChatItem(item, 'Meus chats');
                if (parsed) chats.push(parsed);
            });
        }

        if (otherChatsContainer) {
            const otherChatItems = otherChatsContainer.querySelectorAll('app-chat-list-item, app-queue-item');
            otherChatItems.forEach(item => {
                const parsed = parseChatItem(item, 'Outros');
                if (parsed) chats.push(parsed);
            });
        }
        
        return chats;
    }

    //--- COMPONENTES REACT (JSX) ---//
    const App = () => {
        const [chats, setChats] = React.useState([]);
        const [layout, setLayout] = React.useState('tabs'); // 'tabs' ou 'list'
        const [activeTab, setActiveTab] = React.useState('Todos');
        const [collapsedCategories, setCollapsedCategories] = React.useState({});

        // Mapeamento de categorias para cores - adicione mais conforme necessário
        const categoryColors = {
            'Suporte - PDV': 'bg-blue-500',
            'Suporte - Fiscal': 'bg-red-500',
            'Suporte - Retaguarda': 'bg-green-500',
            'Suporte - Mobile': 'bg-purple-500',
            'Sem Categoria': 'bg-gray-500',
        };
        const getCategoryColor = (category) => categoryColors[category] || 'bg-yellow-500';

        React.useEffect(() => {
            // Carregar preferências salvas
            (async () => {
                const savedLayout = await GM_getValue('beemore_layout_preference', 'tabs');
                setLayout(savedLayout);
            })();

            const targetNode = document.querySelector('app-chat-list-container > section');
            if (!targetNode) return;

            const updateChats = () => {
                const newChats = scrapeData();
                setChats(newChats);
            };

            const observer = new MutationObserver((mutationsList) => {
                for (const mutation of mutationsList) {
                    if (mutation.type === 'childList' || mutation.type === 'attributes') {
                        updateChats();
                        break;
                    }
                }
            });

            observer.observe(targetNode, {
                attributes: true,
                childList: true,
                subtree: true
            });
            updateChats(); // Carga inicial

            return () => observer.disconnect();
        }, []);

        const toggleLayout = async () => {
            const newLayout = layout === 'tabs' ? 'list' : 'tabs';
            setLayout(newLayout);
            await GM_setValue('beemore_layout_preference', newLayout);
        };
        
        const toggleCategoryCollapse = (category) => {
            setCollapsedCategories(prev => ({ ...prev, [category]: !prev[category] }));
        };

        const categories = [...new Set(chats.map(c => c.categoria))];
        const filteredChats = activeTab === 'Todos' ? chats : chats.filter(c => c.categoria === activeTab);

        return (
            <div className="flex flex-col h-full bg-[#1c1823] text-white font-sans">
                {/* Cabeçalho de Controle */}
                <div className="flex items-center justify-between p-2 border-b border-gray-700 shrink-0">
                    <h1 className="text-lg font-bold">Beemore+</h1>
                    <button onClick={toggleLayout} className="p-2 rounded-md hover:bg-gray-700" title="Alternar Layout">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            {layout === 'tabs' ? <><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></> : <><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></>}
                        </svg>
                    </button>
                </div>

                {/* Layout de Abas */}
                {layout === 'tabs' && (
                    <div className="shrink-0 overflow-x-auto custom-scrollbar border-b border-gray-700">
                        <div className="flex p-2 space-x-2">
                            <button onClick={() => setActiveTab('Todos')} className={`px-3 py-1 text-sm rounded-full shrink-0 ${activeTab === 'Todos' ? 'bg-indigo-600' : 'bg-gray-700 hover:bg-gray-600'}`}>
                                Todos <span className="ml-1 px-2 text-xs rounded-full bg-gray-500">{chats.length}</span>
                            </button>
                            {categories.map(cat => (
                                <button key={cat} onClick={() => setActiveTab(cat)} className={`px-3 py-1 text-sm rounded-full shrink-0 ${activeTab === cat ? 'bg-indigo-600' : 'bg-gray-700 hover:bg-gray-600'}`}>
                                    {cat.replace('Suporte - ', '')}
                                    <span className={`ml-1 px-2 text-xs rounded-full ${getCategoryColor(cat)}`}>
                                        {chats.filter(c => c.categoria === cat).length}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                
                {/* Lista de Chats */}
                <div className="flex-grow overflow-y-auto custom-scrollbar">
                    {layout === 'tabs' && (activeTab !== 'Todos' ? filteredChats.map(chat => <ChatItem key={chat.id} chat={chat} categoryColor={getCategoryColor(chat.categoria)} />) : (
                         categories.map(cat => (
                             <div key={cat}>
                                 <h2 className={`p-2 text-sm font-bold sticky top-0 bg-[#1c1823] ${getCategoryColor(cat)} text-white`}>
                                     {cat} ({chats.filter(c => c.categoria === cat).length})
                                 </h2>
                                 {chats.filter(c => c.categoria === cat).map(chat => <ChatItem key={chat.id} chat={chat} categoryColor={getCategoryColor(chat.categoria)} />)}
                             </div>
                         ))
                    ))}

                    {layout === 'list' && (
                        categories.map(cat => (
                            <div key={cat}>
                                <h2 onClick={() => toggleCategoryCollapse(cat)} className={`flex justify-between items-center p-2 text-sm font-bold sticky top-0 bg-[#1c1823] cursor-pointer ${getCategoryColor(cat)} text-white`}>
                                    <span>{cat} ({chats.filter(c => c.categoria === cat).length})</span>
                                     <svg className={`w-4 h-4 transition-transform ${collapsedCategories[cat] ? 'rotate-0' : 'rotate-90'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                                </h2>
                                {!collapsedCategories[cat] && chats.filter(c => c.categoria === cat).map(chat => <ChatItem key={chat.id} chat={chat} categoryColor={getCategoryColor(chat.categoria)} />)}
                            </div>
                        ))
                    )}
                </div>
            </div>
        );
    };

    const ChatItem = ({ chat, categoryColor }) => {
        const handleItemClick = () => {
            if (chat.originalElement && typeof chat.originalElement.click === 'function') {
                chat.originalElement.click();
            }
        };

        const bgColor = chat.isSelected ? 'bg-indigo-800' : 'hover:bg-gray-800';

        return (
            <div onClick={handleItemClick} className={`flex items-center p-2 cursor-pointer border-b border-gray-800 transition-colors ${bgColor}`}>
                <div className="relative mr-3 shrink-0">
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-600 flex items-center justify-center">
                        {chat.avatarUrl ? (
                            <img src={chat.avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                        ) : (
                            <span className="text-xl font-bold text-white">{chat.solicitante.charAt(0)}</span>
                        )}
                    </div>
                     <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#1c1823] ${categoryColor}`}></div>
                </div>
                <div className="flex-grow overflow-hidden">
                    <div className="flex items-center justify-between">
                        <p className="font-bold truncate text-sm">{chat.solicitante}</p>
                        {chat.hasNotification && (
                             <span className="w-3 h-3 bg-orange-500 rounded-full shrink-0"></span>
                        )}
                    </div>
                    <p className="text-xs text-gray-400 truncate">{chat.revenda}</p>
                </div>
            </div>
        );
    };

    //--- LÓGICA DE INICIALIZAÇÃO E AUTO-REFRESH ---//
    let inactivityTimer;
    
    function resetInactivityTimer() {
        clearTimeout(inactivityTimer);
        inactivityTimer = setTimeout(performAutoRefresh, INACTIVITY_REFRESH_SECONDS * 1000);
    }
    
    function isUserInActiveChat() {
        // Se o template de "nenhum chat selecionado" está visível, o usuário não está em um chat.
        return !document.querySelector('app-empty-template');
    }

    function performAutoRefresh() {
        if (isUserInActiveChat()) {
            console.log('Beemore+: Auto-refresh adiado, usuário em chat ativo.');
            resetInactivityTimer(); // Adia o refresh
            return;
        }

        console.log('Beemore+: Realizando auto-refresh por inatividade.');
        const dashboardButton = document.querySelector('[data-sidebar-option="dashboard"]');
        const chatButton = document.querySelector('[data-sidebar-option="entities.chat"]');

        if (dashboardButton && chatButton) {
            dashboardButton.click();
            setTimeout(() => {
                chatButton.click();
                resetInactivityTimer(); // Reinicia o timer após o refresh
            }, 500);
        }
    }
    
    function addVersionIndicator() {
        const sidebar = document.querySelector('app-sidebar section:last-of-type');
        if (sidebar && !document.getElementById('bplus-indicator')) {
            const indicator = document.createElement('div');
            indicator.id = 'bplus-indicator';
            indicator.className = 'relative flex items-center justify-center w-9 h-9 cursor-pointer text-white font-bold text-lg bg-indigo-600 rounded-md';
            indicator.textContent = 'B+';
            
            const tooltip = document.createElement('div');
            tooltip.className = 'tooltip';
            tooltip.innerHTML = `Versão: ${SCRIPT_VERSION}<br>Status: Operacional`;
            
            indicator.appendChild(tooltip);
            sidebar.appendChild(indicator);
        }
    }


    function initialize() {
        const chatListContainer = document.querySelector('app-chat-list-container');
        if (!chatListContainer) {
            // Se não estamos na página de chat, não faz nada.
            return;
        }

        const originalSection = chatListContainer.querySelector('section');
        if (!originalSection || document.getElementById('beemore-plus-root')) {
            // Se a seção original não existe ou nosso script já rodou, sai.
            return;
        }

        console.log('Beemore+: Inicializando a nova interface.');

        injectTailwind();
        
        // Esconde a interface original
        chatListContainer.style.display = 'none';

        // Cria o ponto de montagem para o React
        const reactRootContainer = document.createElement('div');
        reactRootContainer.id = 'beemore-plus-root';
        // Usa a mesma largura que o container original para manter o layout da página
        reactRootContainer.style.width = chatListContainer.style.width || '23rem'; 
        reactRootContainer.style.height = '100%';
        chatListContainer.parentNode.insertBefore(reactRootContainer, chatListContainer);
        
        // Transpila o JSX e renderiza o app React
        const jsxCode = `
            ReactDOM.createRoot(document.getElementById('beemore-plus-root')).render(
                <React.StrictMode>
                    <App />
                </React.StrictMode>
            );
        `;
        const transpiledCode = Babel.transform(jsxCode, {
            presets: ['react']
        }).code;
        
        // Criando variáveis globais temporárias para o escopo do script
        window.React = React;
        window.ReactDOM = ReactDOM;
        window.App = App;
        window.ChatItem = ChatItem;

        const scriptElement = document.createElement('script');
        scriptElement.type = 'text/javascript';
        scriptElement.textContent = transpiledCode;
        document.body.appendChild(scriptElement);
        
        // Limpando as variáveis globais
        delete window.App;
        delete window.ChatItem;
        
        // Adiciona o indicador de versão
        addVersionIndicator();
        
        // Inicia o timer de inatividade
        document.addEventListener('mousemove', resetInactivityTimer);
        document.addEventListener('keydown', resetInactivityTimer);
        resetInactivityTimer();
    }
    
    // Roda o script quando a URL muda (para Single Page Applications como o Beemore)
    let lastUrl = location.href;
    new MutationObserver(() => {
        const url = location.href;
        if (url !== lastUrl) {
            lastUrl = url;
            // Espera um pouco para a página carregar o novo conteúdo
            setTimeout(initialize, 1000);
        }
    }).observe(document.body, { childList: true, subtree: true });
    
    // Roda na carga inicial da página
    window.addEventListener('load', () => {
        setTimeout(initialize, 2000); // Atraso para garantir que a UI do Beemore foi carregada
    });

})();
