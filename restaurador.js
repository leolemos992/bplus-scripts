// ==UserScript==
// @name         Beemore Restaurador de Base
// @namespace    http://tampermonkey.net/
// @version      1.9
// @description  Botão para restaurar base, com layout ajustado e botão de verificação desabilitado.
// @author       Jose Leonardo Lemos, Panca
// @match        https://*.beemore.com/*
// @updateURL    https://raw.githubusercontent.com/leolemos992/bplus-scripts/main/restaurador.js
// @downloadURL  https://raw.githubusercontent.com/leolemos992/bplus-scripts/main/restaurador.js
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @connect      *
// ==/UserScript==

(function() {
    'use strict';

    // --- CONFIGURAÇÃO ---
    const restauradorUrl = 'http://dbserver.intelidata.local/restaurador/index.php';
    const dashboardUrl = 'http://dbserver.intelidata.local/restaurador/';
    // ------------------

    // Estilos atualizados para o novo layout dos botões e popup
    GM_addStyle(`
        .restore-db-btn {
            background-color: rgb(94, 71, 208); color: white; padding: 8px 12px;
            margin-bottom: 16px; border: none; border-radius: 4px; cursor: pointer;
            font-size: 14px; font-weight: 500; width: 100%; transition: background-color 0.2s;
        }
        .restore-db-btn:hover { background-color: rgb(76, 54, 187); }
        #restoreModal {
            display: none; position: fixed; z-index: 10001; left: 0; top: 0;
            width: 100%; height: 100%; overflow: auto; background-color: rgba(0,0,0,0.6);
            justify-content: center; align-items: center;
        }
        .modal-content {
            background-color: #fefefe; margin: auto; padding: 25px; border: 1px solid #888;
            width: 90%; max-width: 480px; border-radius: 8px; box-shadow: 0 5px 15px rgba(0,0,0,0.3);
        }
        .modal-content h2 { margin-top: 0; border-bottom: 1px solid #ccc; padding-bottom: 10px; color: rgb(94, 71, 208); }
        .modal-warning {
            background-color: #fffbe6; border: 1px solid #ffeeba; color: #856404;
            padding: 15px; border-radius: 4px; margin-bottom: 20px; font-size: 14px; line-height: 1.5;
        }
        .modal-warning a { color: #0056b3; font-weight: bold; text-decoration: underline; }
        .modal-content label { display: block; margin-top: 15px; margin-bottom: 5px; font-weight: bold; }
        .modal-content input[type="text"] { width: 100%; padding: 10px; box-sizing: border-box; border: 1px solid #ccc; border-radius: 4px; font-size: 14px; }
        .modal-buttons { margin-top: 25px; display: flex; justify-content: flex-end; align-items: center; }
        .modal-buttons button { padding: 10px 15px; border-radius: 5px; border: none; cursor: pointer; margin-left: 10px; font-weight: 500; transition: background-color 0.2s; }

        /* Estilos dos botões no modal */
        #verifyDbBtn { background-color: #aeb8c2; color: white; cursor: not-allowed; } /* Cinza claro, desabilitado */
        #cancelRestoreBtn { background-color: #6c757d; color: white; } /* Cinza escuro */
        #cancelRestoreBtn:hover { background-color: #5a6268; }
        #submitRestoreBtn { background-color: rgb(94, 71, 208); color: white; } /* Roxo primário */
        #submitRestoreBtn:hover { background-color: rgb(76, 54, 187); }
    `);

    function createModal() {
        if (document.getElementById('restoreModal')) return;
        const modalHTML = `
            <div id="restoreModal">
                <div class="modal-content">
                    <h2>Restaurar Base de Dados</h2>
                    <div class="modal-warning">
                        ⚠️ <strong>Atenção:</strong> Verifique se a base já não foi restaurada.
                        <a href="${dashboardUrl}" target="_blank" rel="noopener noreferrer">Acessar dashboard</a>.
                    </div>
                    <label for="modalTenant">Tenant:</label>
                    <input type="text" id="modalTenant" name="modalTenant">
                    <label for="modalNomeBase">Nome da base:</label>
                    <input type="text" id="modalNomeBase" name="modalNomeBase">
                    <div class="modal-buttons">
                        <button id="verifyDbBtn" disabled title="Funcionalidade a ser implementada">Verificar Base</button>
                        <button id="cancelRestoreBtn">Cancelar</button>
                        <button id="submitRestoreBtn">Restaurar</button>
                    </div>
                </div>
            </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        document.getElementById('cancelRestoreBtn').addEventListener('click', hideModal);
        document.getElementById('submitRestoreBtn').addEventListener('click', submitRestoreRequest);
        document.getElementById('restoreModal').addEventListener('click', (e) => (e.target.id === 'restoreModal') && hideModal());
    }

    // --- O RESTANTE DO SCRIPT PERMANECE IGUAL ---

    function showModal() {
        document.getElementById('modalTenant').value = getTenantFromPage();
        document.getElementById('modalNomeBase').value = getTicketNumberFromPage();
        document.getElementById('restoreModal').style.display = 'flex';
    }

    function hideModal() {
        document.getElementById('restoreModal').style.display = 'none';
    }

    function getTenantFromPage() {
        for (const label of document.querySelectorAll('app-label')) {
            if (label.textContent.trim().toLowerCase() === 'tenant') {
                const input = label.nextElementSibling?.querySelector('input');
                if (input) return input.value;
            }
        }
        return '';
    }

    function getTicketNumberFromPage() {
        const titleSpan = document.querySelector('app-item-title > span');
        if (titleSpan?.textContent.includes('#')) {
            const match = titleSpan.textContent.match(/#(\d+)/);
            if (match) return match[1];
        }
        const pathMatch = window.location.pathname.match(/\/items\/edit\/([a-zA-Z0-9-]+)/);
        if (pathMatch) {
             const titleSpanOnEdit = document.querySelector('app-item-title > span');
             if (titleSpanOnEdit && titleSpanOnEdit.textContent.includes('#')) {
                 const match = titleSpanOnEdit.textContent.match(/#(\d+)/);
                 if (match) return match[1];
             }
        }
        return '';
    }

    function submitRestoreRequest() {
        const tenant = document.getElementById('modalTenant').value.trim();
        const nomeBase = document.getElementById('modalNomeBase').value.trim();

        if (!tenant || !nomeBase) {
            alert('Os campos Tenant e Nome da base são obrigatórios.');
            return;
        }
        if (restauradorUrl.includes('SEU_SERVIDOR')) {
            alert('ERRO: Configure o URL do restaurador no script.');
            return;
        }

        const url = `${restauradorUrl}?action=processar&tenant=${encodeURIComponent(tenant)}&nomeBase=${encodeURIComponent(nomeBase)}`;
        console.log(`Enviando requisição para: ${url}`);
        hideModal();

        GM_xmlhttpRequest({
            method: "GET", url: url,
            onload: res => {
                console.log("Resposta:", res.responseText);
                alert(`Processo para o tenant ${tenant} foi iniciado.`);
            },
            onerror: res => {
                console.error("Erro:", res);
                alert('Ocorreu um erro. Verifique o console.');
            }
        });
    }

    function ensureButtonExists() {
        if (!window.location.pathname.includes('/items/edit/')) return;
        if (document.getElementById('restoreDbBtn')) return;

        const targetLabel = Array.from(document.querySelectorAll('app-label'))
                                 .find(label => label.textContent.trim() === 'Técnico destaque');
        if (targetLabel) {
            const injectionPoint = targetLabel.closest('app-select');
            if (injectionPoint?.parentNode) {
                const restoreButton = document.createElement('button');
                restoreButton.id = 'restoreDbBtn';
                restoreButton.className = 'restore-db-btn';
                restoreButton.innerText = 'Restaurar Base';
                restoreButton.onclick = showModal;
                injectionPoint.parentNode.insertBefore(restoreButton, injectionPoint);
            }
        }
    }

    console.log('Beemore Restaurador: Script ativado e monitorando.');
    createModal();
    setInterval(ensureButtonExists, 750);

})();
