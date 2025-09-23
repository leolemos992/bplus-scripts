// ==UserScript==
// @name         B.Plus! - Contador de Atendimentos & Melhorias Beemore
// @namespace    http://tampermonkey.net/
// @version      8.8
// @description  Adiciona barra de rolagem individual para cada grupo de chat (Meus Chats, Fiscal, etc.) para otimizar o espaço de forma eficaz.
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
    const SCRIPT_VERSION = GM_info.script.version || '8.8';
    const IDLE_REFRESH_SECONDS = 90; // Tempo em segundos para o auto-refresh
    const MAX_GROUP_HEIGHT_ITEMS = 6; // Máximo de chats visíveis por grupo antes da rolagem
    const API_URL = 'http://10.1.11.15/contador/api.php';
    const CATEGORY_COLORS = {
        'Suporte - PDV': '#E57373', 'Suporte - Retaguarda': '#64B5F6', 'Suporte - Fiscal': '#81C784',
        'Suporte - Web': '#FFD54F', 'Suporte - Mobile': '#FFB74D',
        'Sem Categoria': '#9575CD', // Roxo para chats sem categoria (ex: WhatsApp)
        'default': '#BDBDBD'
    };
    const SPINNER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="crx-spinner"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg>`;
    const REFRESH_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"></path><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>`;
    const COMPACT_VIEW_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/></svg>`;


    // --- VARIÁVEIS DE ESTADO ---
    const collapsedGroups = new Set();
    let idleTimer; // Variável para o timer de inatividade
    let isAutoRefreshing = false; // Flag para controlar o processo de auto-refresh
    let isCompactMode = GM_getValue('compactMode', false); // Estado do modo compacto

    // Função auxiliar para converter HEX para RGBA
    function hexToRgba(hex, alpha) {
        let r = 0, g = 0, b = 0;
        if (hex.length == 4) { // #RGB
            r = "0x" + hex[1] + hex[1]; g = "0x" + hex[2] + hex[2]; b = "0x" + hex[3] + hex[3];
        } else if (hex.length == 7) { // #RRGGBB
            r = "0x" + hex[1] + hex[2]; g = "0x" + hex[3] + hex[4]; b = "0x" + hex[5] + hex[6];
        }
        return `rgba(${+r},${+g},${+b},${alpha})`;
    }

    // =================================================================================
    // INJEÇÃO DE ESTILOS
    // =================================================================================
    function injetarEstilos() {
        if (document.getElementById('bplus-custom-styles')) return;
        let styles = '';
        for (const category in CATEGORY_COLORS) {
            const safeCategory = category.replace(/[\s-]+/g, '-').toLowerCase();
            const color = CATEGORY_COLORS[category];
            styles += `
                .crx-category-${safeCategory} { border-left: 5px solid ${color} !important; }
                .crx-category-${safeCategory}.crx-chat-highlight { background-color: ${hexToRgba(color, 0.2)} !important; }
                .dark .crx-category-${safeCategory}.crx-chat-highlight { background-color: ${hexToRgba(color, 0.25)} !important; }
                .crx-group-header-${safeCategory} { background-color: ${color} !important; }
            `;
        }
        GM_addStyle(`
            #bplus-custom-styles { display: none; } /* Elemento marcador para evitar reinjeção */

            /* [NOVO v8.8] BARRA DE ROLAGEM PARA TODOS OS GRUPOS E LISTAS */
            .crx-group-container, app-chat-list > section {
                max-height: calc(${MAX_GROUP_HEIGHT_ITEMS} * 72px); /* 72px = altura de um item normal */
                overflow-y: auto !important;
                overflow-x: hidden !important;
                padding-right: 5px;
            }
            .crx-compact-view .crx-group-container, .crx-compact-view app-chat-list > section {
                max-height: calc(${MAX_GROUP_HEIGHT_ITEMS} * 40px); /* 40px = altura de um item compacto */
            }

            /* Estilização da barra de rolagem */
            .crx-group-container::-webkit-scrollbar, app-chat-list > section::-webkit-scrollbar { width: 6px; }
            .crx-group-container::-webkit-scrollbar-track, app-chat-list > section::-webkit-scrollbar-track { background: transparent; }
            .crx-group-container::-webkit-scrollbar-thumb, app-chat-list > section::-webkit-scrollbar-thumb { background-color: #ccc; border-radius: 10px; }
            .dark .crx-group-container::-webkit-scrollbar-thumb, .dark app-chat-list > section::-webkit-scrollbar-thumb { background-color: #4f4f5a; }

            /* [NOVO v8.8] Estilos para o Modo Compacto */
            .crx-compact-view app-chat-list-item { height: 40px !important; }
            .crx-compact-view app-chat-list-item > section > div:first-of-type { display: flex; align-items: center; }
            .crx-compact-view app-chat-list-item .flex.flex-col { display: none; } /* Oculta a segunda linha de texto */
            .crx-control-btn.active { background-color: #e0e0e0; border-color: #adadad; }
            .dark .crx-control-btn.active { background-color: #4a4a61; border-color: #6a627e; }


            /* Animações e Destaques */
            @keyframes crx-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            .crx-spinner { animation: crx-spin 1s linear infinite; }
            .crx-chat-aguardando { background-color: #FFDAB9 !important; border-left: 5px solid #FFA500 !important; }
            .dark .crx-chat-aguardando { background-color: #5a4a3e !important; border-left-color: #ff8c00 !important; }

            /* Ícone de Versão na Barra Lateral */
            #crx-version-indicator-sidebar {
                position: relative; cursor: help; width: 36px; height: 36px; border-radius: 6px;
                display: flex; align-items: center; justify-content: center; color: #e1dbfb;
                background-color: transparent; transition: background-color 0.15s ease-in-out; margin-bottom: 6px;
            }
            #crx-version-indicator-sidebar:hover { background-color: #5e47d0; }
            #crx-version-indicator-sidebar .crx-tooltip {
                visibility: hidden; width: 160px; background-color: #333; color: #fff; text-align: center;
                border-radius: 6px; padding: 8px; position: absolute; z-index: 100;
                left: 125%; top: 50%; transform: translateY(-50%); opacity: 0; transition: opacity 0.3s; line-height: 1.4;
            }
            #crx-version-indicator-sidebar:hover .crx-tooltip { visibility: visible; opacity: 1; }

            /* Elementos da UI */
            .crx-group-header {
                display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; font-weight: 600; color: white;
                text-shadow: 1px 1px 2px rgba(0,0,0,0.4); padding: 6px 12px; border-radius: 4px; text-transform: uppercase;
                margin-top: 10px; cursor: pointer; position: sticky; top: 0; z-index: 10;
            }
            .crx-group-header .crx-chevron { transition: transform 0.2s ease-in-out; }
            .crx-group-header.collapsed .crx-chevron { transform: rotate(-90deg); }
            .crx-group-container { overflow: hidden; transition: max-height 0.3s ease-in-out; }
            #crx-header-btn {
                background-color: #FB923C; color: white !important; border: 1px solid #F97316; padding: 0 12px; height: 32px;
                border-radius: 0.25rem; cursor: pointer; font-weight: 500; margin-right: 8px; display: flex; align-items: center;
            }
            #crx-header-btn:hover { background-color: #F97316; border-color: #EA580C; }
            .crx-control-btn { background-color: #ffffff; border: 1px solid #e5e7eb; color: #525252; transition: all 0.2s; display: flex; align-items: center; justify-content: center; height: 2rem; width: 2rem; border-radius: 0.25rem; cursor: pointer; margin-left: 8px; }
            .dark .crx-control-btn { background-color: #37374a; border-color: #4c445c; color: #e1e1e1; }

            /* Modal (Claro e Escuro) */
            .crx-modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.6); z-index: 9998; display: flex; justify-content: center; align-items: center; }
            .crx-modal-content { background-color: white; padding: 25px; border-radius: 8px; width: 350px; box-shadow: 0 5px 15px rgba(0,0,0,0.3); z-index: 9999; }
            .dark .crx-modal-content { background-color: #2c2c3d; color: #e1e1e1; }
            .crx-modal-content h3 { margin: 0 0 20px 0; color: #333; }
            .dark .crx-modal-content h3 { color: #e1e1e1; }
            .crx-form-group label { display: block; margin-bottom: 5px; font-weight: 500; color: #333; }
            .dark .crx-form-group label { color: #e1e1e1; }
            .crx-form-group input, .crx-form-group select { width: 100%; padding: 8px; box-sizing: border-box; border: 1px solid #ccc; border-radius: 4px; background-color: #fff !important; color: #000 !important; }
            .dark .crx-form-group input, .dark .crx-form-group select { background-color: #3e374e !important; color: #e1e1e1 !important; border-color: #4c445c !important; }
            .crx-btn { width: 100%; padding: 10px; background-color: #2c6fbb; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; }
            #crx-status { margin-top: 15px; font-weight: bold; text-align: center; }

            /* Estilos de Categoria */
            ${styles}
        `);
    }


    // =================================================================================
    // CAPTURA DE DADOS
    // =================================================================================
    function capturarDadosPagina() {
        let analista = '', numero = '', solicitante = '', revenda = '', servicoSelecionado = '';

        analista = document.querySelector('app-chat-list-container > header span.font-medium')?.innerText.trim() || '';

        const chatHeaderElement = document.querySelector('app-chat-agent-header');
        if (chatHeaderElement) {
            const titleElement = chatHeaderElement.querySelector('div > span');
            if(titleElement){
                 const match = titleElement.innerText.match(/#(\d+)/);
                 if(match) numero = match[1];
            }
        }

        const activeChatElement = document.querySelector('app-chat-list-item.active');
        if (activeChatElement) {
            solicitante = activeChatElement.querySelector('span.truncate.font-medium')?.innerText.trim() || '';
            revenda = activeChatElement.querySelector('span.inline-flex > span.truncate')?.innerText.trim() || '';
            servicoSelecionado = activeChatElement.querySelector('span.shrink-0')?.innerText.trim() || '';
        }

        return { analista, numero, revenda, solicitante, servicoSelecionado };
    }

    // =================================================================================
    // FUNCIONALIDADE: REGISTRO DE SERVIÇO INCORRETO
    // =================================================================================
    function injetarBotaoRegistro() {
        if (document.getElementById('crx-header-btn')) return;
        const actionButtonsContainer = document.querySelector('app-chat-agent-header > div:last-of-type');
        if (!actionButtonsContainer) return;
        const referenceButton = actionButtonsContainer.querySelector('app-button[icon="tablerX"], app-button[text="Sair da conversa"]');
        if (referenceButton) {
            const ourButton = document.createElement('button');
            ourButton.id = 'crx-header-btn';
            ourButton.textContent = 'Serviço Incorreto';
            ourButton.addEventListener('click', abrirModalRegistro);
            referenceButton.parentElement.insertBefore(ourButton, referenceButton);
        }
    }

    function observarTags() {
        const detailsPanel = document.querySelector('app-chat-aside');
        if (!detailsPanel || detailsPanel.getAttribute('data-crx-observed')) return;
        const observer = new MutationObserver(() => {
            const tagElement = detailsPanel.querySelector('app-tag span[style*="text-overflow: ellipsis"]');
            if (tagElement && tagElement.innerText.trim().toLowerCase() === 'servico-incorreto') {
                 abrirModalRegistro();
                 observer.disconnect();
                 detailsPanel.removeAttribute('data-crx-observed');
            }
        });
        observer.observe(detailsPanel, { childList: true, subtree: true });
        detailsPanel.setAttribute('data-crx-observed', 'true');
    }

    function abrirModalRegistro() {
        if (document.getElementById('crx-modal')) return;
        const data = capturarDadosPagina();
        const modalHTML = `
            <div id="crx-modal" class="crx-modal-overlay">
                <div class="crx-modal-content">
                    <h3>Registrar Atendimento Incorreto</h3>
                    <form id="crx-atendimento-form">
                        <input type="hidden" id="crx-analista" value="${data.analista}">
                        <div class="crx-form-group"><label>Número</label><input type="text" id="crx-numero" value="${data.numero}" required></div>
                        <div class="crx-form-group"><label>Revenda</label><input type="text" id="crx-revenda" value="${data.revenda}" required></div>
                        <div class="crx-form-group"><label>Solicitante</label><input type="text" id="crx-solicitante" value="${data.solicitante}" required></div>
                        <div class="crx-form-group">
                            <label>Serviço Selecionado</label>
                            <select id="crx-servico-selecionado" required>
                                <option value="">Selecione...</option><option value="Suporte - Web">Suporte - Web</option><option value="Suporte - PDV">Suporte - PDV</option>
                                <option value="Suporte - Retaguarda">Suporte - Retaguarda</option><option value="Suporte - Fiscal">Suporte - Fiscal</option><option value="Suporte - Mobile">Suporte - Mobile</option>
                            </select>
                        </div>
                        <div class="crx-form-group">
                            <label>Serviço Correto</label>
                            <select id="crx-servico-correto" required>
                                <option value="">Selecione...</option><option value="Suporte - Web">Suporte - Web</option><option value="Suporte - PDV">Suporte - PDV</option>
                                <option value="Suporte - Retaguarda">Suporte - Retaguarda</option><option value="Suporte - Fiscal">Suporte - Fiscal</option><option value="Suporte - Mobile">Suporte - Mobile</option>
                            </select>
                        </div>
                        <button type="submit" class="crx-btn">Salvar Atendimento</button>
                        <div id="crx-status"></div>
                    </form>
                </div>
            </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        if (document.body.classList.contains('dark')) {
            document.querySelector('.crx-modal-content').classList.add('dark');
        }
        const servicoSelect = document.getElementById('crx-servico-selecionado');
        for (let option of servicoSelect.options) {
            if (option.text === data.servicoSelecionado) { option.selected = true; break; }
        }
        document.getElementById('crx-atendimento-form').addEventListener('submit', lidarComSubmitFormulario);
        document.getElementById('crx-modal').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) fecharModalRegistro();
        });
    }

    function fecharModalRegistro() {
        const modal = document.getElementById('crx-modal');
        if (modal) modal.remove();
    }

    function lidarComSubmitFormulario(e) {
        e.preventDefault();
        const statusDiv = document.getElementById('crx-status');
        const atendimentoData = {
            action: 'create', numero: document.getElementById('crx-numero').value,
            revenda: document.getElementById('crx-revenda').value, solicitante: document.getElementById('crx-solicitante').value,
            servicoSelecionado: document.getElementById('crx-servico-selecionado').value, servicoCorreto: document.getElementById('crx-servico-correto').value,
            data: new Date().toISOString().split('T')[0], analista: document.getElementById('crx-analista').value
        };
        statusDiv.textContent = 'Salvando...';
        GM_xmlhttpRequest({
            method: 'POST', url: API_URL, headers: { 'Content-Type': 'application/json' }, data: JSON.stringify(atendimentoData),
            onload: function(response) {
                try {
                    const result = JSON.parse(response.responseText);
                    statusDiv.textContent = result.success || `Falha: ${result.error || 'Erro desconhecido'}`;
                    statusDiv.style.color = result.success ? 'green' : 'red';
                    if (result.success) setTimeout(fecharModalRegistro, 1500);
                } catch (err) { statusDiv.textContent = 'Erro ao processar resposta da API.'; statusDiv.style.color = 'red'; }
            },
            onerror: function() { statusDiv.textContent = 'Falha de conexão com a API.'; statusDiv.style.color = 'red'; }
        });
    }

    // =================================================================================
    // FUNCIONALIDADE: MELHORIAS DE INTERFACE E AUTO-REFRESH
    // =================================================================================
    function toggleCompactMode() {
        isCompactMode = !isCompactMode;
        GM_setValue('compactMode', isCompactMode);
        document.body.classList.toggle('crx-compact-view', isCompactMode);
        const compactBtn = document.getElementById('crx-compact-toggle');
        if(compactBtn) {
            compactBtn.classList.toggle('active', isCompactMode);
        }
    }

    function adicionarControles(container) {
        // [REMOVIDO] O botão de atualização manual não é mais necessário.
        if (document.getElementById('crx-refresh-btn')) {
            document.getElementById('crx-refresh-btn').remove();
        }

        // [NOVO v8.8] Adiciona botão de modo compacto
        if (!document.getElementById('crx-compact-toggle')) {
            const compactBtn = document.createElement('button');
            compactBtn.id = 'crx-compact-toggle';
            compactBtn.className = 'crx-control-btn';
            compactBtn.title = 'Alternar visualização compacta';
            compactBtn.innerHTML = COMPACT_VIEW_SVG;
            compactBtn.onclick = toggleCompactMode;
            if (isCompactMode) {
                compactBtn.classList.add('active');
            }
            container.appendChild(compactBtn);
        }
    }

    /**
     * MÉTODO DE ATUALIZAÇÃO ESTÁVEL. Navega para o dashboard e volta para a página de chat
     * para forçar um recarregamento completo dos dados.
     */
    function atualizarListasDeChat(isAutoRefresh = false) {
        const dashboardButton = document.querySelector('div[data-sidebar-option="dashboard"]');
        const sidebarChatButton = document.querySelector('div[data-sidebar-option="entities.chat"]');

        if (!dashboardButton || !sidebarChatButton) {
            if (!isAutoRefresh) console.log('B.Plus!: Botões de navegação (Dashboard/Chat) não encontrados.');
            return;
        }

        if (isAutoRefreshing) {
             console.log('B.Plus!: Atualização já em andamento.');
             return;
        }

        isAutoRefreshing = true;
        const versionIndicator = document.getElementById('crx-version-indicator-sidebar');
        if (versionIndicator) {
             versionIndicator.innerHTML = `${SPINNER_SVG} <span class="crx-tooltip">B.Plus! v${SCRIPT_VERSION}<br>Atualizando...</span>`;
        }

        dashboardButton.click();
        setTimeout(() => {
            sidebarChatButton.click();
            setTimeout(() => {
                if (versionIndicator) {
                    versionIndicator.innerHTML = `B+ <span class="crx-tooltip">B.Plus! v${SCRIPT_VERSION}<br>Status: Operacional</span>`;
                }
                isAutoRefreshing = false;
            }, 1500); // Tempo para a UI do chat recarregar
        }, 400); // Tempo para a UI do dashboard carregar
    }

    /**
     * LÓGICA DE ATUALIZAÇÃO INTELIGENTE.
     */
    function performSmartRefresh() {
        // CONDIÇÃO DE GUARDA: Só roda se estiver na página de chat
        if (!window.location.href.includes('/chat')) {
            resetIdleTimer();
            return;
        }

        console.log("B.Plus!: Verificando condições para auto-refresh...");
        const isChatOpen = !!document.querySelector('app-chat-agent-header');
        const isTyping = !!document.querySelector('textarea:focus, input:focus');

        if (document.hidden || isChatOpen || isTyping) {
            console.log("B.Plus!: Auto-refresh cancelado (janela inativa, chat aberto ou digitando).");
            resetIdleTimer(); // Reseta o timer para a próxima contagem
            return;
        }

        console.log("B.Plus!: Executando auto-refresh...");
        atualizarListasDeChat(true);
        resetIdleTimer(); // Reinicia o ciclo após a execução
    }

    function resetIdleTimer() {
        clearTimeout(idleTimer);
        idleTimer = setTimeout(performSmartRefresh, IDLE_REFRESH_SECONDS * 1000);
    }

    function aplicarDestaquesECores() {
        document.querySelectorAll('app-chat-list-item').forEach(item => {
            item.className = item.className.replace(/\bcrx-category-\S+/g, '');
            item.classList.remove('crx-chat-highlight', 'crx-chat-aguardando');

            const hasAlert = !!item.querySelector('app-icon[icon="tablerAlertCircle"]');
            const isAguardando = !!item.querySelector('span[class*="text-orange"]');
            const categoryElement = item.querySelector('section > div:first-of-type > span:last-of-type');
            const category = categoryElement ? categoryElement.textContent.trim() : 'Sem Categoria';
            const categoryClass = `crx-category-${category.replace(/[\s-]+/g, '-').toLowerCase()}`;

            item.classList.add(categoryClass);
            item.classList.toggle('crx-chat-highlight', hasAlert && !isAguardando);
            item.classList.toggle('crx-chat-aguardando', isAguardando);
        });
    }

    function agruparEOrdenarChats() {
        const chatListContainer = document.querySelector('app-chat-list-container > section');
        if (!chatListContainer || chatListContainer.getAttribute('data-crx-grouped') === 'true') return;

        const getCategory = (item) => {
            const categoryElement = item.querySelector('section > div:first-of-type > span:last-of-type');
            return categoryElement?.textContent.trim() || 'Sem Categoria';
        };

        collapsedGroups.clear();
        chatListContainer.querySelectorAll('.crx-group-header.collapsed').forEach(header => {
            const categoryName = header.querySelector('span:first-child').textContent.split(' [')[0];
            collapsedGroups.add(categoryName);
        });

        const allChatLists = Array.from(chatListContainer.querySelectorAll('app-chat-list'));
        const othersList = allChatLists.find(list => list.querySelector('header > div > span')?.textContent.trim() === 'Outros');

        if (!othersList) return;

        const otherChatsItems = Array.from(othersList.querySelectorAll('app-chat-list-item'));
        const groups = new Map();

        otherChatsItems.forEach(item => {
            const category = getCategory(item);
            if (!groups.has(category)) groups.set(category, []);
            groups.get(category).push(item);
        });

        othersList.remove();

        const sortedGroups = new Map([...groups.entries()].sort());

        sortedGroups.forEach((groupItems, category) => {
            if (groupItems.length === 0) return;

            const safeCategory = category.replace(/[\s-]+/g, '-').toLowerCase();
            const isCollapsed = collapsedGroups.has(category);
            const header = document.createElement('div');
            header.className = `crx-group-header crx-group-header-${safeCategory} ${isCollapsed ? 'collapsed' : ''}`;
            header.innerHTML = `
                <span>${category} [${groupItems.length}]</span>
                <span class="crx-chevron">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </span>
            `;
            const groupContainer = document.createElement('div');
            groupContainer.className = 'crx-group-container';
            const initialMaxHeight = groupItems.length * (isCompactMode ? 40 : 80); // Considera modo compacto
            header.onclick = () => {
                const willCollapse = !header.classList.contains('collapsed');
                header.classList.toggle('collapsed');
                groupContainer.style.maxHeight = willCollapse ? '0px' : `${initialMaxHeight}px`;
                if (willCollapse) collapsedGroups.add(category); else collapsedGroups.delete(category);
            };
            chatListContainer.appendChild(header);
            chatListContainer.appendChild(groupContainer);
            groupContainer.style.maxHeight = isCollapsed ? '0px' : `${initialMaxHeight}px`;

            groupItems.sort((a, b) => {
                const aP = a.classList.contains('crx-chat-highlight') ? 3 : (a.classList.contains('crx-chat-aguardando') ? 2 : 1);
                const bP = b.classList.contains('crx-chat-highlight') ? 3 : (b.classList.contains('crx-chat-aguardando') ? 2 : 1);
                return bP - aP;
            });

            groupItems.forEach(item => groupContainer.appendChild(item));
        });

        chatListContainer.setAttribute('data-crx-grouped', 'true');
    }

    function injetarIndicadorDeVersao() {
        if (document.getElementById('crx-version-indicator-sidebar')) return;
        const helpButton = document.querySelector('div[data-sidebar-option="help"]');
        if (helpButton && helpButton.parentElement) {
            const indicator = document.createElement('div');
            indicator.id = 'crx-version-indicator-sidebar';
            indicator.innerHTML = `B+ <span class="crx-tooltip">B.Plus! v${SCRIPT_VERSION}<br>Status: Operacional</span>`;
            helpButton.parentElement.insertBefore(indicator, helpButton);
        }
    }

    // =================================================================================
    // LOOP PRINCIPAL E INICIALIZAÇÃO
    // =================================================================================
    let mainInterval;

    function aplicarCustomizacoes() {
        aplicarDestaquesECores();

        // [REMOVIDO v8.8] A função aplicarBarraDeRolagem() foi removida pois o CSS agora cuida disso.

        const chatListContainer = document.querySelector('app-chat-list-container > section');
        if (chatListContainer) {
            if (!chatListContainer.getAttribute('data-crx-grouped') || chatListContainer.querySelector('app-chat-list')) {
                chatListContainer.removeAttribute('data-crx-grouped');
                agruparEOrdenarChats();
            }
        }

        if (document.querySelector('app-chat-agent-header')) {
            injetarBotaoRegistro();
            observarTags();
        }
    }

    function inicializar() {
        injetarEstilos();

        // [NOVO v8.8] Aplica a classe de modo compacto na inicialização, se estiver ativa
        if (isCompactMode) {
            document.body.classList.add('crx-compact-view');
        }

        // Observer para elementos que aparecem dinamicamente
        const observer = new MutationObserver(() => {
            const targetContainer = document.querySelector('app-chat-list-container > div.flex.items-center');
            if (targetContainer) {
                adicionarControles(targetContainer);
            }
            injetarIndicadorDeVersao();
        });
        observer.observe(document.body, { childList: true, subtree: true });

        // Inicia a lógica do auto-refresh inteligente por inatividade
        window.addEventListener('mousemove', resetIdleTimer, { passive: true });
        window.addEventListener('keypress', resetIdleTimer, { passive: true });
        window.addEventListener('click', resetIdleTimer, { passive: true });
        resetIdleTimer();

        if (mainInterval) clearInterval(mainInterval);
        mainInterval = setInterval(aplicarCustomizacoes, 1500);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', inicializar);
    } else {
        inicializar();
    }
})();
