// ==UserScript==
// @name         B.Plus! - Contador de Atendimentos & Melhorias Beemore
// @namespace    http://tampermonkey.net/
// @version      9.0
// @description  Reconstrução completa da UI da lista de chats para um design estilo Telegram, com estabilidade e performance aprimoradas.
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
    const SCRIPT_VERSION = GM_info.script.version || '9.0';
    const IDLE_REFRESH_SECONDS = 90; // Tempo em segundos para o auto-refresh
    const API_URL = 'http://10.1.11.15/contador/api.php';
    const SPINNER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="crx-spinner"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg>`;
    const USER_ICON_SVG = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"></path></svg>`;

    // --- VARIÁVEIS DE ESTADO ---
    let idleTimer; // Variável para o timer de inatividade
    let isAutoRefreshing = false; // Flag para controlar o processo de auto-refresh

    // =================================================================================
    // INJEÇÃO DE ESTILOS
    // =================================================================================
    function injetarEstilos() {
        if (document.getElementById('bplus-custom-styles')) return;
        GM_addStyle(`
            #bplus-custom-styles { display: none; }

            /* --- NOVO LAYOUT TELEGRAM v9.0 --- */

            /* Esconde a lista original da Beemore e prepara nosso container */
            app-chat-list-container > section > app-chat-list { display: none !important; }
            #crx-chat-list-container {
                padding: 0;
                height: 100%;
                overflow-y: auto;
                overflow-x: hidden;
            }

            /* Estilização da barra de rolagem para o novo container */
            #crx-chat-list-container::-webkit-scrollbar { width: 6px; }
            #crx-chat-list-container::-webkit-scrollbar-track { background: transparent; }
            #crx-chat-list-container::-webkit-scrollbar-thumb { background-color: #ccc; border-radius: 10px; }
            .dark #crx-chat-list-container::-webkit-scrollbar-thumb { background-color: #4f4f5a; }

            /* Cabeçalho de Seção (Meus Chats / Outros) */
            .crx-tg-header {
                padding: 12px 12px 4px;
                font-size: 13px;
                font-weight: 600;
                color: #6c757d;
                text-transform: uppercase;
                position: sticky;
                top: 0;
                background: #fff;
                z-index: 10;
            }
            .dark .crx-tg-header {
                background: #252535;
                color: #a0a0b0;
            }

            /* Item de Chat Individual */
            .crx-tg-item {
                display: flex;
                align-items: center;
                padding: 8px 12px;
                border-bottom: 1px solid #f0f0f0;
                cursor: pointer;
                position: relative;
                transition: background-color 0.15s ease-in-out;
            }
            .dark .crx-tg-item { border-bottom-color: #3e374e; }
            .crx-tg-item:hover { background-color: #f5f5f5; }
            .dark .crx-tg-item:hover { background-color: #3e374e; }

            /* Item de Chat Ativo (selecionado) */
            .crx-tg-item.active {
                background-color: #5e47d0 !important;
                color: white;
            }
            .dark .crx-tg-item.active { background-color: #5e47d0 !important; }
            .crx-tg-item.active .crx-tg-subtitle { color: #e1dbfb; }

            /* Avatar */
            .crx-tg-avatar {
                width: 42px; height: 42px; border-radius: 50%;
                margin-right: 12px; object-fit: cover;
                background-color: #e0e0e0; flex-shrink: 0;
            }
            .dark .crx-tg-avatar { background-color: #555; }
            .crx-tg-avatar.is-icon { padding: 8px; color: #555; }
            .dark .crx-tg-avatar.is-icon { color: #ccc; }
            .crx-tg-item.active .crx-tg-avatar.is-icon { color: white; }


            /* Conteúdo Principal (Nome e Revenda) */
            .crx-tg-content { flex-grow: 1; overflow: hidden; }
            .crx-tg-title { font-weight: 600; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .crx-tg-subtitle { font-size: 13px; color: #666; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px; }
            .dark .crx-tg-subtitle { color: #aaa; }

            /* Metadados (Notificação e Status) */
            .crx-tg-meta {
                display: flex; flex-direction: column; align-items: flex-end;
                position: absolute; right: 12px; top: 10px;
            }
            .crx-tg-badge {
                background-color: #ef4444; color: white;
                border-radius: 50%; width: 20px; height: 20px;
                display: flex; align-items: center; justify-content: center;
                font-size: 12px; font-weight: bold;
                border: 2px solid white;
            }
            .dark .crx-tg-badge { border-color: #252535; }
            .crx-tg-item.active .crx-tg-badge { border-color: #5e47d0; }

            /* Destaques de Status */
            .crx-tg-item.is-waiting { border-left: 4px solid #FFA500; padding-left: 8px; }
            .crx-tg-item.is-alert { border-left: 4px solid #E57373; padding-left: 8px; }

            /* --- ESTILOS GERAIS MANTIDOS --- */

            /* Animações */
            @keyframes crx-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            .crx-spinner { animation: crx-spin 1s linear infinite; }

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

            /* Botão "Serviço Incorreto" */
            #crx-header-btn {
                background-color: #FB923C; color: white !important; border: 1px solid #F97316; padding: 0 12px; height: 32px;
                border-radius: 0.25rem; cursor: pointer; font-weight: 500; margin-right: 8px; display: flex; align-items: center;
            }
            #crx-header-btn:hover { background-color: #F97316; border-color: #EA580C; }

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
        `);
    }

    // =================================================================================
    // CAPTURA DE DADOS (PARA MODAL)
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
    // FUNCIONALIDADE: AUTO-REFRESH E LÓGICA DE ATUALIZAÇÃO
    // =================================================================================
    function atualizarListasDeChat(isAutoRefresh = false) {
        const dashboardButton = document.querySelector('div[data-sidebar-option="dashboard"]');
        const sidebarChatButton = document.querySelector('div[data-sidebar-option="entities.chat"]');

        if (!dashboardButton || !sidebarChatButton) {
            if (!isAutoRefresh) console.log('B.Plus!: Botões de navegação (Dashboard/Chat) não encontrados.');
            return;
        }
        if (isAutoRefreshing) return;

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
            }, 1500);
        }, 400);
    }

    function performSmartRefresh() {
        if (!window.location.href.includes('/chat')) {
            resetIdleTimer();
            return;
        }

        const isChatOpen = !!document.querySelector('app-chat-agent-header');
        const isTyping = !!document.querySelector('textarea:focus, input:focus');

        if (document.hidden || isChatOpen || isTyping) {
            resetIdleTimer();
            return;
        }

        atualizarListasDeChat(true);
        resetIdleTimer();
    }

    function resetIdleTimer() {
        clearTimeout(idleTimer);
        idleTimer = setTimeout(performSmartRefresh, IDLE_REFRESH_SECONDS * 1000);
    }

    function aplicarDestaquesNosItensOriginais() {
        document.querySelectorAll('app-chat-list-item').forEach(item => {
            // Limpa classes antigas para reavaliação
            item.classList.remove('crx-is-alert', 'crx-is-waiting');

            const hasAlert = !!item.querySelector('app-icon[icon="tablerAlertCircle"]');
            const isAguardando = !!item.querySelector('span[class*="text-orange"]');

            // Adiciona classes de estado que serão lidas ao criar o novo item
            if (hasAlert && !isAguardando) {
                item.classList.add('crx-is-alert');
            }
            if (isAguardando) {
                item.classList.add('crx-is-waiting');
            }
        });
    }

    // =================================================================================
    // [NOVO v9.0] LÓGICA DE RENDERIZAÇÃO E AGRUPAMENTO ESTILO TELEGRAM
    // =================================================================================
    function agruparEOrdenarChats() {
        const originalContainer = document.querySelector('app-chat-list-container > section');
        if (!originalContainer) return;

        // 1. Encontra ou cria nosso container customizado
        let crxContainer = document.getElementById('crx-chat-list-container');
        if (!crxContainer) {
            crxContainer = document.createElement('div');
            crxContainer.id = 'crx-chat-list-container';
            originalContainer.appendChild(crxContainer);
        }

        // 2. Lê todos os chats das listas originais (que estão escondidas)
        const allOriginalLists = Array.from(originalContainer.querySelectorAll('app-chat-list'));
        const myChatsList = allOriginalLists.find(list => list.querySelector('header > div > span')?.textContent.trim() === 'Meus chats');
        const othersList = allOriginalLists.find(list => list.querySelector('header > div > span')?.textContent.trim() === 'Outros');

        const myChatsItems = myChatsList ? Array.from(myChatsList.querySelectorAll('app-chat-list-item')) : [];
        const otherChatsItems = othersList ? Array.from(othersList.querySelectorAll('app-chat-list-item')) : [];

        // 3. Limpa nosso container para redesenhar
        crxContainer.innerHTML = '';

        // 4. Função auxiliar para criar cada item na nova interface
        const createTelegramItem = (originalItem) => {
            const solicitante = originalItem.querySelector('span.font-medium')?.innerText.trim() || 'Usuário anônimo';
            const revenda = originalItem.querySelector('span.inline-flex > span.truncate')?.innerText.trim() || 'Sem revenda';
            const hasNotification = !!originalItem.querySelector('app-icon[icon="tablerAlertCircle"]');
            const isActive = originalItem.classList.contains('active');
            const isAlert = originalItem.classList.contains('crx-is-alert');
            const isWaiting = originalItem.classList.contains('crx-is-waiting');
            const avatarImg = originalItem.querySelector('app-user-picture img');

            const newItem = document.createElement('div');
            newItem.className = 'crx-tg-item';
            if (isActive) newItem.classList.add('active');
            if (isAlert) newItem.classList.add('is-alert');
            if (isWaiting) newItem.classList.add('is-waiting');

            // O clique no nosso item customizado aciona o clique no item original (escondido)
            newItem.onclick = () => originalItem.click();

            let avatarHtml = `<div class="crx-tg-avatar is-icon">${USER_ICON_SVG}</div>`;
            if (avatarImg && avatarImg.src) {
                avatarHtml = `<img src="${avatarImg.src}" class="crx-tg-avatar">`;
            }

            newItem.innerHTML = `
                ${avatarHtml}
                <div class="crx-tg-content">
                    <div class="crx-tg-title">${solicitante}</div>
                    <div class="crx-tg-subtitle">${revenda}</div>
                </div>
                ${hasNotification ? '<div class="crx-tg-meta"><div class="crx-tg-badge">!</div></div>' : ''}
            `;
            return newItem;
        };

        // 5. Renderiza a seção "Meus Chats"
        if (myChatsItems.length > 0) {
            const header = document.createElement('div');
            header.className = 'crx-tg-header';
            header.textContent = `Meus Chats (${myChatsItems.length})`;
            crxContainer.appendChild(header);

            myChatsItems
                .sort((a, b) => { // Prioriza alertas/aguardando também em "Meus Chats"
                    const aP = a.classList.contains('crx-is-alert') ? 3 : (a.classList.contains('crx-is-waiting') ? 2 : 1);
                    const bP = b.classList.contains('crx-is-alert') ? 3 : (b.classList.contains('crx-is-waiting') ? 2 : 1);
                    return bP - aP;
                })
                .forEach(item => crxContainer.appendChild(createTelegramItem(item)));
        }

        // 6. Renderiza a seção "Outros"
        if (otherChatsItems.length > 0) {
            const header = document.createElement('div');
            header.className = 'crx-tg-header';
            header.textContent = `Outros (${otherChatsItems.length})`;
            crxContainer.appendChild(header);

            otherChatsItems
                .sort((a, b) => { // Ordena por prioridade: Alerta > Aguardando > Normal
                    const aP = a.classList.contains('crx-is-alert') ? 3 : (a.classList.contains('crx-is-waiting') ? 2 : 1);
                    const bP = b.classList.contains('crx-is-alert') ? 3 : (b.classList.contains('crx-is-waiting') ? 2 : 1);
                    return bP - aP;
                })
                .forEach(item => crxContainer.appendChild(createTelegramItem(item)));
        }
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
        // Primeiro, aplica classes de estado aos itens originais para que os clones as herdem
        aplicarDestaquesNosItensOriginais();

        // Em seguida, redesenha nossa lista customizada com base nos dados e estados atualizados
        agruparEOrdenarChats();

        // Por fim, injeta elementos na interface de chat ativo, se houver uma
        if (document.querySelector('app-chat-agent-header')) {
            injetarBotaoRegistro();
            observarTags();
        }
    }

    function inicializar() {
        injetarEstilos();

        // Observador para injetar o indicador de versão assim que a barra lateral estiver pronta
        const observer = new MutationObserver(() => {
            injetarIndicadorDeVersao();
        });
        observer.observe(document.body, { childList: true, subtree: true });

        // Inicia o timer de inatividade para o auto-refresh
        window.addEventListener('mousemove', resetIdleTimer, { passive: true });
        window.addEventListener('keypress', resetIdleTimer, { passive: true });
        window.addEventListener('click', resetIdleTimer, { passive: true });
        resetIdleTimer();

        // Inicia o loop principal que mantém a interface atualizada
        if (mainInterval) clearInterval(mainInterval);
        mainInterval = setInterval(aplicarCustomizacoes, 1500);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', inicializar);
    } else {
        inicializar();
    }
})();
