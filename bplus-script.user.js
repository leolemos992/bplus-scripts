// ==UserScript==
// @name         B.Plus! - Contador de Atendimentos & Melhorias Beemore
// @namespace    http://tampermonkey.net/
// @version      7.0
// @downloadURL  https://raw.githubusercontent.com/leolemos992/bplus-scripts/main/bplus-script.user.js
// @updateURL    https://raw.githubusercontent.com/leolemos992/bplus-scripts/main/bplus-script.user.js
// @description  Cabeçalhos de categoria interativos (recolher/expandir), com contador de chats e cor de fundo. Novo destaque para chats aguardando.
// @author       Jose Leonardo Lemos
// @match        https://*.beemore.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      10.1.11.15
// @connect      est015
// ==/UserScript==

(function() {
    'use strict';

    // --- CONFIGURAÇÕES GERAIS ---
    const API_URL = 'http://10.1.11.15/contador/api.php';
    const CATEGORY_COLORS = {
        'Suporte - PDV': '#E57373', 'Suporte - Retaguarda': '#64B5F6', 'Suporte - Fiscal': '#81C784',
        'Suporte - Web': '#FFD54F', 'Suporte - Mobile': '#FFB74D', 'default': '#BDBDBD'
    };
    const SPINNER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="crx-spinner"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg>`;
    const REFRESH_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>`;

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
            /* Animações e Destaques */
            @keyframes crx-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            .crx-spinner { animation: crx-spin 1s linear infinite; }
            .crx-chat-aguardando { background-color: #FFDAB9 !important; border-left: 5px solid #FFA500 !important; }
            .dark .crx-chat-aguardando { background-color: #5a4a3e !important; border-left-color: #ff8c00 !important; }

            /* Elementos da UI */
            .crx-group-header {
                display: flex; justify-content: space-between; align-items: center;
                font-size: 0.8rem; font-weight: 600; color: white; text-shadow: 1px 1px 2px rgba(0,0,0,0.4);
                padding: 6px 12px; border-radius: 4px;
                text-transform: uppercase; margin-top: 10px; cursor: pointer;
                position: sticky; top: 0; z-index: 10;
            }
            .crx-group-header .crx-chevron { transition: transform 0.2s ease-in-out; }
            .crx-group-header.collapsed .crx-chevron { transform: rotate(-90deg); }
            .crx-group-container { overflow: hidden; transition: max-height 0.3s ease-in-out; }
            .crx-group-container.collapsed { max-height: 0; }
            #crx-header-btn { background-color: #FB923C; color: white !important; border: 1px solid #F97316; padding: 0 12px; height: 32px; border-radius: 0.25rem; cursor: pointer; font-weight: 500; margin-right: 8px; display: flex; align-items: center; }
            #crx-header-btn:hover { background-color: #F97316; border-color: #EA580C; }
            #custom-refresh-btn { background-color: #ffffff; border: 1px solid #e5e7eb; color: #525252; transition: transform 0.2s; }
            #custom-refresh-btn:disabled { cursor: not-allowed; opacity: 0.7; }
            .dark #custom-refresh-btn { background-color: #37374a; border-color: #4c445c; color: #e1e1e1; }

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
        const headerElement = document.querySelector('app-chat-list-container > header');
        const chatHeaderElement = document.querySelector('app-chat-agent-header');
        const detailsContainer = document.querySelector('app-chat-aside');

        let analista = '', numero = '', solicitante = '', revenda = '', servicoSelecionado = '';

        analista = headerElement?.querySelector('span.font-medium')?.innerText.trim() || '';

        if (chatHeaderElement) {
            const titleElement = chatHeaderElement.querySelector('span > span');
            if (titleElement && titleElement.parentElement) {
                const fullTitleText = titleElement.parentElement.innerText;
                const parts = fullTitleText.split(' - ');
                if (parts.length > 1) {
                    numero = parts[0].replace('#', '').trim();
                    solicitante = parts.slice(1).join(' - ').trim();
                }
            }
        }

        if (detailsContainer) {
            const revendaElement = detailsContainer.querySelector('app-person-info h1, app-person-info [style*="font-size: 18px"]');
            if (revendaElement) {
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = revendaElement.innerHTML;
                tempDiv.querySelector('app-tag')?.remove();
                revenda = tempDiv.innerText.trim();
            }

            const labels = Array.from(detailsContainer.querySelectorAll('app-label'));
            const servicoLabel = labels.find(label => label.innerText.trim().toLowerCase() === 'serviço');
            if (servicoLabel) {
                servicoSelecionado = servicoLabel.nextElementSibling?.innerText.trim() || '';
            }
        }
        return { analista, numero, revenda, solicitante, servicoSelecionado };
    }

    // =================================================================================
    // FUNCIONALIDADE 1: REGISTRO DE SERVIÇO INCORRETO
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
    // FUNCIONALIDADE 2: MELHORIAS DE INTERFACE
    // =================================================================================
    function adicionarBotaoDeAtualizacao(container) {
        if (document.getElementById('custom-refresh-btn')) return;
        let refreshBtn = document.createElement('button');
        refreshBtn.id = 'custom-refresh-btn';
        refreshBtn.title = 'Atualizar listas de chat';
        refreshBtn.innerHTML = REFRESH_SVG;
        Object.assign(refreshBtn.style, { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '2rem', width: '2rem', marginLeft: '0.5rem', borderRadius: '0.25rem', cursor: 'pointer' });
        refreshBtn.onclick = () => atualizarListasDeChat(refreshBtn);
        container.appendChild(refreshBtn);
    }

    function atualizarListasDeChat(btn) {
        const allTabs = Array.from(document.querySelectorAll('app-tab'));
        const chatTab = allTabs.find(tab => tab.innerText.includes('Atendimento'));
        const homeButton = document.querySelector('app-home-tab');

        if (!chatTab || !homeButton) {
            console.log('B.Plus!: Abas "Atendimento" ou botão "Home" não encontrados.');
            return;
        }

        if (btn && btn.disabled) {
             console.log('B.Plus!: Atualização já em andamento.');
             return;
        }

        if (btn) {
            btn.disabled = true;
            btn.innerHTML = SPINNER_SVG;
        }

        homeButton.click();

        setTimeout(() => {
            chatTab.click();

            setTimeout(() => {
                aplicarCustomizacoes();
                if (btn) {
                    btn.innerHTML = REFRESH_SVG;
                    btn.disabled = false;
                }
            }, 1500);
        }, 300);
    }

    function aplicarDestaquesECores() {
        document.querySelectorAll('app-chat-list-item').forEach(item => {
            // Limpa classes antigas para evitar sobreposição
            item.className = item.className.replace(/\bcrx-category-\S+/g, '');
            item.classList.remove('crx-chat-highlight', 'crx-chat-aguardando');

            const hasAlert = !!item.querySelector('app-icon[icon="tablerAlertCircle"]');
            const isAguardando = !!item.querySelector('span[class*="text-orange"]');
            const categoryElement = item.querySelector('section > div:first-of-type > span:last-of-type');
            const category = categoryElement ? categoryElement.textContent.trim() : 'default';
            const categoryClass = `crx-category-${category.replace(/[\s-]+/g, '-').toLowerCase()}`;

            item.classList.add(categoryClass);
            item.classList.toggle('crx-chat-highlight', hasAlert && !isAguardando);
            item.classList.toggle('crx-chat-aguardando', isAguardando);
        });
    }

    function agruparEOrdenarChats() {
        const othersHeader = Array.from(document.querySelectorAll('app-chat-list > header')).find(h => h.querySelector('span')?.textContent.trim() === 'Outros');
        if (!othersHeader) return;
        const othersContainer = othersHeader.nextElementSibling;
        if (!othersContainer || othersContainer.getAttribute('data-crx-grouped') === 'true') return;

        const items = Array.from(othersContainer.querySelectorAll('app-chat-list-item'));
        if (items.length === 0) return;

        const groups = new Map();
        items.forEach(item => {
            const category = item.querySelector('section > div:first-of-type > span:last-of-type')?.textContent.trim() || 'Sem Categoria';
            if (!groups.has(category)) groups.set(category, []);
            groups.get(category).push(item);
        });

        const sortedGroups = new Map([...groups.entries()].sort());
        othersContainer.innerHTML = ''; // Limpa o container original

        sortedGroups.forEach((groupItems, category) => {
            const safeCategory = category.replace(/[\s-]+/g, '-').toLowerCase();

            // Cria o Cabeçalho Interativo
            const header = document.createElement('div');
            header.className = `crx-group-header crx-group-header-${safeCategory}`;
            header.innerHTML = `
                <span>${category} [${groupItems.length}]</span>
                <span class="crx-chevron">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </span>
            `;

            // Cria o Container para os itens do grupo
            const groupContainer = document.createElement('div');
            groupContainer.className = 'crx-group-container';
            const initialMaxHeight = groupItems.length * 80; // Estima a altura para a animação
            groupContainer.style.maxHeight = `${initialMaxHeight}px`;

            header.onclick = () => {
                header.classList.toggle('collapsed');
                groupContainer.classList.toggle('collapsed');
                if (groupContainer.classList.contains('collapsed')) {
                    groupContainer.style.maxHeight = '0px';
                } else {
                    groupContainer.style.maxHeight = `${initialMaxHeight}px`;
                }
            };

            othersContainer.appendChild(header);
            othersContainer.appendChild(groupContainer);

            groupItems.sort((a, b) => {
                const aP = a.classList.contains('crx-chat-highlight') ? 3 : (a.classList.contains('crx-chat-aguardando') ? 2 : 1);
                const bP = b.classList.contains('crx-chat-highlight') ? 3 : (b.classList.contains('crx-chat-aguardando') ? 2 : 1);
                return bP - aP;
            });
            groupItems.forEach(item => groupContainer.appendChild(item));
        });
        othersContainer.setAttribute('data-crx-grouped', 'true');
    }

    // =================================================================================
    // LOOP PRINCIPAL E INICIALIZAÇÃO
    // =================================================================================
    let mainInterval;

    function aplicarCustomizacoes() {
        aplicarDestaquesECores();

        const groupedContainer = document.querySelector('[data-crx-grouped="true"]');
        if(groupedContainer) groupedContainer.removeAttribute('data-crx-grouped');

        agruparEOrdenarChats();

        if (document.querySelector('app-chat-agent-header')) {
            injetarBotaoRegistro();
            observarTags();
        }
    }

    function inicializar() {
        injetarEstilos();
        const observer = new MutationObserver(() => {
            const targetContainer = document.querySelector('app-chat-list-container > div.flex.items-center');
            if (targetContainer && !document.getElementById('custom-refresh-btn')) {
                adicionarBotaoDeAtualizacao(targetContainer);
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });

        if (mainInterval) clearInterval(mainInterval);
        mainInterval = setInterval(aplicarCustomizacoes, 2000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', inicializar);
    } else {
        inicializar();
    }
})();
