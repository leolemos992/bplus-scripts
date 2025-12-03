// ==UserScript==
// @name         Beemore Restaurador de Base (v2.0)
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Restaurador de base com UI nativa e memória de Tenant.
// @author       Leo, Panca
// @match        https://*.beemore.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @connect      *
// ==/UserScript==

(function () {
    'use strict';

    // --- CONFIGURAÇÃO ---
    const restauradorUrl = 'http://SEU_SERVIDOR/caminho/para/restaurador.php'; // MANTENHA SUA URL AQUI
    const dashboardUrl = 'http://dbserver.intelidata.local/restaurador/';
    const STORAGE_KEY = 'beemore_last_tenant';

    // --- ESTILOS NATIVOS (Tailwind-like) ---
    GM_addStyle(`
        .restore-btn-inject {
            background-color: #7c3aed; color: white; padding: 6px 12px;
            border-radius: 6px; font-weight: 500; font-size: 13px; cursor: pointer;
            border: none; transition: background 0.2s; margin-bottom: 8px;
            display: inline-flex; align-items: center; gap: 5px;
        }
        .restore-btn-inject:hover { background-color: #6d28d9; }
        
        /* Modal Overlay */
        #restoreModalOverlay {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.5); z-index: 9999;
            display: flex; align-items: center; justify-content: center;
            backdrop-filter: blur(2px);
        }
        
        /* Modal Content */
        .restore-modal {
            background: white; width: 400px; border-radius: 12px;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
            overflow: hidden; font-family: 'Inter', sans-serif;
        }
        .dark .restore-modal { background: #1e293b; color: #f1f5f9; border: 1px solid #334155; }

        .restore-header {
            padding: 16px 20px; border-bottom: 1px solid #e2e8f0;
            display: flex; justify-content: space-between; align-items: center;
        }
        .dark .restore-header { border-color: #334155; }
        .restore-title { font-weight: 600; font-size: 18px; color: #0f172a; }
        .dark .restore-title { color: #f8fafc; }

        .restore-body { padding: 20px; }
        
        .restore-field { margin-bottom: 16px; }
        .restore-label { display: block; font-size: 14px; font-weight: 500; margin-bottom: 6px; color: #475569; }
        .dark .restore-label { color: #94a3b8; }
        
        .restore-input {
            width: 100%; padding: 10px; border-radius: 6px; border: 1px solid #cbd5e1;
            font-size: 14px; outline: none; transition: border 0.2s;
            background: #fff; color: #0f172a; box-sizing: border-box;
        }
        .dark .restore-input { background: #0f172a; border-color: #334155; color: #f8fafc; }
        .restore-input:focus { border-color: #7c3aed; ring: 2px solid #7c3aed; }

        .restore-footer {
            padding: 16px 20px; background: #f8fafc; border-top: 1px solid #e2e8f0;
            display: flex; justify-content: flex-end; gap: 10px;
        }
        .dark .restore-footer { background: #0f172a; border-color: #334155; }

        .btn-cancel {
            padding: 8px 16px; border-radius: 6px; font-weight: 500; cursor: pointer;
            background: transparent; border: 1px solid #cbd5e1; color: #475569;
        }
        .dark .btn-cancel { border-color: #475569; color: #cbd5e1; }
        .btn-confirm {
            padding: 8px 16px; border-radius: 6px; font-weight: 500; cursor: pointer;
            background: #7c3aed; border: none; color: white;
        }
        .btn-confirm:hover { background: #6d28d9; }
    `);

    // --- LÓGICA ---

    function createModal() {
        if (document.getElementById('restoreModalOverlay')) return;

        const modalHTML = `
            <div id="restoreModalOverlay" style="display:none;">
                <div class="restore-modal">
                    <div class="restore-header">
                        <span class="restore-title">Restaurar Base</span>
                        <button id="closeRestoreModal" style="background:none;border:none;cursor:pointer;font-size:20px;color:#94a3b8;">&times;</button>
                    </div>
                    <div class="restore-body">
                        <div class="restore-field">
                            <label class="restore-label">Tenant</label>
                            <input type="text" id="restoreTenant" class="restore-input" placeholder="Ex: cliente_x">
                        </div>
                        <div class="restore-field">
                            <label class="restore-label">Nome da Base (Ticket)</label>
                            <input type="text" id="restoreBase" class="restore-input" placeholder="Ex: 12345">
                        </div>
                        <div style="font-size:12px; color:#64748b; margin-top:10px;">
                            ⚠️ Verifique se a base já não foi restaurada no <a href="${dashboardUrl}" target="_blank" style="color:#7c3aed;">Dashboard</a>.
                        </div>
                    </div>
                    <div class="restore-footer">
                        <button id="cancelRestore" class="btn-cancel">Cancelar</button>
                        <button id="confirmRestore" class="btn-confirm">Restaurar</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Eventos
        document.getElementById('closeRestoreModal').onclick = hideModal;
        document.getElementById('cancelRestore').onclick = hideModal;
        document.getElementById('restoreModalOverlay').onclick = (e) => {
            if (e.target.id === 'restoreModalOverlay') hideModal();
        };
        document.getElementById('confirmRestore').onclick = submitRestore;
    }

    function showModal() {
        const overlay = document.getElementById('restoreModalOverlay');
        if (!overlay) createModal();

        // Preencher dados
        const tenantInput = document.getElementById('restoreTenant');
        const baseInput = document.getElementById('restoreBase');

        // Tenant: Tenta pegar da tela, senão pega do storage
        const pageTenant = getTenantFromPage();
        const storedTenant = localStorage.getItem(STORAGE_KEY);
        tenantInput.value = pageTenant || storedTenant || '';

        // Base: Pega da tela
        baseInput.value = getTicketNumberFromPage();

        document.getElementById('restoreModalOverlay').style.display = 'flex';

        // Auto-focus: Se tiver tenant, foca na base. Se não, foca no tenant.
        if (tenantInput.value) {
            baseInput.focus();
        } else {
            tenantInput.focus();
        }
    }

    function hideModal() {
        document.getElementById('restoreModalOverlay').style.display = 'none';
    }

    // --- SELETORES ATUALIZADOS ---

    function getTenantFromPage() {
        // NOVO SELETOR: app-input-text > app-label contendo "Tenant"
        const labels = Array.from(document.querySelectorAll('app-input-text app-label'));
        const tenantLabel = labels.find(l => l.textContent.trim().includes('Tenant'));
        if (tenantLabel) {
            const input = tenantLabel.parentElement.querySelector('input');
            if (input) return input.value;
        }
        return '';
    }

    function getTicketNumberFromPage() {
        // Tenta pegar do título da página ou URL primeiro (mais confiável)
        const urlMatch = window.location.pathname.match(/\/items\/edit\/([a-zA-Z0-9-]+)/); // ID interno

        // NOVO SELETOR: app-item-title > span
        const titleSpan = document.querySelector('app-item-title > span');
        if (titleSpan && titleSpan.textContent.includes('#')) {
            const match = titleSpan.textContent.match(/#(\d+)/);
            if (match) return match[1];
        }

        // Fallback: Título da aba do navegador
        const docTitle = document.title;
        const titleMatch = docTitle.match(/#(\d+)/);
        if (titleMatch) return titleMatch[1];

        return '';
    }

    function submitRestore() {
        const tenant = document.getElementById('restoreTenant').value.trim();
        const nomeBase = document.getElementById('restoreBase').value.trim();

        if (!tenant || !nomeBase) {
            alert('Preencha Tenant e Nome da Base!');
            return;
        }

        // Salvar Tenant
        localStorage.setItem(STORAGE_KEY, tenant);

        if (restauradorUrl.includes('SEU_SERVIDOR')) {
            alert('ERRO: Configure a URL do script!');
            return;
        }

        const url = `${restauradorUrl}?action=processar&tenant=${encodeURIComponent(tenant)}&nomeBase=${encodeURIComponent(nomeBase)}`;

        // Feedback visual simples
        const btn = document.getElementById('confirmRestore');
        const originalText = btn.innerText;
        btn.innerText = 'Enviando...';
        btn.disabled = true;

        GM_xmlhttpRequest({
            method: "GET", url: url,
            onload: res => {
                console.log("Resposta:", res.responseText);
                alert(`Processo iniciado para ${tenant}!`);
                hideModal();
                btn.innerText = originalText;
                btn.disabled = false;
            },
            onerror: res => {
                console.error("Erro:", res);
                alert('Erro ao conectar com o servidor.');
                btn.innerText = originalText;
                btn.disabled = false;
            }
        });
    }

    function ensureButtonExists() {
        if (!window.location.pathname.includes('/items/edit/')) return;
        if (document.getElementById('restoreDbBtn')) return;

        // NOVO SELETOR: Injetar antes do app-select do "Técnico destaque"
        const labels = Array.from(document.querySelectorAll('app-select app-label'));
        const targetLabel = labels.find(l => l.textContent.trim().includes('Técnico destaque'));

        if (targetLabel) {
            const container = targetLabel.closest('app-select'); // O container pai
            if (container) {
                const btn = document.createElement('button');
                btn.id = 'restoreDbBtn';
                btn.className = 'restore-btn-inject';
                btn.innerHTML = '<span>🔄</span> Restaurar Base';
                btn.onclick = (e) => { e.preventDefault(); showModal(); };

                // Insere ANTES do select
                container.parentNode.insertBefore(btn, container);
            }
        }
    }

    // Inicialização
    createModal();
    setInterval(ensureButtonExists, 1000);
    console.log('Restaurador v2.0 carregado.');

})();
