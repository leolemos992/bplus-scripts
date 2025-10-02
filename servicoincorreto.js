// ==UserScript==
// @name         Beemore - Botão Serviço Incorreto
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Adiciona o botão 'Serviço Incorreto' para registrar atendimentos categorizados erradamente.
// @author       Jose Leonardo Lemos
// @match        https://*.beemore.com/*
// @updateURL    https://raw.githubusercontent.com/leolemos992/bplus-scripts/main/servicoincorreto.js
// @downloadURL  https://raw.githubusercontent.com/leolemos992/bplus-scripts/main/servicoincorreto.js
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @connect      10.1.11.15
// @connect      est015
// ==/UserScript==

(function() {
    'use strict';

    // --- CONFIGURAÇÕES ---
    const API_URL = 'http://10.1.11.15/contador/api.php';

    // =================================================================================
    // INJEÇÃO DE ESTILOS (Apenas para o botão e modal)
    // =================================================================================
    function injetarEstilos() {
        if (document.getElementById('servico-incorreto-styles')) return;
        GM_addStyle(`
            #crx-header-btn {
                background-color: #FB923C; color: white !important; border: 1px solid #F97316;
                padding: 0 12px; height: 32px; border-radius: 0.25rem; cursor: pointer;
                font-weight: 500; margin-right: 8px; display: flex; align-items: center;
            }
            #crx-header-btn:hover { background-color: #F97316; border-color: #EA580C; }
            .crx-modal-overlay {
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background-color: rgba(0, 0, 0, 0.6); z-index: 9998; display: flex;
                justify-content: center; align-items: center;
            }
            .crx-modal-content {
                background-color: white; padding: 25px; border-radius: 8px; width: 350px;
                box-shadow: 0 5px 15px rgba(0,0,0,0.3); z-index: 9999;
            }
            .dark .crx-modal-content { background-color: #2c2c3d; color: #e1e1e1; }
            .crx-modal-content h3 { margin: 0 0 20px 0; color: #333; }
            .dark .crx-modal-content h3 { color: #e1e1e1; }
            .crx-form-group label { display: block; margin-bottom: 5px; font-weight: 500; color: #333; }
            .dark .crx-form-group label { color: #e1e1e1; }
            .crx-form-group input, .crx-form-group select {
                width: 100%; padding: 8px; box-sizing: border-box; border: 1px solid #ccc;
                border-radius: 4px; background-color: #fff !important; color: #000 !important;
            }
            .dark .crx-form-group input, .dark .crx-form-group select {
                background-color: #3e374e !important; color: #e1e1e1 !important; border-color: #4c445c !important;
            }
            .crx-btn {
                width: 100%; padding: 10px; background-color: #2c6fbb; color: white;
                border: none; border-radius: 4px; cursor: pointer; font-size: 16px;
            }
            #crx-status { margin-top: 15px; font-weight: bold; text-align: center; }
        `);
    }

    // =================================================================================
    // LÓGICA DO SCRIPT
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
            const revendaElement = detailsContainer.querySelector('app-person-info .text-18.font-medium');
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

    function injetarBotaoRegistro() {
        if (document.getElementById('crx-header-btn') || !document.querySelector('app-chat-agent-header')) return;

        const actionButtonsContainer = document.querySelector('app-chat-agent-header > div:last-of-type');
        if (!actionButtonsContainer) return;

        const referenceButton = actionButtonsContainer.querySelector('app-button[icon="tablerMessages"]');
        if (referenceButton) {
            const ourButton = document.createElement('button');
            ourButton.id = 'crx-header-btn';
            ourButton.textContent = 'Serviço Incorreto';
            ourButton.addEventListener('click', abrirModalRegistro);
            referenceButton.parentElement.insertBefore(ourButton, referenceButton);
        }
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
        document.getElementById('crx-servico-selecionado').value = data.servicoSelecionado;
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
            action: 'create',
            numero: document.getElementById('crx-numero').value,
            revenda: document.getElementById('crx-revenda').value,
            solicitante: document.getElementById('crx-solicitante').value,
            servicoSelecionado: document.getElementById('crx-servico-selecionado').value,
            servicoCorreto: document.getElementById('crx-servico-correto').value,
            data: new Date().toISOString().split('T')[0],
            analista: document.getElementById('crx-analista').value
        };
        statusDiv.textContent = 'Salvando...';
        GM_xmlhttpRequest({
            method: 'POST', url: API_URL, headers: { 'Content-Type': 'application/json' },
            data: JSON.stringify(atendimentoData),
            onload: function(response) {
                try {
                    const result = JSON.parse(response.responseText);
                    statusDiv.textContent = result.success || `Falha: ${result.error || 'Erro desconhecido'}`;
                    statusDiv.style.color = result.success ? 'green' : 'red';
                    if (result.success) setTimeout(fecharModalRegistro, 1500);
                } catch (err) {
                    statusDiv.textContent = 'Erro ao processar resposta da API.';
                    statusDiv.style.color = 'red';
                }
            },
            onerror: function() {
                statusDiv.textContent = 'Falha de conexão com a API.';
                statusDiv.style.color = 'red';
            }
        });
    }

    // =================================================================================
    // INICIALIZAÇÃO
    // =================================================================================
    function inicializar() {
        injetarEstilos();
        // Observa a página por mudanças para injetar o botão assim que o chat for carregado
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.addedNodes.length) {
                    injetarBotaoRegistro();
                }
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    inicializar();
})();
