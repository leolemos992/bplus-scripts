// ==UserScript==
// @name         Beemore Chat List Enhancer
// @namespace    http://tampermonkey.net/
// @version      1.0.04
// @description  Interface customizada para lista de chats do Beemore inspirada no Telegram
// @author       Jose Leonardo Lemos
// @match        https://*.beemore.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @require      https://unpkg.com/react@18/umd/react.production.min.js
// @require      https://unpkg.com/react-dom@18/umd/react-dom.production.min.js
// @require      https://cdn.tailwindcss.com
// ==/UserScript==

(function() {
    'use strict';

    // Configuração do Tailwind CSS
    GM_addStyle(`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        
        * {
            font-family: 'Inter', sans-serif;
        }
        
        .beemore-original-chat-list {
            display: none !important;
        }
        
        /* Estilos customizados para a nova interface */
        .beemore-custom-scrollbar::-webkit-scrollbar {
            width: 6px;
        }
        
        .beemore-custom-scrollbar::-webkit-scrollbar-track {
            background: #f1f1f1;
            border-radius: 3px;
        }
        
        .beemore-custom-scrollbar::-webkit-scrollbar-thumb {
            background: #c1c1c1;
            border-radius: 3px;
        }
        
        .beemore-custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background: #a8a8a8;
        }
        
        .category-pdv { background-color: #e0f2fe; border-color: #0284c7; }
        .category-fiscal { background-color: #f3e8ff; border-color: #7c3aed; }
        .category-suporte { background-color: #dcfce7; border-color: #16a34a; }
        .category-vendas { background-color: #fef3c7; border-color: #d97706; }
        .category-outros { background-color: #f5f5f5; border-color: #6b7280; }
        
        .tab-pdv { background-color: #0284c7; }
        .tab-fiscal { background-color: #7c3aed; }
        .tab-suporte { background-color: #16a34a; }
        .tab-vendas { background-color: #d97706; }
        .tab-outros { background-color: #6b7280; }
    `);

    // Cores das categorias
    const CATEGORY_COLORS = {
        'PDV': { bg: 'category-pdv', tab: 'tab-pdv', text: 'text-blue-700' },
        'Fiscal': { bg: 'category-fiscal', tab: 'tab-fiscal', text: 'text-purple-700' },
        'Suporte': { bg: 'category-suporte', tab: 'tab-suporte', text: 'text-green-700' },
        'Vendas': { bg: 'category-vendas', tab: 'tab-vendas', text: 'text-amber-700' },
        'Outros': { bg: 'category-outros', tab: 'tab-outros', text: 'text-gray-700' }
    };

    class ChatDataManager {
        constructor() {
            this.chats = [];
            this.observers = [];
            this.observer = null;
            this.init();
        }

        init() {
            this.startObserving();
        }

        startObserving() {
            // Observar mudanças no DOM para detectar novos chats
            this.observer = new MutationObserver((mutations) => {
                let shouldUpdate = false;
                
                mutations.forEach((mutation) => {
                    if (mutation.type === 'childList') {
                        mutation.addedNodes.forEach((node) => {
                            if (node.nodeType === 1 && (
                                node.matches?.('app-chat-list-item') || 
                                node.matches?.('app-queue-item') ||
                                node.querySelector?.('app-chat-list-item') ||
                                node.querySelector?.('app-queue-item')
                            )) {
                                shouldUpdate = true;
                            }
                        });
                    }
                });

                if (shouldUpdate) {
                    this.updateChats();
                }
            });

            // Iniciar observação
            const chatContainer = document.querySelector('app-chat-list-container section');
            if (chatContainer) {
                this.observer.observe(chatContainer, {
                    childList: true,
                    subtree: true
                });
                this.updateChats();
            } else {
                // Tentar novamente após 1 segundo se o container não estiver disponível
                setTimeout(() => this.startObserving(), 1000);
            }
        }

        extractChatData(element) {
            try {
                // Extrair nome do solicitante
                const nameElement = element.querySelector('[class*="name"], [class*="contact"]');
                const name = nameElement?.textContent?.trim() || 'Nome não disponível';

                // Extrair revenda
                const revendaElement = element.querySelector('[class*="company"], [class*="revenda"]');
                const revenda = revendaElement?.textContent?.trim() || 'Revenda não informada';

                // Extrair categoria/serviço
                const categoryElement = element.querySelector('[class*="category"], [class*="service"]');
                let category = categoryElement?.textContent?.trim() || 'Outros';
                
                // Normalizar categoria
                if (category.includes('PDV')) category = 'PDV';
                else if (category.includes('Fiscal')) category = 'Fiscal';
                else if (category.includes('Suporte')) category = 'Suporte';
                else if (category.includes('Vendas')) category = 'Vendas';
                else category = 'Outros';

                // Verificar notificação (ícone de alerta)
                const hasNotification = !!element.querySelector('[class*="notification"], [class*="alert"], .bg-red-500, .text-red-500');

                // Verificar se está selecionado
                const isSelected = element.hasAttribute('active') || 
                                 element.classList.contains('active') ||
                                 element.getAttribute('class')?.includes('selected');

                // Extrair avatar
                const avatarElement = element.querySelector('img, [class*="avatar"]');
                const avatarUrl = avatarElement?.src || avatarElement?.getAttribute('src') || '';

                // Determinar propriedade (Meus chats ou Outros)
                const isMyChat = element.closest('[class*="my-chats"], [class*="meus-chats"]') !== null;
                const property = isMyChat ? 'Meus chats' : 'Outros';

                return {
                    id: element.getAttribute('data-chat-id') || Math.random().toString(36),
                    name,
                    revenda,
                    category,
                    hasNotification,
                    isSelected,
                    avatarUrl,
                    property,
                    originalElement: element
                };
            } catch (error) {
                console.error('Erro ao extrair dados do chat:', error);
                return null;
            }
        }

        updateChats() {
            const chatElements = document.querySelectorAll('app-chat-list-item, app-queue-item');
            const newChats = [];

            chatElements.forEach((element, index) => {
                const chatData = this.extractChatData(element);
                if (chatData) {
                    newChats.push(chatData);
                }
            });

            this.chats = newChats;
            this.notifyObservers();
        }

        subscribe(observer) {
            this.observers.push(observer);
        }

        unsubscribe(observer) {
            this.observers = this.observers.filter(obs => obs !== observer);
        }

        notifyObservers() {
            this.observers.forEach(observer => observer(this.chats));
        }

        getChatsByCategory(category) {
            if (category === 'Todos') return this.chats;
            return this.chats.filter(chat => chat.category === category);
        }

        getCategoryCounts() {
            const counts = { 'Todos': this.chats.length };
            this.chats.forEach(chat => {
                counts[chat.category] = (counts[chat.category] || 0) + 1;
            });
            return counts;
        }
    }

    // Componentes React
    const { useState, useEffect, useCallback } = React;

    function ChatItem({ chat, onClick }) {
        const categoryStyle = CATEGORY_COLORS[chat.category] || CATEGORY_COLORS.Outros;

        return (
            <div 
                className={`p-3 border-l-4 rounded-r-lg cursor-pointer transition-all duration-200 hover:shadow-md ${
                    chat.isSelected ? 'bg-blue-50 border-blue-500' : 'bg-white'
                } ${categoryStyle.bg} border-l-4`}
                onClick={() => onClick(chat)}
            >
                <div className="flex items-center space-x-3">
                    {/* Avatar */}
                    <div className="flex-shrink-0">
                        {chat.avatarUrl ? (
                            <img 
                                src={chat.avatarUrl} 
                                alt={chat.name}
                                className="w-10 h-10 rounded-full object-cover"
                            />
                        ) : (
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${categoryStyle.bg} ${categoryStyle.text} font-semibold`}>
                                {chat.name.charAt(0).toUpperCase()}
                            </div>
                        )}
                    </div>

                    {/* Informações do chat */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold text-gray-900 truncate">
                                {chat.name}
                            </p>
                            {chat.hasNotification && (
                                <div className="w-2 h-2 bg-orange-500 rounded-full flex-shrink-0"></div>
                            )}
                        </div>
                        <p className="text-xs text-gray-500 truncate">{chat.revenda}</p>
                    </div>
                </div>
            </div>
        );
    }

    function CategoryHeader({ category, count, isExpanded, onToggle, colorStyle }) {
        return (
            <div 
                className={`p-3 border-l-4 rounded-r-lg cursor-pointer ${colorStyle.bg} border-l-4`}
                onClick={onToggle}
            >
                <div className="flex items-center justify-between">
                    <span className={`text-sm font-semibold ${colorStyle.text}`}>
                        {category}
                    </span>
                    <div className="flex items-center space-x-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${colorStyle.bg} ${colorStyle.text}`}>
                            {count}
                        </span>
                        <svg 
                            className={`w-4 h-4 transition-transform duration-200 ${colorStyle.text} ${
                                isExpanded ? 'rotate-180' : ''
                            }`}
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </div>
                </div>
            </div>
        );
    }

    function TabLayout({ chats, activeTab, onTabChange, onChatClick }) {
        const categoryCounts = chats.reduce((acc, chat) => {
            acc[chat.category] = (acc[chat.category] || 0) + 1;
            return acc;
        }, { 'Todos': chats.length });

        const categories = ['Todos', ...Object.keys(CATEGORY_COLORS).filter(cat => categoryCounts[cat] > 0)];

        const filteredChats = activeTab === 'Todos' ? chats : chats.filter(chat => chat.category === activeTab);

        return (
            <div className="h-full flex flex-col">
                {/* Barra de abas */}
                <div className="flex space-x-1 p-2 bg-gray-100 overflow-x-auto beemore-custom-scrollbar">
                    {categories.map(category => {
                        const colorStyle = CATEGORY_COLORS[category] || CATEGORY_COLORS.Outros;
                        const isActive = activeTab === category;
                        
                        return (
                            <button
                                key={category}
                                className={`flex items-center space-x-1 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-200 ${
                                    isActive 
                                        ? `${colorStyle.tab} text-white shadow-sm` 
                                        : 'bg-white text-gray-700 hover:bg-gray-50'
                                }`}
                                onClick={() => onTabChange(category)}
                            >
                                <span>{category === 'Todos' ? 'Todos' : category}</span>
                                <span className={`px-1 rounded text-xs ${
                                    isActive ? 'bg-white bg-opacity-20' : 'bg-gray-100'
                                }`}>
                                    {categoryCounts[category] || 0}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* Lista de chats */}
                <div className="flex-1 overflow-y-auto beemore-custom-scrollbar">
                    {activeTab === 'Todos' ? (
                        // Agrupar por categoria na aba "Todos"
                        Object.keys(CATEGORY_COLORS).map(category => {
                            const categoryChats = chats.filter(chat => chat.category === category);
                            if (categoryChats.length === 0) return null;
                            
                            const colorStyle = CATEGORY_COLORS[category];
                            return (
                                <div key={category}>
                                    <div className={`p-2 text-xs font-semibold ${colorStyle.text} bg-gray-50`}>
                                        {category} ({categoryChats.length})
                                    </div>
                                    {categoryChats.map(chat => (
                                        <ChatItem key={chat.id} chat={chat} onClick={onChatClick} />
                                    ))}
                                </div>
                            );
                        })
                    ) : (
                        // Lista simples para outras abas
                        filteredChats.map(chat => (
                            <ChatItem key={chat.id} chat={chat} onClick={onChatClick} />
                        ))
                    )}
                </div>
            </div>
        );
    }

    function ListLayout({ chats, onChatClick }) {
        const [expandedCategories, setExpandedCategories] = useState(
            GM_getValue('expandedCategories', {})
        );

        const toggleCategory = useCallback((category) => {
            setExpandedCategories(prev => {
                const newState = {
                    ...prev,
                    [category]: !prev[category]
                };
                GM_setValue('expandedCategories', newState);
                return newState;
            });
        }, []);

        const chatsByCategory = chats.reduce((acc, chat) => {
            if (!acc[chat.category]) {
                acc[chat.category] = [];
            }
            acc[chat.category].push(chat);
            return acc;
        }, {});

        return (
            <div className="h-full overflow-y-auto beemore-custom-scrollbar">
                {Object.entries(chatsByCategory).map(([category, categoryChats]) => {
                    const colorStyle = CATEGORY_COLORS[category] || CATEGORY_COLORS.Outros;
                    const isExpanded = expandedCategories[category] !== false;

                    return (
                        <div key={category}>
                            <CategoryHeader
                                category={category}
                                count={categoryChats.length}
                                isExpanded={isExpanded}
                                onToggle={() => toggleCategory(category)}
                                colorStyle={colorStyle}
                            />
                            {isExpanded && categoryChats.map(chat => (
                                <ChatItem key={chat.id} chat={chat} onClick={onChatClick} />
                            ))}
                        </div>
                    );
                })}
            </div>
        );
    }

    function VersionIndicator() {
        const [isVisible, setIsVisible] = useState(false);

        return (
            <div className="fixed left-4 bottom-4 z-50">
                <div 
                    className="relative"
                    onMouseEnter={() => setIsVisible(true)}
                    onMouseLeave={() => setIsVisible(false)}
                >
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg cursor-pointer">
                        <span className="text-white font-bold text-sm">B+</span>
                    </div>
                    
                    {isVisible && (
                        <div className="absolute left-full ml-2 bottom-0 bg-white rounded-lg shadow-xl p-3 min-w-48">
                            <div className="text-sm font-semibold text-gray-900">
                                Beemore Enhancer v1.0.0
                            </div>
                            <div className="text-xs text-green-600 font-medium mt-1">
                                ✅ Operacional
                            </div>
                            <div className="text-xs text-gray-500 mt-2">
                                Interface customizada para atendimento
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    function ChatInterface() {
        const [chats, setChats] = useState([]);
        const [layout, setLayout] = useState(GM_getValue('preferredLayout', 'tabs'));
        const [activeTab, setActiveTab] = useState('Todos');

        useEffect(() => {
            const chatManager = new ChatDataManager();
            
            const handleChatsUpdate = (updatedChats) => {
                setChats(updatedChats);
            };

            chatManager.subscribe(handleChatsUpdate);
            
            return () => chatManager.unsubscribe(handleChatsUpdate);
        }, []);

        const handleChatClick = useCallback((chat) => {
            if (chat.originalElement) {
                chat.originalElement.click();
            }
        }, []);

        const toggleLayout = useCallback(() => {
            const newLayout = layout === 'tabs' ? 'list' : 'tabs';
            setLayout(newLayout);
            GM_setValue('preferredLayout', newLayout);
            setActiveTab('Todos');
        }, [layout]);

        return (
            <div className="h-full flex flex-col bg-white">
                {/* Cabeçalho de controle */}
                <div className="flex items-center justify-between p-3 border-b bg-gray-50">
                    <h3 className="text-lg font-semibold text-gray-900">Chats</h3>
                    <button
                        onClick={toggleLayout}
                        className="flex items-center space-x-2 px-3 py-2 bg-white border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            {layout === 'tabs' ? (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            ) : (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18M3 18h18M3 6h18" />
                            )}
                        </svg>
                        <span>{layout === 'tabs' ? 'Layout Lista' : 'Layout Abas'}</span>
                    </button>
                </div>

                {/* Interface principal */}
                <div className="flex-1">
                    {layout === 'tabs' ? (
                        <TabLayout
                            chats={chats}
                            activeTab={activeTab}
                            onTabChange={setActiveTab}
                            onChatClick={handleChatClick}
                        />
                    ) : (
                        <ListLayout
                            chats={chats}
                            onChatClick={handleChatClick}
                        />
                    )}
                </div>

                <VersionIndicator />
            </div>
        );
    }

    // Sistema de auto-refresh
    class AutoRefreshManager {
        constructor() {
            this.inactivityTimeout = 90; // segundos
            this.timer = null;
            this.lastActivity = Date.now();
            this.isUserActive = true;
            this.init();
        }

        init() {
            this.resetTimer();
            this.setupActivityListeners();
        }

        setupActivityListeners() {
            const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
            
            events.forEach(event => {
                document.addEventListener(event, () => {
                    this.lastActivity = Date.now();
                    this.isUserActive = true;
                    this.resetTimer();
                }, { passive: true });
            });
        }

        resetTimer() {
            if (this.timer) clearTimeout(this.timer);
            
            this.timer = setTimeout(() => {
                this.isUserActive = false;
                this.checkAndRefresh();
            }, this.inactivityTimeout * 1000);
        }

        checkAndRefresh() {
            // Verificar se o usuário não está em um chat ativo
            const activeChat = document.querySelector('app-chat-list-item[active], app-chat-list-item.active');
            
            if (!activeChat && !this.isUserActive) {
                this.refreshChatList();
            }
            
            this.resetTimer();
        }

        refreshChatList() {
            console.log('Auto-refresh: Atualizando lista de chats...');
            
            // Simular clique para ir ao Dashboard e voltar
            const dashboardBtn = document.querySelector('[href*="dashboard"], [class*="dashboard"]');
            const chatBtn = document.querySelector('[href*="chat"], [class*="chat"]');
            
            if (dashboardBtn && chatBtn) {
                setTimeout(() => {
                    dashboardBtn.click();
                    setTimeout(() => chatBtn.click(), 1000);
                }, 500);
            }
        }
    }

    // Inicialização do script
    function init() {
        // Ocultar lista original
        const originalChatList = document.querySelector('app-chat-list-container section');
        if (originalChatList) {
            originalChatList.classList.add('beemore-original-chat-list');
        }

        // Criar container para a nova interface
        const appContainer = document.createElement('div');
        appContainer.id = 'beemore-custom-chat-list';
        appContainer.className = 'h-full w-full';
        
        // Inserir após a lista original
        if (originalChatList && originalChatList.parentNode) {
            originalChatList.parentNode.insertBefore(appContainer, originalChatList.nextSibling);
        } else {
            document.body.appendChild(appContainer);
        }

        // Renderizar aplicação React
        const root = ReactDOM.createRoot(appContainer);
        root.render(React.createElement(ChatInterface));

        // Iniciar auto-refresh
        new AutoRefreshManager();

        console.log('Beemore Chat List Enhancer inicializado com sucesso!');
    }

    // Aguardar o DOM carregar
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
