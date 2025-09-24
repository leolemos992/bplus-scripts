
// ==UserScript==
// @name         Beemore Chat Redesign & Tools
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Redesigns the Beemore chat UI and adds a tool for reporting incorrect service assignments.
// @author       JOSE LEONARDO LEMOS
// @match        https://*.beemore.com/*
// @require      https://unpkg.com/react@18/umd/react.production.min.js
// @require      https://unpkg.com/react-dom@18/umd/react-dom.production.min.js
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function() {
    'use strict';

    // --- CONFIGURATIONS ---
    const API_URL = 'http://10.1.11.15/contador/api.php';

    // --- STYLE INJECTION ---
    function injectStyles() {
        GM_addStyle(`
            #tampermonkey-root {
                height: 100vh;
                width: 100vw;
                position: fixed;
                top: 0;
                left: 0;
                z-index: 9999;
            }
        `);
        // Inject Tailwind CSS
        const tailwindScript = document.createElement('script');
        tailwindScript.src = 'https://cdn.tailwindcss.com';
        document.head.appendChild(tailwindScript);
        
        const tailwindConfigScript = document.createElement('script');
        tailwindConfigScript.innerHTML = `
          tailwind.config = {
            theme: {
              extend: {
                colors: {
                  'primary': '#4a148c',
                  'primary-dark': '#38006b',
                  'primary-light': '#7c43bd',
                  'secondary': '#f3e5f5',
                  'secondary-dark': '#c0b3c2',
                  'accent': '#7e57c2',
                  'background': '#f5f5f5',
                  'surface': '#ffffff',
                  'text-primary': '#212121',
                  'text-secondary': '#757575',
                  'agent-bubble': '#e1f5fe',
                  'client-bubble': '#f1f1f1',
                }
              }
            }
          }
        `;
        document.head.appendChild(tailwindConfigScript);
    }


    // ===================================================================================
    // --- DATA SCRAPING & API LOGIC (from user's script) ---
    // ===================================================================================
    
    /**
     * Finds a statistic card by its title and extracts the numeric value.
     * @param {string} title - The title of the card to search for (case-insensitive).
     * @returns {number|null} The numeric value found or null.
     */
    function findStatByTitle(title) {
        const allCards = document.querySelectorAll('app-report-card-chart-indicator');
        for (const card of allCards) {
            const titleElement = card.querySelector('h3.text-sm');
            if (titleElement && titleElement.innerText.trim().toLowerCase() === title.toLowerCase()) {
                const valueElement = card.querySelector('.text-4xl');
                if (valueElement) {
                    const match = valueElement.innerText.match(/\d+/);
                    return match ? parseInt(match[0], 10) : null;
                }
            }
        }
        return null;
    }

    /**
     * Scrapes Beemore dashboard data and sends it to the API.
     */
    function scrapeAndSendData() {
        if (!window.location.href.includes('/dashboard')) return;
        
        console.log("CRX: Checking dashboard data...");
        const totalChatsHoje = findStatByTitle('Número de chats recebidos hoje');

        if (totalChatsHoje !== null) {
            console.log(`CRX: Total chats today: ${totalChatsHoje}`);
            const data = {
                action: 'updateStats', // Custom action for dashboard stats
                totalChats: totalChatsHoje
            };

            GM_xmlhttpRequest({
                method: "POST",
                url: API_URL,
                data: JSON.stringify(data),
                headers: { "Content-Type": "application/json" },
                onload: function(response) {
                    console.log("CRX: Dashboard stats sent successfully.", response.responseText);
                },
                onerror: function(response) {
                    console.error("CRX: Failed to send dashboard stats.", response);
                }
            });
        } else {
            console.log("CRX: 'Número de chats recebidos hoje' card not found.");
        }
    }


    /**
     * Captures data from the active chat on the original Beemore page.
     * @returns {object} An object with captured chat data.
     */
    function captureDataFromPage() {
        console.log("CRX: Capturing page data...");

        const headerElement = document.querySelector('app-chat-list-container > header');
        let analista = headerElement ? headerElement.querySelector('span.font-medium')?.innerText.trim() : '';

        const chatHeaderElement = document.querySelector('app-chat-agent-header');
        let numero = chatHeaderElement ? chatHeaderElement.querySelector('span.font-medium')?.innerText.replace('#', '').trim() : '';
        let revenda = chatHeaderElement ? chatHeaderElement.querySelector('span.text-neutral-500')?.innerText.trim() : '';

        let servicoSelecionado = '';
        let solicitante = '';
        const activeChatElement = document.querySelector('app-chat-list-item.active');

        if (activeChatElement) {
            const solicitanteElement = activeChatElement.querySelector('span.truncate.font-medium');
            solicitante = solicitanteElement ? solicitanteElement.innerText.trim() : '';

            if (!revenda) {
                const revendaElementLista = activeChatElement.querySelector('span.inline-flex > span.truncate');
                revenda = revendaElementLista ? revendaElementLista.innerText.trim() : '';
            }
            
            const servicoElement = activeChatElement.querySelector('span.shrink-0');
            servicoSelecionado = servicoElement ? servicoElement.innerText.trim() : '';
        }

        const capturedData = { analista, numero, revenda, solicitante, servicoSelecionado };
        console.log("CRX: Data Captured:", capturedData);
        return capturedData;
    }

    /**
     * Submits the incorrect service form data to the API.
     * @param {object} atendimentoData - The data to submit.
     * @param {function} callback - Function to call with the response.
     */
    function handleFormSubmit(atendimentoData, callback) {
        console.log("CRX: Submitting incorrect service report:", atendimentoData);

        GM_xmlhttpRequest({
            method: "POST",
            url: API_URL,
            data: JSON.stringify(atendimentoData),
            headers: { "Content-Type": "application/json" },
            onload: function(response) {
                try {
                    const jsonResponse = JSON.parse(response.responseText);
                    console.log("CRX: API Success Response:", jsonResponse);
                    callback({ success: true, data: jsonResponse });
                } catch (e) {
                    console.error("CRX: API response was not valid JSON.", response.responseText);
                    callback({ success: false, error: "Invalid server response." });
                }
            },
            onerror: function(response) {
                console.error("CRX: API Error Response:", response);
                callback({ success: false, error: "Failed to connect to the server." });
            }
        });
    }

    // ===================================================================================
    // --- REACT APPLICATION COMPONENTS (Transpiled to JS) ---
    // ===================================================================================
    const e = React.createElement;

    const Icons = {
        SearchIcon: ({ className = 'w-6 h-6' }) => e('svg', { xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24", strokeWidth: 1.5, stroke: "currentColor", className }, e('path', { strokeLinecap: "round", strokeLinejoin: "round", d: "M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" })),
        MenuIcon: ({ className = 'w-6 h-6' }) => e('svg', { xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24", strokeWidth: 1.5, stroke: "currentColor", className }, e('path', { strokeLinecap: "round", strokeLinejoin: "round", d: "M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" })),
        ChevronDownIcon: ({ className = 'w-5 h-5' }) => e('svg', { xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 20 20", fill: "currentColor", className }, e('path', { fillRule: "evenodd", d: "M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z", clipRule: "evenodd" })),
        PhoneIcon: ({ className = 'w-6 h-6' }) => e('svg', { xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24", strokeWidth: 1.5, stroke: "currentColor", className }, e('path', { strokeLinecap: "round", strokeLinejoin: "round", d: "M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" })),
        DesktopComputerIcon: ({ className = 'w-6 h-6' }) => e('svg', { xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24", strokeWidth: 1.5, stroke: "currentColor", className }, e('path', { strokeLinecap: "round", strokeLinejoin: "round", d: "M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-1.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25A2.25 2.25 0 015.25 3h13.5A2.25 2.25 0 0121 5.25z" })),
        ServerIcon: ({ className = 'w-6 h-6' }) => e('svg', { xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24", strokeWidth: 1.5, stroke: "currentColor", className }, e('path', { strokeLinecap: "round", strokeLinejoin: "round", d: "M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3V7.5a3 3 0 013-3h13.5a3 3 0 013 3v3.75a3 3 0 01-3 3m-13.5 0v1.5a3 3 0 003 3h7.5a3 3 0 003-3v-1.5m-13.5 0h13.5" })),
        SendIcon: ({ className = 'w-6 h-6' }) => e('svg', { xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 24 24", fill: "currentColor", className }, e('path', { d: "M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" })),
        ListBulletIcon: ({ className = 'w-6 h-6' }) => e('svg', { xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24", strokeWidth: 1.5, stroke: "currentColor", className }, e('path', { strokeLinecap: "round", strokeLinejoin: "round", d: "M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.007H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.007H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.007H3.75v-.007zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" })),
        Square3Stack3DIcon: ({ className = 'w-6 h-6' }) => e('svg', { xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24", strokeWidth: 1.5, stroke: "currentColor", className }, e('path', { strokeLinecap: "round", strokeLinejoin: "round", d: "M6 6.878V6a2.25 2.25 0 012.25-2.25h7.5A2.25 2.25 0 0118 6v.878m-12 0c.235-.083.487-.128.75-.128h10.5c.263 0 .515.045.75.128m-12 0A2.25 2.25 0 004.5 9v.878m13.5-3A2.25 2.25 0 0119.5 9v.878m0 0a2.246 2.246 0 00-.75-.128H5.25c-.263 0-.515.045-.75.128m15 0A2.25 2.25 0 0121 12v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6c0-.98.626-1.813 1.5-2.122" })),
        ViewColumnsIcon: ({ className = 'w-6 h-6' }) => e('svg', { xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24", strokeWidth: 1.5, stroke: "currentColor", className }, e('path', { strokeLinecap: "round", strokeLinejoin: "round", d: "M9 4.5v15m6-15v15m-10.875 0h15.75c.621 0 1.125-.504 1.125-1.125V5.625c0-.621-.504-1.125-1.125-1.125H4.125A1.125 1.125 0 003 5.625v12.75c0 .621.504 1.125 1.125 1.125z" })),
        FlagIcon: ({ className = 'w-6 h-6' }) => e('svg', { xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24", strokeWidth: 1.5, stroke: "currentColor", className }, e('path', { strokeLinecap: "round", strokeLinejoin: "round", d: "M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5" })),
    };

    const CONSTANTS = {
        CURRENT_USER: { name: 'Leonardo Lemos', avatarUrl: 'https://i.pravatar.cc/150?u=leonardo', status: 'Online' },
        CATEGORIES: [
            { id: 'mobile', name: 'Suporte - Mobile', color: 'bg-blue-500', icon: e(Icons.PhoneIcon, { className: "w-5 h-5 text-blue-200" }) },
            { id: 'pdv', name: 'Suporte - PDV', color: 'bg-red-500', icon: e(Icons.DesktopComputerIcon, { className: "w-5 h-5 text-red-200" }) },
            { id: 'retaguarda', name: 'Suporte - Retaguarda', color: 'bg-teal-500', icon: e(Icons.ServerIcon, { className: "w-5 h-5 text-teal-200" }) },
            { id: 'fiscal', name: 'Suporte - Fiscal', color: 'bg-purple-500', icon: e(Icons.ServerIcon, { className: "w-5 h-5 text-purple-200" }) },
            { id: 'web', name: 'Suporte - Web', color: 'bg-indigo-500', icon: e(Icons.ServerIcon, { className: "w-5 h-5 text-indigo-200" }) },
        ],
        CHATS: [
            { id: 'chat1', contact: { name: 'Lucas R.', company: 'O DATA SOLUÇÕES E TECNOLOGIA EM...', avatarUrl: 'https://i.pravatar.cc/150?u=lucas' }, categoryId: 'mobile', status: 'Suporte - Mobile', unreadCount: 0, isWaiting: false, ticketId: '382921', messages: [{ id: 'm1', sender: 'client', content: 'Bom dia, estou com um problema no app.', timestamp: '10:30', type: 'text' }, { id: 'm2', sender: 'agent', content: 'Olá Lucas, bom dia! Pode me descrever o problema?', timestamp: '10:31', type: 'text' }] },
            { id: 'chat2', contact: { name: 'Vinicius C.', company: 'Automação Blumeneau-PDV', avatarUrl: 'https://i.pravatar.cc/150?u=vinicius' }, categoryId: 'pdv', status: 'Suporte - PDV', unreadCount: 0, isWaiting: false, ticketId: '385571', messages: [ { id: 'm1', sender: 'client', content: 'Saulo boa tarde', timestamp: '14:22', type: 'text'}, { id: 'm2', sender: 'client', type: 'image', content: 'https://picsum.photos/400/200', timestamp: '14:23'}, { id: 'm3', sender: 'client', content: 'queria ver se tem uma preferência que não recalcule os impostos da nota quando for preencher esse dois campos manualmente', timestamp: '14:24', type: 'text'}, { id: 'm4', sender: 'system', content: 'Deividy R. entrou na conversa', timestamp: '14:25', type: 'text'}, { id: 'm5', sender: 'system', content: 'Saulo D. saiu da conversa', timestamp: '14:26', type: 'text'}, { id: 'm6', sender: 'agent', content: 'Boa tarde Carlos', timestamp: '14:27', type: 'text'}, { id: 'm7', sender: 'client', content: 'a nota tem 50 itens, tem alíquota de IPI diferentes. o frete é por fora, e as outras despesas será o seguro das mercadorias, que Deividy, pode me ajudar com isso?', timestamp: '14:37', type: 'text'}, { id: 'm8', sender: 'agent', content: 'O que você quer é que ao informar o frete que é por fora, não modifique o IPI dos itens, certo?', timestamp: '14:39', type: 'text'}] },
            { id: 'chat3', contact: { name: 'José V.', company: 'RC AUTOMAÇÃO COMERCIAL', avatarUrl: 'https://i.pravatar.cc/150?u=jose' }, categoryId: 'pdv', status: 'Suporte - PDV', unreadCount: 0, isWaiting: false, ticketId: '381923', messages: [{ id: 'm1', sender: 'client', content: 'Problema na impressora fiscal.', timestamp: '11:00', type: 'text' }] },
            { id: 'chat4', contact: { name: 'Anderson S.', company: 'Shopping Sistemas', avatarUrl: 'https://i.pravatar.cc/150?u=anderson' }, categoryId: 'retaguarda', status: 'Suporte - Retaguarda', unreadCount: 1, isWaiting: true, ticketId: '382941', messages: [{ id: 'm1', sender: 'client', content: 'Não consigo gerar o relatório de vendas.', timestamp: '15:00', type: 'text' }, { id: 'm2', sender: 'agent', content: 'Olá Anderson, vou verificar para você.', timestamp: '15:01', type: 'text' }, { id: 'm3', sender: 'client', content: 'Ok, aguardo.', timestamp: '15:02', type: 'text' }] },
            { id: 'chat5', contact: { name: 'Janaina G.', company: 'Gênesis Automação Comercial', avatarUrl: 'https://i.pravatar.cc/150?u=janaina' }, categoryId: 'retaguarda', status: 'Suporte - Retaguarda', unreadCount: 1, isWaiting: true, ticketId: '383321', messages: [{ id: 'm1', sender: 'client', content: 'Preciso de ajuda com a configuração do sistema.', timestamp: '09:15', type: 'text' }] },
        ],
        CONTACT_DETAILS_MOCK: { 'chat2': { company: 'Boldsoft Sistemas', id: '98.976.010/0001-96', agent: 'Deividy Rautenberg Oliveira', domain: 'Suporte', service: 'Suporte - Retaguarda', origin: 'Webhook privado', type: 'Unplusweb' } }
    };
    
    // --- React Components ---

    const MessageBubble = ({ message }) => {
        if (message.sender === 'system') {
            return e('div', { className: "text-center my-2" },
                e('span', { className: "text-xs text-text-secondary bg-gray-200 rounded-full px-3 py-1" }, message.content)
            );
        }
        const isAgent = message.sender === 'agent';
        const bubbleClasses = isAgent ? 'bg-agent-bubble self-end text-right' : 'bg-client-bubble self-start text-left';
        const containerClasses = isAgent ? 'justify-end' : 'justify-start';
        return e('div', { className: `flex ${containerClasses} mb-3` },
            e('div', { className: `rounded-lg px-4 py-2 max-w-lg ${bubbleClasses}` },
                message.type === 'image'
                    ? e('img', { src: message.content, alt: "Chat content", className: "rounded-md max-w-xs my-2" })
                    : e('p', { className: "text-sm text-text-primary" }, message.content),
                e('p', { className: "text-xs text-text-secondary mt-1" }, message.timestamp)
            )
        );
    };
    
    const IncorrectServiceModal = ({ isOpen, onClose, chatData, currentUser }) => {
        if (!isOpen) return null;

        const [formData, setFormData] = React.useState({
            servicoSelecionado: chatData?.servicoSelecionado || '',
            servicoCorreto: '',
        });
        const [status, setStatus] = React.useState({ message: '', type: '' });

        const onFormSubmit = (e) => {
            e.preventDefault();
            setStatus({ message: 'Salvando...', type: 'loading' });

            const submissionData = {
                action: 'create',
                numero: chatData.numero,
                revenda: chatData.revenda,
                solicitante: chatData.solicitante,
                servicoSelecionado: formData.servicoSelecionado,
                servicoCorreto: formData.servicoCorreto,
                data: new Date().toISOString().split('T')[0],
                analista: currentUser.name
            };

            handleFormSubmit(submissionData, (response) => {
                if (response.success) {
                    setStatus({ message: response.data?.success || 'Salvo com sucesso!', type: 'success' });
                    setTimeout(() => {
                        onClose();
                        setStatus({ message: '', type: '' });
                    }, 1500);
                } else {
                    setStatus({ message: 'Falha ao salvar: ' + (response.error || 'Erro desconhecido'), type: 'error' });
                }
            });
        };
        
        const handleChange = (e) => {
            const { id, value } = e.target;
            setFormData(prev => ({ ...prev, [id]: value }));
        };

        const renderStatus = () => {
            if (!status.message) return null;
            const color = status.type === 'success' ? 'text-green-600' : status.type === 'error' ? 'text-red-600' : 'text-gray-600';
            return e('div', { className: `mt-4 text-center ${color}` }, status.message);
        };
        
        return e('div', { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50", onClick: onClose },
            e('div', { className: "bg-white rounded-lg shadow-xl p-6 w-full max-w-md", onClick: e => e.stopPropagation() },
                e('h3', { className: "text-lg font-bold mb-4" }, "Registrar Atendimento Incorreto"),
                e('form', { onSubmit: onFormSubmit },
                    e('div', { className: "mb-4" },
                        e('label', { htmlFor: "numero", className: "block text-sm font-medium text-gray-700" }, "Número do Atendimento"),
                        e('input', { type: "text", id: "numero", value: chatData.numero, readOnly: true, className: "mt-1 block w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-md shadow-sm" })
                    ),
                    e('div', { className: "mb-4" },
                        e('label', { htmlFor: "revenda", className: "block text-sm font-medium text-gray-700" }, "Revenda"),
                        e('input', { type: "text", id: "revenda", value: chatData.revenda, readOnly: true, className: "mt-1 block w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-md shadow-sm" })
                    ),
                    e('div', { className: "mb-4" },
                        e('label', { htmlFor: "solicitante", className: "block text-sm font-medium text-gray-700" }, "Solicitante"),
                        e('input', { type: "text", id: "solicitante", value: chatData.solicitante, readOnly: true, className: "mt-1 block w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-md shadow-sm" })
                    ),
                     e('div', { className: "mb-4" },
                        e('label', { htmlFor: "servicoSelecionado", className: "block text-sm font-medium text-gray-700" }, "Serviço Selecionado"),
                        e('select', { id: "servicoSelecionado", value: formData.servicoSelecionado, onChange: handleChange, required: true, className: "mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" },
                            e('option', { value: "" }, "Selecione..."),
                            ...CONSTANTS.CATEGORIES.map(cat => e('option', { key: cat.id, value: cat.name }, cat.name))
                        )
                    ),
                    e('div', { className: "mb-4" },
                        e('label', { htmlFor: "servicoCorreto", className: "block text-sm font-medium text-gray-700" }, "Serviço Correto"),
                        e('select', { id: "servicoCorreto", value: formData.servicoCorreto, onChange: handleChange, required: true, className: "mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" },
                             e('option', { value: "" }, "Selecione..."),
                            ...CONSTANTS.CATEGORIES.map(cat => e('option', { key: cat.id, value: cat.name }, cat.name))
                        )
                    ),
                    renderStatus(),
                    e('div', { className: "flex justify-end space-x-2 mt-6" },
                        e('button', { type: "button", onClick: onClose, className: "px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300" }, "Cancelar"),
                        e('button', { type: "submit", className: "px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark" }, "Salvar")
                    )
                )
            )
        );
    };

    const ChatWindow = ({ chat, onOpenIncorrectServiceModal }) => {
        const [newMessage, setNewMessage] = React.useState('');
        if (!chat) {
            return e('main', { className: "flex-1 p-6 bg-background" }, e('div', { className: "flex flex-col items-center justify-center h-full text-center text-text-secondary" },
                e('svg', { className: "w-48 h-48 text-primary-light opacity-50 mb-4", viewBox: "0 0 512 512", xmlns: "http://www.w3.org/2000/svg" }, e('path', { fill: "currentColor", d: "M464 32H48C21.5 32 0 53.5 0 80v240c0 26.5 21.5 48 48 48h21.1c-4.4 13.3-6.6 27.5-6.6 42.5C62.5 457.2 102.8 512 160 512c33.9 0 63.8-14.7 84.8-38.1C260.1 498.3 285.5 512 312.5 512c57.2 0 97.5-54.8 97.5-99.5 0-15-2.2-29.2-6.6-42.5H464c26.5 0 48-21.5 48-48V80c0-26.5-21.5-48-48-48zM160 464c-26.5 0-48-23.3-48-52s21.5-52 48-52 48 23.3 48 52-21.5 52-48 52zm152.5 0c-26.5 0-48-23.3-48-52s21.5-52 48-52 48 23.3 48 52-21.5 52-48 52zM464 320H48V80h416v240z" })),
                e('h2', { className: "text-xl font-semibold text-text-primary" }, "Vamos conversar!"),
                e('p', null, "Selecione uma conversa para iniciar o atendimento.")
            ));
        }
        return e('main', { className: "flex-1 flex flex-col bg-background" },
            e('header', { className: "flex-shrink-0 bg-surface border-b border-gray-200 p-4 flex justify-between items-center" },
                e('div', null,
                    e('h2', { className: "font-semibold text-text-primary" }, `#${chat.ticketId} - ${chat.contact.name}`),
                    e('p', { className: "text-sm text-text-secondary" }, chat.contact.company)
                ),
                e('div', { className: "flex items-center space-x-2" },
                    e('button', { onClick: onOpenIncorrectServiceModal, className: "flex items-center space-x-2 bg-yellow-100 text-yellow-800 font-bold py-2 px-4 rounded-lg transition-colors hover:bg-yellow-200" }, 
                        e(Icons.FlagIcon, { className: 'w-5 h-5' }),
                        e('span', null, 'Serviço Incorreto')
                    ),
                    e('button', { className: "bg-primary hover:bg-primary-dark text-white font-bold py-2 px-4 rounded-lg transition-colors" }, "Entrar na conversa")
                )
            ),
            e('div', { className: "flex-1 overflow-y-auto p-6" },
                e('div', { className: "flex flex-col space-y-2" }, chat.messages.map(msg => e(MessageBubble, { key: msg.id, message: msg })))
            ),
            e('footer', { className: "flex-shrink-0 bg-surface border-t border-gray-200 p-4" },
                e('form', { className: "flex items-center space-x-3" },
                    e('input', { type: "text", value: newMessage, onChange: (ev) => setNewMessage(ev.target.value), placeholder: "Digite sua mensagem aqui...", className: "flex-1 bg-gray-100 border border-gray-300 rounded-full py-2 px-4 focus:outline-none focus:ring-2 focus:ring-primary-light" }),
                    e('button', { type: "submit", className: "bg-primary text-white rounded-full p-3 hover:bg-primary-dark transition-colors" }, e(Icons.SendIcon, { className: "w-5 h-5" }))
                )
            )
        );
    };

    const ChatItem = ({ chat, isSelected, isCompact, isSimplified, onClick }) => {
        const selectedClasses = isSelected ? 'bg-primary bg-opacity-10' : 'hover:bg-gray-100';
        if (isSimplified) {
            return e('div', { onClick, className: `flex items-center p-1.5 cursor-pointer rounded-lg transition-colors duration-150 ${selectedClasses}` },
                e('p', { className: "text-xs text-text-secondary truncate" },
                    `${chat.contact.name} / `,
                    e('span', { className: "text-text-primary" }, chat.contact.company)
                )
            );
        }
        const avatarSize = isCompact ? 'w-10 h-10' : 'w-12 h-12';
        const padding = isCompact ? 'p-1.5' : 'p-2.5';
        return e('div', { onClick, className: `flex items-center ${padding} cursor-pointer rounded-lg transition-colors duration-150 ${selectedClasses}` },
            e('div', { className: "relative mr-3 flex-shrink-0" },
                e('img', { src: chat.contact.avatarUrl, alt: chat.contact.name, className: `${avatarSize} rounded-full` })
            ),
            e('div', { className: "flex-1 min-w-0" },
                e('div', { className: "flex justify-between items-center" },
                    e('p', { className: "font-semibold text-sm text-text-primary truncate" }, chat.contact.name),
                    e('p', { className: "text-xs text-text-secondary ml-2 whitespace-nowrap" }, chat.status)
                ),
                e('div', { className: "flex justify-between items-center mt-1" },
                    e('p', { className: "text-sm text-text-secondary truncate pr-2" }, chat.contact.company),
                    chat.unreadCount > 0 && e('span', { className: "flex-shrink-0 flex items-center justify-center bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5" }, chat.unreadCount)
                )
            )
        );
    };

    const ChatList = ({ chats, categories, activeCategoryId, selectedChatId, onSelectChat, isCompact, viewMode, onToggleCompact }) => {
        const [collapsedCategories, setCollapsedCategories] = React.useState({});
        const waitingChats = React.useMemo(() => chats.filter(c => c.isWaiting), [chats]);
        const myChats = React.useMemo(() => chats.filter(c => !c.isWaiting), [chats]);

        const handleToggleCollapse = (categoryId) => setCollapsedCategories(prev => ({ ...prev, [categoryId]: !prev[categoryId] }));
        const handleToggleAll = () => {
            const areAllCollapsed = categories.every(cat => collapsedCategories[cat.id]);
            const newCollapsedState = {};
            categories.forEach(cat => { newCollapsedState[cat.id] = !areAllCollapsed; });
            setCollapsedCategories(newCollapsedState);
        };
        const groupedChats = React.useMemo(() => myChats.reduce((acc, chat) => {
            const { categoryId } = chat;
            if (!acc[categoryId]) acc[categoryId] = [];
            acc[categoryId].push(chat);
            return acc;
        }, {}), [myChats]);

        const renderListView = () => {
            return e('div', null,
                e('div', { className: "flex justify-between items-center px-1.5 pb-2 border-b border-gray-200 mb-2" },
                    e('button', { onClick: handleToggleAll, className: "text-xs font-semibold text-primary hover:underline" }, "Expandir/Recolher Todos"),
                    e('button', { onClick: onToggleCompact, title: "Alternar visualização compacta", className: "p-1 text-gray-500 hover:text-primary" }, e(Icons.ViewColumnsIcon, { className: "w-5 h-5" }))
                ),
                waitingChats.length > 0 && e('div', { className: "mb-2" },
                    e('div', { className: "flex items-center px-2.5 pt-3 pb-1" },
                        e('h3', { className: "font-semibold text-sm text-yellow-600 flex-grow" }, "Aguardando Atendimento"),
                        e('span', { className: "text-xs text-yellow-800 font-medium bg-yellow-200 rounded-full px-2 py-0.5" }, waitingChats.length)
                    ),
                    e('div', { className: "space-y-1" }, waitingChats.map(chat => e(ChatItem, { key: chat.id, chat, isSelected: chat.id === selectedChatId, onClick: () => onSelectChat(chat.id), isCompact, isSimplified: false })))
                ),
                categories.map(category => {
                    const chatsInCategory = groupedChats[category.id];
                    if (!chatsInCategory || chatsInCategory.length === 0) return null;
                    const isCollapsed = collapsedCategories[category.id] ?? false;
                    return e('div', { key: category.id, className: "mb-2" },
                        e('div', { onClick: () => handleToggleCollapse(category.id), className: "flex items-center px-2.5 pt-3 pb-1 cursor-pointer" },
                            e('span', { className: `w-2 h-2 rounded-full ${category.color} mr-3 flex-shrink-0` }),
                            e('h3', { className: "font-semibold text-sm text-text-primary flex-grow" }, category.name.replace('Suporte - ', '')),
                            e('span', { className: "text-xs text-text-secondary font-medium bg-gray-200 rounded-full px-2 py-0.5 mr-2" }, chatsInCategory.length),
                            e(Icons.ChevronDownIcon, { className: `w-5 h-5 text-gray-400 transition-transform ${isCollapsed ? '-rotate-90' : ''}` })
                        ),
                        e('div', { className: "space-y-1" }, chatsInCategory.map(chat => e(ChatItem, { key: chat.id, chat, isSelected: chat.id === selectedChatId, onClick: () => onSelectChat(chat.id), isCompact, isSimplified: isCollapsed })))
                    );
                })
            );
        };
        
        const renderTabsView = () => {
             if (activeCategoryId === 'all') {
                 return e('div', null,
                     waitingChats.length > 0 && e('div', { className: "mb-2" },
                         e('div', { className: "flex items-center px-2.5 pt-3 pb-1" },
                             e('h3', { className: "font-semibold text-sm text-yellow-600 flex-grow" }, "Aguardando Atendimento"),
                             e('span', { className: "text-xs text-yellow-800 font-medium bg-yellow-200 rounded-full px-2 py-0.5" }, waitingChats.length)
                         ),
                         e('div', { className: "space-y-1" }, waitingChats.map(chat => e(ChatItem, { key: chat.id, chat, isSelected: chat.id === selectedChatId, onClick: () => onSelectChat(chat.id), isCompact, isSimplified: false })))
                     ),
                     myChats.length > 0 && e('div', null,
                         waitingChats.length > 0 && e('div', { className: "flex items-center px-2.5 pt-3 pb-1 border-t border-gray-200 mt-2" }, e('h3', { className: "font-semibold text-sm text-text-primary flex-grow" }, "Meus Chats")),
                         categories.map(category => {
                             const chatsInCategory = groupedChats[category.id];
                             if (!chatsInCategory || chatsInCategory.length === 0) return null;
                             return e('div', { key: category.id, className: "mb-2" },
                                 e('div', { className: "flex items-center px-2.5 pt-3 pb-1" },
                                     e('span', { className: `w-2 h-2 rounded-full ${category.color} mr-3 flex-shrink-0` }),
                                     e('h3', { className: "font-semibold text-sm text-text-primary flex-grow" }, category.name.replace('Suporte - ', '')),
                                     e('span', { className: "text-xs text-text-secondary font-medium bg-gray-200 rounded-full px-2 py-0.5" }, chatsInCategory.length)
                                 ),
                                 e('div', { className: "space-y-1" }, chatsInCategory.map(chat => e(ChatItem, { key: chat.id, chat, isSelected: chat.id === selectedChatId, onClick: () => onSelectChat(chat.id), isCompact, isSimplified: false })))
                             );
                         })
                     )
                 );
             }
            const visibleChats = chats.filter(c => c.categoryId === activeCategoryId);
            if (visibleChats.length === 0) return e('div', { className: "p-4 text-center text-text-secondary" }, "Nenhum chat nesta categoria.");
            return e('div', { className: "space-y-1" }, visibleChats.map(chat => e(ChatItem, { key: chat.id, chat, isSelected: chat.id === selectedChatId, onClick: () => onSelectChat(chat.id), isCompact, isSimplified: false })));
        };

        return viewMode === 'tabs' ? renderTabsView() : renderListView();
    };
    
    const DetailsPanel = ({ chat }) => {
        const details = chat ? CONSTANTS.CONTACT_DETAILS_MOCK[chat.id] : null;
        const DetailItem = ({ label, value }) => e('div', { className: "mb-4" },
            e('p', { className: "text-xs text-text-secondary" }, label),
            e('p', { className: "text-sm text-text-primary font-medium" }, value)
        );
        return e('aside', { className: "w-80 bg-surface border-l border-gray-200 p-6 flex-shrink-0" },
            e('div', { className: "flex justify-between items-center mb-6" },
                e('h2', { className: "text-lg font-semibold text-text-primary" }, "Detalhes"),
                e('button', { className: "text-text-secondary hover:text-text-primary" }, "✕")
            ),
            details ? e('div', null,
                e(DetailItem, { label: "Empresa", value: details.company }),
                e(DetailItem, { label: "Diariamente", value: details.id }),
                e(DetailItem, { label: "Agentes participantes", value: details.agent }),
                e(DetailItem, { label: "Domínio", value: details.domain }),
                e(DetailItem, { label: "Serviço", value: details.service }),
                e(DetailItem, { label: "Origem", value: details.origin }),
                e(DetailItem, { label: "Tiposistema", value: details.type })
            ) : e('div', { className: "text-center text-text-secondary mt-10" }, e('p', null, "Selecione um chat para ver os detalhes."))
        );
    };

    const App = () => {
        const [selectedChatId, setSelectedChatId] = React.useState('chat2');
        const [activeCategoryId, setActiveCategoryId] = React.useState('all');
        const [viewMode, setViewMode] = React.useState('tabs');
        const [isCompactView, setIsCompactView] = React.useState(false);
        const [isModalOpen, setIsModalOpen] = React.useState(false);
        const [modalChatData, setModalChatData] = React.useState(null);

        const selectedChat = CONSTANTS.CHATS.find(c => c.id === selectedChatId) || null;
        const TABS = [{ id: 'all', name: 'Todos' }, ...CONSTANTS.CATEGORIES.map(c => ({...c, name: c.name.replace('Suporte - ', '')}))];

        const handleOpenModal = () => {
            const data = captureDataFromPage();
            // Find the full category name for the select
            const category = CONSTANTS.CATEGORIES.find(c => data.servicoSelecionado.includes(c.name.replace('Suporte - ', '')));
            data.servicoSelecionado = category ? category.name : '';
            setModalChatData(data);
            setIsModalOpen(true);
        };
        
        const ChatListPanel = () => {
             const getChatCount = (categoryId) => {
                if (categoryId === 'all') return CONSTANTS.CHATS.length;
                return CONSTANTS.CHATS.filter(c => c.categoryId === categoryId).length;
            };
            return e('aside', { className: "w-96 bg-surface flex flex-col border-r border-gray-200 flex-shrink-0" },
                e('header', { className: "p-2 flex items-center bg-surface border-b border-gray-200 flex-shrink-0 space-x-2" },
                    e('button', { className: "p-2 text-gray-500 hover:text-primary" }, e(Icons.MenuIcon, { className: "w-6 h-6" })),
                    e('div', { className: "relative flex-1" },
                        e('div', { className: "absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none" }, e(Icons.SearchIcon, { className: "w-5 h-5 text-gray-400" })),
                        e('input', { type: "text", placeholder: "Buscar", className: "w-full bg-gray-100 border-transparent rounded-full py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary-light" })
                    ),
                    e('button', { onClick: () => setViewMode(prev => prev === 'tabs' ? 'list' : 'tabs'), title: "Alternar visualização", className: "p-2 text-gray-500 hover:text-primary" },
                        viewMode === 'tabs' ? e(Icons.ListBulletIcon, { className: "w-6 h-6" }) : e(Icons.ViewColumnsIcon, { className: "w-6 h-6" }))
                ),
                viewMode === 'tabs' && e('nav', { className: "flex-shrink-0 flex overflow-x-auto border-b border-gray-200 bg-surface" },
                    TABS.map(tab => {
                        const count = getChatCount(tab.id);
                        if (count === 0 && tab.id !== 'all') return null;
                        const isActive = activeCategoryId === tab.id;
                        return e('button', { key: tab.id, onClick: () => setActiveCategoryId(tab.id), className: `py-3 px-4 text-sm font-semibold whitespace-nowrap transition-colors duration-200 ${isActive ? 'text-primary border-b-2 border-primary' : 'text-text-secondary hover:bg-gray-100'}` },
                            tab.name,
                            e('span', { className: `ml-1.5 text-xs font-bold rounded-full px-2 py-0.5 ${isActive ? 'bg-primary text-white' : 'bg-gray-200 text-text-secondary'}` }, count)
                        );
                    })
                ),
                e('div', { className: "flex-1 overflow-y-auto p-2" },
                    e(ChatList, { chats: CONSTANTS.CHATS, categories: CONSTANTS.CATEGORIES, selectedChatId, onSelectChat: setSelectedChatId, activeCategoryId, isCompact: isCompactView, viewMode, onToggleCompact: () => setIsCompactView(!isCompactView) })
                )
            );
        }

        return e('div', { className: "h-screen w-screen bg-gray-100 flex font-sans text-sm" },
            e(ChatListPanel, null),
            e('div', { className: "flex flex-1 min-w-0" },
                e(ChatWindow, { chat: selectedChat, onOpenIncorrectServiceModal: handleOpenModal }),
                e(DetailsPanel, { chat: selectedChat })
            ),
            e(IncorrectServiceModal, { isOpen: isModalOpen, onClose: () => setIsModalOpen(false), chatData: modalChatData, currentUser: CONSTANTS.CURRENT_USER })
        );
    };

    // --- INITIALIZATION LOGIC ---

    function initializeReactApp() {
        const targetNode = document.querySelector('app-home');
        if (!targetNode) {
            console.error("CRX: Target element 'app-home' not found. Cannot initialize UI.");
            return;
        }

        // Hide original UI
        targetNode.style.display = 'none';

        // Create a new root for our app
        const rootDiv = document.createElement('div');
        rootDiv.id = 'tampermonkey-root';
        document.body.appendChild(rootDiv);

        // Inject styles and render React App
        injectStyles();
        const root = ReactDOM.createRoot(rootDiv);
        root.render(e(App));
        console.log("CRX: React UI Injected and Rendered.");
    }
    
    // Observer to detect when the app is ready and run initialization logic.
    let initialized = false;
    const observer = new MutationObserver((mutations, obs) => {
        const chatUIReady = document.querySelector('app-chat');
        const dashboardReady = document.querySelector('app-report-card-chart-indicator');

        if (chatUIReady && !initialized) {
            console.log("CRX: Chat UI detected. Initializing redesign.");
            initializeReactApp();
            initialized = true; // Prevents re-initialization
        }
        
        if (dashboardReady) {
            scrapeAndSendData();
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    console.log("CRX: Tampermonkey script loaded and observing DOM changes.");

})();
