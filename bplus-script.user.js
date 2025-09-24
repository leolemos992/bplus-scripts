// ==UserScript==
// @name         B.Plus! - Contador de Atendimentos & Melhorias Beemore
// @namespace    http://tampermonkey.net/
// @version      12.0.0
// @description  Versão final estável com captura universal de chats, barra de abas com rolagem horizontal e interface totalmente personalizável.
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
    const SCRIPT_VERSION = GM_info.script.version || '10.0';
    const IDLE_REFRESH_SECONDS = 90;
    const API_URL = 'http://10.1.11.15/contador/api.php';
    const SPINNER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="crx-spinner"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg>`;
    const USER_ICON_SVG = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"></path></svg>`;
    const LAYOUT_ICON_SVG = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>`;

    // --- CONFIGURAÇÕES DE UI ---
    const CATEGORY_COLORS = {
        'Suporte - Web': '#3498db',
        'Suporte - PDV': '#2ecc71',
        'Suporte - Retaguarda': '#f39c12',
        'Suporte - Fiscal': '#e74c3c',
        'Suporte - Mobile': '#9b59b6',
        'Sem Categoria': '#95a5a6'
    };

    // --- VARIÁVEIS DE ESTADO ---
    let idleTimer;
    let isAutoRefreshing = false;
    let activeFilter = 'Todos';
    let activeLayout = GM_getValue('activeLayout', 'tabs'); // 'tabs' ou 'list'

    // =================================================================================
    // FUNÇÕES AUXILIARES
    // =================================================================================
    function makeSafeForCSS(name) {
        return name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    }

    function hexToRgba(hex, alpha) {
        let r = 0, g = 0, b = 0;
        if (hex.length === 4) {
            r = "0x" + hex[1] + hex[1];
            g = "0x" + hex[2] + hex[2];
            b = "0x" + hex[3] + hex[3];
        } else if (hex.length === 7) {
            r = "0x" + hex[1] + hex[2];
            g = "0x" + hex[3] + hex[4];
            b = "0x" + hex[5] + hex[6];
        }
        return `rgba(${+r},${+g},${+b},${alpha})`;
    }

    // =================================================================================
    // INJEÇÃO DE ESTILOS
    // =================================================================================
    function injetarEstilos() {
        if (document.getElementById('bplus-custom-styles')) return;

        let dynamicStyles = '';
        for (const category in CATEGORY_COLORS) {
            const color = CATEGORY_COLORS[category];
            const safeCategory = makeSafeForCSS(category);
            dynamicStyles += `
                /* Cor da aba ativa (fundo sólido, texto branco) */
                .crx-filter-tab[data-filter="${category}"].active {
                    background-color: ${color} !important;
                    color: white !important;
                    border-bottom-color: transparent !important;
                    border-radius: 6px 6px 0 0;
                    margin-bottom: -1px;
                }
                .crx-filter-tab[data-filter="${category}"].active .count {
                    background-color: rgba(255,255,255,0.2) !important;
                    color: white !important;
                }

                /* Cor de fundo e borda dos itens da lista */
                .crx-item-bg-${safeCategory} {
                    border-left-color: ${color} !important;
                    background-color: ${hexToRgba(color, 0.08)} !important;
                }
                .dark .crx-item-bg-${safeCategory} {
                    background-color: ${hexToRgba(color, 0.15)} !important;
                }
                .crx-item-bg-${safeCategory}:not(.active):hover {
                    background-color: ${hexToRgba(color, 0.18)} !important;
                }
                .dark .crx-item-bg-${safeCategory}:not(.active):hover {
                    background-color: ${hexToRgba(color, 0.25)} !important;
                }

                /* Tag colorida para a visão 'Todos' no layout de Abas */
                .crx-category-tag-${safeCategory} {
                    background-color: ${color};
                    color: white;
                    padding: 2px 6px;
                    border-radius: 4px;
                    font-size: 11px;
                    font-weight: 500;
                    margin-right: 8px;
                    flex-shrink: 0;
                }
            `;
        }

        GM_addStyle(`
            #bplus-custom-styles { display: none; }

            /* --- CONTROLES DE LAYOUT --- */
            app-chat-list-container > section > app-chat-list,
            app-chat-list-container > section > app-queue-list { display: none !important; }
            #crx-main-container { display: flex; flex-direction: column; height: 100%; overflow: hidden; }

            /* Esconde o layout não ativo */
            .crx-layout-tabs #crx-list-layout-container { display: none; }
            .crx-layout-list #crx-tabs-layout-container { display: none; }

            .crx-controls-container {
                display: flex; justify-content: flex-end; padding: 4px 8px;
                background-color: #f8f9fa; border-bottom: 1px solid #e0e0e0;
            }
            .dark .crx-controls-container { background-color: #1e1e2d; border-bottom-color: #3e374e; }
            #crx-layout-toggle {
                background: none; border: none; cursor: pointer; color: #555; padding: 4px;
                border-radius: 4px; transition: background-color 0.2s, color 0.2s;
            }
            #crx-layout-toggle:hover { background-color: #e0e0e0; color: #000; }
            .dark #crx-layout-toggle { color: #aaa; }
            .dark #crx-layout-toggle:hover { background-color: #3e374e; color: #fff; }

            /* --- LAYOUT DE ABAS --- */
            #crx-tabs-layout-container { display: flex; flex-direction: column; height: 100%; }
            .crx-filter-tabs {
                display: flex; flex-shrink: 0; overflow-x: auto; padding: 0 8px;
                background-color: #fff; scrollbar-width: thin; scrollbar-color: #ccc #f0f0f0;
                border-bottom: 1px solid #e0e0e0;
            }
            .dark .crx-filter-tabs { background-color: #252535; scrollbar-color: #555 #3e374e; border-bottom-color: #3e374e; }
            .crx-filter-tabs::-webkit-scrollbar { height: 5px; }
            .crx-filter-tabs::-webkit-scrollbar-track { background: #f0f0f0; }
            .dark .crx-filter-tabs::-webkit-scrollbar-track { background: #3e374e; }
            .crx-filter-tabs::-webkit-scrollbar-thumb { background-color: #ccc; border-radius: 10px; }
            .dark .crx-filter-tabs::-webkit-scrollbar-thumb { background-color: #555; }
            .crx-filter-tab {
                padding: 10px 8px; margin: 0 8px; font-size: 13px; font-weight: 500;
                color: #666; cursor: pointer; border-bottom: 3px solid transparent;
                white-space: nowrap; transition: all 0.2s;
            }
            .dark .crx-filter-tab { color: #aaa; }
            .crx-filter-tab .count {
                background-color: #f0f0f0; color: #555; border-radius: 10px;
                padding: 1px 6px; font-size: 11px; margin-left: 6px;
            }
            .dark .crx-filter-tab .count { background-color: #3e374e; color: #ccc; }
            .crx-filter-tab.active { font-weight: 600; }

            /* --- CONTAINER COMUM DA LISTA DE CHATS --- */
            .crx-chat-list-container { flex-grow: 1; overflow-y: auto; }
            .crx-chat-list-container::-webkit-scrollbar { width: 6px; }
            .crx-chat-list-container::-webkit-scrollbar-track { background: transparent; }
            .crx-chat-list-container::-webkit-scrollbar-thumb { background-color: #ccc; border-radius: 10px; }
            .dark .crx-chat-list-container::-webkit-scrollbar-thumb { background-color: #4f4f5a; }

            /* Cabeçalhos de Grupo (Usado em ambos layouts) */
            .crx-group-header {
                padding: 12px 12px 4px; font-size: 13px; font-weight: 600; color: #6c757d;
                text-transform: uppercase; position: sticky; top: 0; background: #fff; z-index: 10;
                border-bottom: 1px solid #e0e0e0;
            }
            .dark .crx-group-header { background: #252535; color: #a0a0b0; border-bottom-color: #3e374e; }

            /* Item de Chat Individual (Estilo unificado) */
            .crx-tg-item {
                display: flex; align-items: center; padding: 8px 12px;
                border-bottom: 1px solid #f0f0f0; cursor: pointer; position: relative;
                transition: background-color 0.15s ease-in-out;
                border-left: 5px solid transparent;
            }
            .dark .crx-tg-item { border-bottom-color: #3e374e; }
            .crx-tg-item.active { background-color: #5e47d0 !important; color: white; border-left-color: #5e47d0 !important; }
            .crx-tg-item.active .crx-tg-subtitle { color: #e1dbfb; }
            .crx-tg-avatar {
                width: 42px; height: 42px; border-radius: 50%; margin-right: 12px;
                object-fit: cover; background-color: #e0e0e0; flex-shrink: 0;
            }
            .dark .crx-tg-avatar { background-color: #555; }
            .crx-tg-avatar.is-icon { padding: 8px; color: #555; }
            .dark .crx-tg-avatar.is-icon { color: #ccc; }
            .crx-tg-item.active .crx-tg-avatar.is-icon { color: white; }
            .crx-tg-content { flex-grow: 1; overflow: hidden; }
            .crx-tg-title { font-weight: 600; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .crx-tg-subtitle { font-size: 13px; color: #666; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px; display: flex; align-items: center; }
            .dark .crx-tg-subtitle { color: #aaa; }
            .crx-tg-meta { position: absolute; right: 12px; top: 12px; }
            .crx-tg-badge {
                background-color: #FFA500; width: 12px; height: 12px; border-radius: 50%;
                border: 2px solid white;
            }
            .dark .crx-tg-badge { border-color: #252535; }
            .crx-tg-item.active .crx-tg-badge { border-color: #5e47d0; }
            .crx-tg-item.is-waiting { border-left-color: #FFA500 !important; }
            .crx-tg-item.is-alert { border-left-color: #E57373 !important; }

            /* --- ESTILOS GERAIS (MODAL, BOTÕES, ETC) --- */
            @keyframes crx-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            .crx-spinner { animation: crx-spin 1s linear infinite; }
            #crx-version-indicator-sidebar { position: relative; cursor: help; width: 36px; height: 36px; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: #e1dbfb; background-color: transparent; transition: background-color 0.15s ease-in-out; margin-bottom: 6px; }
            #crx-version-indicator-sidebar:hover { background-color: #5e47d0; }
            #crx-version-indicator-sidebar .crx-tooltip { visibility: hidden; width: 160px; background-color: #333; color: #fff; text-align: center; border-radius: 6px; padding: 8px; position: absolute; z-index: 100; left: 125%; top: 50%; transform: translateY(-50%); opacity: 0; transition: opacity 0.3s; line-height: 1.4; }
            #crx-version-indicator-sidebar:hover .crx-tooltip { visibility: visible; opacity: 1; }
            #crx-header-btn { background-color: #FB923C; color: white !important; border: 1px solid #F97316; padding: 0 12px; height: 32px; border-radius: 0.25rem; cursor: pointer; font-weight: 500; margin-right: 8px; display: flex; align-items: center; }
            #crx-header-btn:hover { background-color: #F97316; border-color: #EA580C; }
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

            ${dynamicStyles}
        `);
    }

    // =================================================================================
    // CAPTURA DE DADOS E REGISTRO DE SERVIÇO
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
        const activeChatElement = document.querySelector('.crx-tg-item.active'); // Usa o item ativo da nossa lista
        if (activeChatElement) {
            solicitante = activeChatElement.querySelector('.crx-tg-title')?.innerText.trim() || '';
            revenda = activeChatElement.querySelector('.crx-tg-subtitle > span:last-child')?.innerText.trim() || '';
        }
         // Busca o serviço no item original ativo para garantir precisão
        const originalActiveItem = document.querySelector('app-chat-list-item.active, app-queue-item.active');
        if(originalActiveItem) {
             servicoSelecionado = originalActiveItem.querySelector('span.shrink-0')?.innerText.trim() || '';
        }
        return { analista, numero, revenda, solicitante, servicoSelecionado };
    }

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
    // AUTO-REFRESH E LÓGICA DE ATUALIZAÇÃO
    // =================================================================================
    function atualizarListasDeChat(isAutoRefresh = false) {
        const dashboardButton = document.querySelector('div[data-sidebar-option="dashboard"]');
        const sidebarChatButton = document.querySelector('div[data-sidebar-option="entities.chat"]');
        if (!dashboardButton || !sidebarChatButton) {
            if (!isAutoRefresh) console.log('B.Plus!: Botões de navegação não encontrados.');
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
        document.querySelectorAll('app-chat-list-item, app-queue-item').forEach(item => {
            item.classList.remove('crx-is-alert', 'crx-is-waiting');
            const hasAlert = !!item.querySelector('app-icon[icon="tablerAlertCircle"], span[class*="text-red"]');
            const isAguardando = !!item.querySelector('span[class*="text-orange"]');
            if (hasAlert && !isAguardando) {
                item.classList.add('crx-is-alert');
            }
            if (isAguardando) {
                item.classList.add('crx-is-waiting');
            }
        });
    }

    // =================================================================================
    // LÓGICA DE RENDERIZAÇÃO
    // =================================================================================
    function createTelegramItemHtml(chatData, useCategoryTag = false) {
        const safeCategory = makeSafeForCSS(chatData.categoria);
        const classList = ['crx-tg-item', `crx-item-bg-${safeCategory}`];
        if (chatData.isActive) classList.push('active');
        if (chatData.isAlert) classList.push('is-alert');
        if (chatData.isWaiting) classList.push('is-waiting');

        let avatarHtml = `<div class="crx-tg-avatar is-icon">${USER_ICON_SVG}</div>`;
        if (chatData.avatarImgSrc) {
            avatarHtml = `<img src="${chatData.avatarImgSrc}" class="crx-tg-avatar">`;
        }

        const badgeHtml = chatData.hasNotification ? `<div class="crx-tg-meta"><div class="crx-tg-badge"></div></div>` : '';

        let subTitleContent = `<span>${chatData.revenda}</span>`;
        if (useCategoryTag) {
            const categoryTag = `<span class="crx-category-tag crx-category-tag-${safeCategory}">${chatData.categoria.replace('Suporte - ', '')}</span>`;
            subTitleContent = `${categoryTag}${subTitleContent}`;
        }

        return `
            <div class="${classList.join(' ')}" data-item-id="${chatData.id}">
                ${avatarHtml}
                <div class="crx-tg-content">
                    <div class="crx-tg-title">${chatData.solicitante}</div>
                    <div class="crx-tg-subtitle">${subTitleContent}</div>
                </div>
                ${badgeHtml}
            </div>`;
    }

    function renderTabsLayout(container, myChats, otherChats) {
        const layoutContainer = document.createElement('div');
        layoutContainer.id = 'crx-tabs-layout-container';

        const allChats = [...myChats, ...otherChats];

        const categoryCounts = new Map();
        allChats.forEach(chat => {
            categoryCounts.set(chat.categoria, (categoryCounts.get(chat.categoria) || 0) + 1);
        });

        let tabsHtml = `<div class="crx-filter-tab ${activeFilter === 'Todos' ? 'active' : ''}" data-filter="Todos">Todos <span class="count">${allChats.length}</span></div>`;
        for (const [category, count] of [...categoryCounts.entries()].sort()) {
            tabsHtml += `<div class="crx-filter-tab ${activeFilter === category ? 'active' : ''}" data-filter="${category}">${category.replace('Suporte - ','')} <span class="count">${count}</span></div>`;
        }
        const tabsContainer = document.createElement('div');
        tabsContainer.className = 'crx-filter-tabs';
        tabsContainer.innerHTML = tabsHtml;
        layoutContainer.appendChild(tabsContainer);

        const chatListContainer = document.createElement('div');
        chatListContainer.className = 'crx-chat-list-container';
        let chatsHtml = '';

        const filteredMyChats = myChats.filter(chat => activeFilter === 'Todos' || chat.categoria === activeFilter);
        if (filteredMyChats.length > 0) {
            chatsHtml += `<div class="crx-group-header">Meus Chats (${filteredMyChats.length})</div>`;
            filteredMyChats.sort((a, b) => (b.isAlert ? 2 : b.isWaiting ? 1 : 0) - (a.isAlert ? 2 : a.isWaiting ? 1 : 0))
                   .forEach(chatData => {
                        chatsHtml += createTelegramItemHtml(chatData, activeFilter === 'Todos');
                   });
        }

        const filteredOtherChats = otherChats.filter(chat => activeFilter === 'Todos' || chat.categoria === activeFilter);

        if (activeFilter === 'Todos') {
            const groupedChats = filteredOtherChats.reduce((acc, chat) => {
                (acc[chat.categoria] = acc[chat.categoria] || []).push(chat);
                return acc;
            }, {});

            Object.keys(groupedChats).sort().forEach(category => {
                const group = groupedChats[category];
                chatsHtml += `<div class="crx-group-header">${category} (${group.length})</div>`;
                group.sort((a, b) => (b.isAlert ? 2 : b.isWaiting ? 1 : 0) - (a.isAlert ? 2 : a.isWaiting ? 1 : 0))
                     .forEach(chatData => {
                         chatsHtml += createTelegramItemHtml(chatData, false);
                     });
            });
        } else {
            if (filteredOtherChats.length > 0) {
                 chatsHtml += `<div class="crx-group-header">${activeFilter} (${filteredOtherChats.length})</div>`;
            }
            filteredOtherChats.sort((a, b) => (b.isAlert ? 2 : b.isWaiting ? 1 : 0) - (a.isAlert ? 2 : a.isWaiting ? 1 : 0))
                         .forEach(chatData => {
                             chatsHtml += createTelegramItemHtml(chatData, false);
                         });
        }

        chatListContainer.innerHTML = chatsHtml;
        layoutContainer.appendChild(chatListContainer);
        container.appendChild(layoutContainer);

        container.querySelectorAll('.crx-filter-tab').forEach(tab => {
            tab.onclick = () => {
                activeFilter = tab.getAttribute('data-filter');
                renderCustomChatList();
            };
        });
    }

    function renderListLayout(container, myChats, otherChats) {
        const layoutContainer = document.createElement('div');
        layoutContainer.id = 'crx-list-layout-container';
        layoutContainer.className = 'crx-chat-list-container';
        let chatsHtml = '';

        if (myChats.length > 0) {
            chatsHtml += `<div class="crx-group-header">Meus Chats (${myChats.length})</div>`;
            myChats.sort((a, b) => (b.isAlert ? 2 : b.isWaiting ? 1 : 0) - (a.isAlert ? 2 : a.isWaiting ? 1 : 0))
                   .forEach(chatData => { chatsHtml += createTelegramItemHtml(chatData, false); });
        }

        const groupedChats = otherChats.reduce((acc, chat) => {
            (acc[chat.categoria] = acc[chat.categoria] || []).push(chat);
            return acc;
        }, {});

        Object.keys(groupedChats).sort().forEach(category => {
            const group = groupedChats[category];
            chatsHtml += `<div class="crx-group-header">${category} (${group.length})</div>`;
            group.sort((a, b) => (b.isAlert ? 2 : b.isWaiting ? 1 : 0) - (a.isAlert ? 2 : a.isWaiting ? 1 : 0))
                 .forEach(chatData => { chatsHtml += createTelegramItemHtml(chatData, false); });
        });

        layoutContainer.innerHTML = chatsHtml;
        container.appendChild(layoutContainer);
    }

    function addControls(container) {
        const controlsContainer = document.createElement('div');
        controlsContainer.className = 'crx-controls-container';
        const layoutBtn = document.createElement('button');
        layoutBtn.id = 'crx-layout-toggle';
        layoutBtn.title = 'Alternar Layout (Abas/Lista)';
        layoutBtn.innerHTML = LAYOUT_ICON_SVG;
        layoutBtn.onclick = () => {
            activeLayout = (activeLayout === 'tabs') ? 'list' : 'tabs';
            GM_setValue('activeLayout', activeLayout);
            renderCustomChatList();
        };
        controlsContainer.appendChild(layoutBtn);
        container.appendChild(controlsContainer);
    }

    // =================================================================================
    // FUNÇÃO PRINCIPAL DE RENDERIZAÇÃO
    // =================================================================================
    function renderCustomChatList() {
        const originalContainer = document.querySelector('app-chat-list-container > section');
        if (!originalContainer) return;

        let crxMainContainer = document.getElementById('crx-main-container');
        if (!crxMainContainer) {
            crxMainContainer = document.createElement('div');
            crxMainContainer.id = 'crx-main-container';
            originalContainer.appendChild(crxMainContainer);
        }

        // **NOVA CAPTURA UNIVERSAL DE DADOS**
        const allChatItems = Array.from(originalContainer.querySelectorAll('app-chat-list-item, app-queue-item'));

        const allChatsData = allChatItems.map((item, index) => {
            const isMyChat = item.closest('app-chat-list')?.querySelector('header span')?.textContent.trim() === 'Meus chats';

            // Lógica unificada para extrair dados
            const spans = Array.from(item.querySelectorAll('span.truncate'));
            const solicitante = spans[0]?.innerText.trim() || 'Usuário anônimo';
            const revenda = spans[1]?.innerText.trim() || 'Sem revenda';
            const categoria = item.querySelector('span.shrink-0')?.innerText.trim() || 'Sem Categoria';

            return {
                id: `crx-item-${index}`, // Mantido para o clique funcionar
                solicitante,
                revenda,
                categoria,
                hasNotification: !!item.querySelector('app-icon[icon="tablerAlertCircle"], span[class*="text-red"], span[class*="text-orange"]'),
                isWaiting: item.classList.contains('crx-is-waiting'), // Mantido para destaque visual
                isAlert: item.classList.contains('crx-is-alert'),   // Mantido para destaque visual
                isActive: item.classList.contains('active'),
                avatarImgSrc: item.querySelector('app-user-picture img')?.src,
                isMyChat: isMyChat,
                originalElement: item
            };
        });

        const myChatsData = allChatsData.filter(chat => chat.isMyChat);
        const otherChatsData = allChatsData.filter(chat => !chat.isMyChat);

        crxMainContainer.innerHTML = '';
        crxMainContainer.className = 'crx-layout-' + activeLayout;

        addControls(crxMainContainer);

        if (activeLayout === 'tabs') {
            renderTabsLayout(crxMainContainer, myChatsData, otherChatsData);
        } else {
            renderListLayout(crxMainContainer, myChatsData, otherChatsData);
        }

        crxMainContainer.querySelectorAll('.crx-tg-item').forEach(item => {
            const itemId = item.getAttribute('data-item-id');
            const correspondingChatData = allChatsData.find(d => d.id === itemId);
            if (correspondingChatData && correspondingChatData.originalElement) {
                item.onclick = () => correspondingChatData.originalElement.click();
            }
        });
    }

    // =================================================================================
    // INICIALIZAÇÃO E LOOP PRINCIPAL
    // =================================================================================
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

    let mainInterval;
    function aplicarCustomizacoes() {
        aplicarDestaquesNosItensOriginais();
        renderCustomChatList();
        if (document.querySelector('app-chat-agent-header')) {
            injetarBotaoRegistro();
            observarTags();
        }
    }

    function inicializar() {
        injetarEstilos();
        const observer = new MutationObserver((mutations) => {
            injetarIndicadorDeVersao();
            // Otimização: verifica se a lista de chats mudou antes de redesenhar
            for (const mutation of mutations) {
                if (mutation.target.matches('app-chat-list-container, app-chat-list-container *')) {
                    aplicarCustomizacoes();
                    break;
                }
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });


        window.addEventListener('mousemove', resetIdleTimer, { passive: true });
        window.addEventListener('keypress', resetIdleTimer, { passive: true });
        window.addEventListener('click', resetIdleTimer, { passive: true });
        resetIdleTimer();

        // O intervalo pode ser removido se o MutationObserver for confiável o suficiente
        // if (mainInterval) clearInterval(mainInterval);
        // mainInterval = setInterval(aplicarCustomizacoes, 1500);
        aplicarCustomizacoes(); // Execução inicial
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', inicializar);
    } else {
        inicializar();
    }
})();
