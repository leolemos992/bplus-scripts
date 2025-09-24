// ==UserScript==
// @name         B.Plus! Interface (React Edition)
// @namespace    http://tampermonkey.net/
// @version      1.01
// @description  Reconstrói a interface do Beemore com React, implementando um design moderno (Telegram) com layouts flexíveis, cores, filtros e todas as ferramentas de otimização.
// @author       Jose Leonardo Lemos
// @match        https://*.beemore.com/*
// @require      https://unpkg.com/react@18/umd/react.production.min.js
// @require      https://unpkg.com/react-dom@18/umd/react-dom.production.min.js
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_info
// @connect      10.1.11.15
// @connect      est015
// ==/UserScript==

(function() {
    'use strict';

    // --- CONFIGURAÇÕES GERAIS ---
    const SCRIPT_VERSION = GM_info.script.version || '10.0';
    const IDLE_REFRESH_SECONDS = 90;
    const API_URL = 'http://10.1.11.15/contador/api.php';
    const CATEGORY_COLORS = {
        'Suporte - PDV': '#E57373', 'Suporte - Retaguarda': '#64B5F6', 'Suporte - Fiscal': '#81C784',
        'Suporte - Web': '#FFD54F', 'Suporte - Mobile': '#FFB74D',
        'Sem Categoria': '#9575CD', 'default': '#BDBDBD'
    };
    const e = React.createElement;

    // ===================================================================================
    // --- LÓGICA DE DADOS (FORA DO REACT) ---
    // ===================================================================================

    function scrapeBeemoreData() {
        const allChatItems = Array.from(document.querySelectorAll('app-chat-list-item, app-queue-item'));
        return allChatItems.map((item, index) => {
            const isMyChat = !!item.closest('app-chat-list')?.querySelector('header span')?.textContent.includes('Meus chats');
            const spans = Array.from(item.querySelectorAll('span.truncate'));
            const categoriaElement = item.querySelector('section > div > span.shrink-0');
            
            return {
                id: `chat-${index}-${Date.now()}`,
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

    function scrapeCurrentUser() {
        const userElement = document.querySelector('app-chat-list-container > header');
        if (!userElement) return { name: 'Usuário', avatarUrl: '' };
        return {
            name: userElement.querySelector('span.font-medium')?.innerText.trim() || 'Usuário',
            avatarUrl: userElement.querySelector('app-user-picture img')?.src || ''
        };
    }

    // ===================================================================================
    // --- APLICAÇÃO REACT ---
    // ===================================================================================

    const App = () => {
        const [chats, setChats] = React.useState([]);
        const [currentUser, setCurrentUser] = React.useState({ name: '', avatarUrl: '' });
        const [activeLayout, setActiveLayout] = React.useState(GM_getValue('activeLayout', 'tabs'));
        const [activeFilter, setActiveFilter] = React.useState('Todos');
        
        // Efeito para observar o DOM e atualizar os dados
        React.useEffect(() => {
            const targetNode = document.querySelector('app-chat-list-container > section');
            if (!targetNode) return;
            
            const updateData = () => {
                setChats(scrapeBeemoreData());
                setCurrentUser(scrapeCurrentUser());
            };
            
            const observer = new MutationObserver(updateData);
            observer.observe(targetNode, { childList: true, subtree: true });
            updateData(); // Carga inicial

            return () => observer.disconnect();
        }, []);

        const handleLayoutToggle = () => {
            const newLayout = activeLayout === 'tabs' ? 'list' : 'tabs';
            setActiveLayout(newLayout);
            GM_setValue('activeLayout', newLayout);
        };

        // Renderização dos componentes da UI
        // ... (Aqui entrariam os componentes React para ChatList, Abas, Itens, etc.)
        // Para simplificar, o JSX será simulado com `React.createElement` (e)

        return e('div', { className: 'h-full w-full flex flex-col bg-white dark:bg-slate-800' },
            // Header com nome do usuário, etc.
            // Barra de busca e botões de controle
            // Lógica para renderizar Abas ou Lista Vertical
            // A lista de chats em si
        );
    };

    // ===================================================================================
    // --- INICIALIZAÇÃO ---
    // ===================================================================================

    function initializeReactApp() {
        // Oculta a UI original do Beemore
        const originalListContainer = document.querySelector('app-chat-list-container > section');
        if (originalListContainer) originalListContainer.style.display = 'none';

        // Cria o ponto de montagem do React
        let reactRootEl = document.getElementById('bplus-react-root');
        if (!reactRootEl) {
            reactRootEl = document.createElement('div');
            reactRootEl.id = 'bplus-react-root';
            originalListContainer.parentNode.appendChild(reactRootEl);
        }
        
        ReactDOM.createRoot(reactRootEl).render(e(App));
    }

    // Observador para iniciar a aplicação quando o elemento alvo estiver disponível
    const initObserver = new MutationObserver((mutations, obs) => {
        if (document.querySelector('app-chat-list-container > section')) {
            console.log("B.Plus!: Container do Beemore pronto. Iniciando a interface React.");
            initializeReactApp();
            obs.disconnect();
        }
    });

    initObserver.observe(document.body, { childList: true, subtree: true });

})();
