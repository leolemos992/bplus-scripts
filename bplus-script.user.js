// ==UserScript==
// @name         B.Plus! - Contador de Atendimentos & Melhorias Beemore
// @namespace    http://tampermonkey.net/
// @version      8.3
// @description  Modo Compacto reconstruído com CSS para estabilidade visual, mais nova cor para 'Sem Categoria' e método de atualização robusto.
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
    const SCRIPT_VERSION = GM_info.script.version || '8.3';
    const IDLE_REFRESH_SECONDS = 90; // Tempo em segundos para o auto-refresh
    const API_URL = 'http://10.1.11.15/contador/api.php';
    const CATEGORY_COLORS = {
        'Suporte - PDV': '#E57373', 'Suporte - Retaguarda': '#64B5F6', 'Suporte - Fiscal': '#81C784',
        'Suporte - Web': '#FFD54F', 'Suporte - Mobile': '#FFB74D',
        'Sem Categoria': '#9575CD', // Roxo para chats sem categoria (ex: WhatsApp)
        'default': '#BDBDBD'
    };
    const SPINNER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="crx-spinner"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg>`;
    const REFRESH_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>`;
    const COMPACT_VIEW_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="20" y2="6"></line><line x1="4" y1="12" x2="20" y2="12"></line><line x1="4" y1="18" x2="20" y2="18"></line></svg>`;

    // --- VARIÁVEIS DE ESTADO ---
    let collapsedGroups = new Set();
    let idleTimer; // Variável para o timer de inatividade
    let isCompactMode = GM_getValue('compactMode', false);

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
            .crx-control-btn { background-color: #ffffff; border: 1px solid #e5e7eb; color: #525252; transition: all 0.2s; display: flex; align-items: center; justify-content: center; height: 2rem; width: 2rem; border-radius: 0.25rem; cursor: pointer; }
            .crx-control-btn:disabled { cursor: not-allowed; opacity: 0.7; }
            .dark .crx-control-btn { background-color: #37374a; border-color: #4c445c; color: #e1e1e1; }
            #crx-compact-toggle { margin-left: 8px; }
            #crx-compact-toggle.active { background-color: #e0e7ff; border-color: #a5b4fc; }
            .dark #crx-compact-toggle.active { background-color: #4a4a6a; border-color: #6d6d8d; }

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

            /* MODO COMPACTO (LÓGICA CSS CORRIGIDA) */
            .crx-compact-view app-chat-list-item { height: 40px !important; align-items: center; }
            .crx-compact-view app-chat-list-item > div:first-of-type { display: none !important; } /* Esconde ícone do solicitante */
            .crx-compact-view app-chat-list-item section > section > div:last-child { display: none !important; } /* Esconde info do analista */
            .crx-compact-view app-chat-list-item section > div > span.shrink-0 { display: none !important; } /* Esconde tipo de serviço */
            /* Realinha o conteúdo restante */
            .crx-compact-view app-chat-list-item section { height: 100%; }
            .crx-compact-view app-chat-list-item section > section { display: flex; align-items: center; height: 100%; }
            .crx-compact-view app-chat-list-item section > section > div:first-of-type { display: flex; flex-direction: row; align-items: center; gap: 5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: calc(100% - 30px); }
            .crx-compact-view app-chat-list-item span.font-medium::after { content: ' - '; font-weight: normal; color: #666; }
            .dark .crx-compact-view app-chat-list-item span.font-medium::after { color: #aaa; }
            .crx-compact-view app-chat-list-item span.justify-between { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); }

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
    function adicionarControles(container) {
        if (!document.getElementById('custom-refresh-btn')) {
            let refreshBtn = document.createElement('button');
            refreshBtn.id = 'custom-refresh-btn';
            refreshBtn.className = 'crx-control-btn';
            refreshBtn.title = 'Atualizar listas de chat (forçado)';
            refreshBtn.innerHTML = REFRESH_SVG;
            refreshBtn.onclick = () => atualizarListasDeChat();
            container.appendChild(refreshBtn);
        }

        if (!document.getElementById('crx-compact-toggle')) {
            let compactBtn = document.createElement('button');
            compactBtn.id = 'crx-compact-toggle';
            compactBtn.className = 'crx-control-btn';
            compactBtn.title = 'Alternar Visualização Compacta';
            compactBtn.innerHTML = COMPACT_VIEW_SVG;
            if (isCompactMode) compactBtn.classList.add('active');

            compactBtn.onclick = () => {
                isCompactMode = !isCompactMode;
                GM_setValue('compactMode', isCompactMode);
                compactBtn.classList.toggle('active', isCompactMode);
                document.querySelector('app-chat-list-container > section')?.classList.toggle('crx-compact-view', isCompactMode);
            };
            container.appendChild(compactBtn);
        }
    }

    // Aplica ou remove a classe mestra de modo compacto no container principal
    function aplicarVisualizacaoCompacta() {
        const container = document.querySelector('app-chat-list-container > section');
        if (container) {
            container.classList.toggle('crx-compact-view', isCompactMode);
        }
    }

    /**
     * MÉTODO DE ATUALIZAÇÃO ESTÁVEL. Navega para o dashboard e volta para a página de chat
     * para forçar um recarregamento completo dos dados, evitando o sumiço de chats.
     */
    function atualizarListasDeChat(isAutoRefresh = false) {
        const dashboardButton = document.querySelector('div[data-sidebar-option="dashboard"]');
        const sidebarChatButton = document.querySelector('div[data-sidebar-option="entities.chat"]');

        if (!dashboardButton || !sidebarChatButton) {
            if (!isAutoRefresh) console.log('B.Plus!: Botões de navegação (Dashboard/Chat) não encontrados.');
            return;
        }

        const refreshButton = document.getElementById('custom-refresh-btn');
        if (refreshButton && refreshButton.disabled) {
             console.log('B.Plus!: Atualização já em andamento.');
             return;
        }

        if (refreshButton) {
            refreshButton.disabled = true;
            refreshButton.innerHTML = SPINNER_SVG;
        }

        dashboardButton.click();
        setTimeout(() => {
            sidebarChatButton.click();
            setTimeout(() => {
                if (refreshButton) {
                    refreshButton.innerHTML = REFRESH_SVG;
                    refreshButton.disabled = false;
                }
            }, 1500); // Tempo para a UI do chat recarregar
        }, 400); // Tempo para a UI do dashboard carregar
    }

    /**
     * LÓGICA DE ATUALIZAÇÃO INTELIGENTE APRIMORADA.
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

        // Captura o estado atual dos grupos colapsados
        const currentCollapsedGroups = new Set();
        chatListContainer.querySelectorAll('.crx-group-header.collapsed').forEach(header => {
            const categoryName = header.querySelector('span:first-child').textContent.split(' [')[0];
            currentCollapsedGroups.add(categoryName);
        });
        collapsedGroups.clear(); // Limpa o Set global
        currentCollapsedGroups.forEach(group => collapsedGroups.add(group)); // Atualiza com os grupos atuais

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

        othersList.remove(); // Remove a lista original "Outros"

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
            // Ajusta a altura inicial para o modo compacto
            const initialMaxHeight = groupItems.length * (isCompactMode ? 40 : 80); // <<< VALOR ATUALIZADO AQUI
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
        aplicarVisualizacaoCompacta(); // Garante que a classe de modo compacto está aplicada

        const chatListContainer = document.querySelector('app-chat-list-container > section');
        if (chatListContainer) {
            // Se o container ainda tem a lista original do Beemore ou não foi agrupado ainda, reagrupa.
            if (!chatListContainer.getAttribute('data-crx-grouped') || chatListContainer.querySelector('app-chat-list')) {
                chatListContainer.removeAttribute('data-crx-grouped'); // Reseta para reagrupar
                agruparEOrdenarChats();
            }
        }

        if (document.querySelector('app-chat-agent-header')) {
            injetarBotaoRegistro();
            observarTags();
        }
        injetarIndicadorDeVersao();
    }

    function inicializar() {
        injetarEstilos();

        // Observer para elementos que aparecem dinamicamente
        const observer = new MutationObserver(() => {
            const targetContainer = document.querySelector('app-chat-list-container > div.flex.items-center');
            if (targetContainer) {
                adicionarControles(targetContainer);
            }
            // Aplica o modo compacto inicial aqui também, caso os elementos já estejam no DOM
            aplicarVisualizacaoCompacta();
            injetarIndicadorDeVersao();
        });
        observer.observe(document.body, { childList: true, subtree: true });

        // Inicia a lógica do auto-refresh inteligente por inatividade
        window.addEventListener('mousemove', resetIdleTimer, { passive: true });
        window.addEventListener('keypress', resetIdleTimer, { passive: true });
        window.addEventListener('click', resetIdleTimer, { passive: true });
        resetIdleTimer();

        if (mainInterval) clearInterval(mainInterval);
        mainInterval = setInterval(aplicarCustomizacoes, 1500); // Executa a cada 1.5s
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', inicializar);
    } else {
        inicializar();
    }
})();
