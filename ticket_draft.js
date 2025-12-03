// ==UserScript==
// @name         Ticket Draft Persistence (Manual)
// @namespace    http://tampermonkey.net/
// @version      2.3
// @description  Adiciona botões para Salvar, Carregar e Limpar rascunho do ticket manualmente
// @author       Jose Leonardo Lemos
// @match        https://app.beemore.com/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const STORAGE_PREFIX = 'ticket_draft_';

    // =================================================================================
    // 1. UTILITÁRIOS
    // =================================================================================

    function getChatId() {
        const header = document.querySelector('app-chat-agent-header');
        if (!header) return null;
        const text = header.innerText.trim();
        const match = text.match(/#\d+/);
        if (match) return match[0];
        return text.substring(0, 50).replace(/\s+/g, '_');
    }

    function getTicketSidebar() {
        const buttons = document.querySelectorAll('button, app-button');
        for (const btn of buttons) {
            if (btn.innerText.trim() === 'Salvar') {
                return btn.closest('app-chat-aside') || btn.closest('app-menu-aside') || btn.closest('section');
            }
        }
        return null;
    }

    function getScrollableContainer() {
        const sidebar = getTicketSidebar();
        if (!sidebar) return null;
        return sidebar.querySelector('section[scrollable="true"]') ||
            sidebar.querySelector('div[scrollable="true"]') ||
            sidebar.querySelector('.overflow-y-auto');
    }

    function isTicketView(sidebar) {
        if (!sidebar) return false;
        // Verifica se existe um cabeçalho com o texto "Ticket"
        // Baseado nas imagens, o título "Ticket" aparece no topo.
        // O título "Detalhes" aparece na outra aba.

        // Procura por elementos de texto no topo da sidebar
        const elements = sidebar.querySelectorAll('*');
        for (let i = 0; i < Math.min(elements.length, 50); i++) { // Olha apenas os primeiros elementos
            const el = elements[i];
            // Verifica se é um elemento visível e tem texto exato "Ticket"
            if (el.innerText && el.innerText.trim() === 'Ticket' && el.tagName !== 'BUTTON' && el.tagName !== 'SCRIPT') {
                // Verifica se não é um botão de menu lateral (que fica fora da sidebar geralmente, mas por garantia)
                return true;
            }
        }
        return false;
    }

    function getFieldKey(element, index) {
        if (element.id) return element.id;
        if (element.name) return element.name;

        let label = null;
        const parentComponent = element.closest('app-input-text, app-select, app-textarea, app-chat-edit');
        if (parentComponent) {
            const labelEl = parentComponent.querySelector('app-label') || parentComponent.querySelector('label');
            if (labelEl) label = labelEl.innerText.trim();
        }

        if (!label && element.placeholder && element.placeholder.length > 3) {
            label = element.placeholder;
        }

        if (!label && element.previousElementSibling) {
            label = element.previousElementSibling.innerText.trim();
        }

        if (label) return label.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
        return `field_${index}`;
    }

    // =================================================================================
    // 2. LÓGICA DE PERSISTÊNCIA
    // =================================================================================

    function saveDraft() {
        const chatId = getChatId();
        if (!chatId) {
            alert('Erro: Não foi possível identificar o chat atual.');
            return;
        }

        const sidebar = getTicketSidebar();
        if (!sidebar) {
            alert('Erro: Barra lateral do ticket não encontrada.');
            return;
        }

        const draft = {};
        const inputs = Array.from(sidebar.querySelectorAll('input, select, textarea, div[contenteditable="true"]'));

        inputs.forEach((input, index) => {
            if (input.type === 'hidden') return;
            const key = getFieldKey(input, index);

            if (input.getAttribute('contenteditable') === 'true') {
                draft[key] = input.innerHTML;
            } else if (input.type === 'checkbox' || input.type === 'radio') {
                draft[key] = input.checked;
            } else {
                draft[key] = input.value;
            }
        });

        localStorage.setItem(STORAGE_PREFIX + chatId, JSON.stringify(draft));

        const btn = document.getElementById('btn-save-draft');
        if (btn) {
            const originalText = btn.innerText;
            btn.innerText = 'Salvo! ✅';
            setTimeout(() => btn.innerText = originalText, 2000);
        }

        checkDraftExists();
    }

    function restoreDraft() {
        const chatId = getChatId();
        if (!chatId) return;

        const saved = localStorage.getItem(STORAGE_PREFIX + chatId);
        if (!saved) {
            alert('Nenhum rascunho encontrado para este chat.');
            return;
        }

        const draft = JSON.parse(saved);
        const sidebar = getTicketSidebar();
        if (!sidebar) return;

        const inputs = Array.from(sidebar.querySelectorAll('input, select, textarea, div[contenteditable="true"]'));

        inputs.forEach((input, index) => {
            if (input.type === 'hidden') return;

            const key = getFieldKey(input, index);
            if (draft[key] !== undefined) {
                if (input.getAttribute('contenteditable') === 'true') {
                    if (input.innerHTML !== draft[key]) {
                        input.innerHTML = draft[key];
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                } else if (input.type === 'checkbox' || input.type === 'radio') {
                    input.checked = draft[key];
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                } else {
                    input.value = draft[key];
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
        });

        const btn = document.getElementById('btn-load-draft');
        if (btn) {
            const originalText = btn.innerText;
            btn.innerText = 'Carregado! 📂';
            setTimeout(() => btn.innerText = originalText, 2000);
        }
    }

    function clearDraft() {
        const chatId = getChatId();
        if (chatId) {
            localStorage.removeItem(STORAGE_PREFIX + chatId);

            const btn = document.getElementById('btn-clear-draft');
            if (btn) {
                const originalText = btn.innerText;
                btn.innerText = 'Limpo! 🗑️';
                setTimeout(() => btn.innerText = originalText, 2000);
            }

            checkDraftExists();
        }
    }

    function checkDraftExists() {
        const chatId = getChatId();
        const btnLoad = document.getElementById('btn-load-draft');
        const btnClear = document.getElementById('btn-clear-draft');

        if (!btnLoad || !btnClear) return;

        if (chatId && localStorage.getItem(STORAGE_PREFIX + chatId)) {
            btnLoad.style.display = 'block';
            btnClear.style.display = 'block';
        } else {
            btnLoad.style.display = 'none';
            btnClear.style.display = 'none';
        }
    }

    // =================================================================================
    // 3. UI - BOTÕES
    // =================================================================================

    function manageButtons() {
        const sidebar = getTicketSidebar();
        if (!sidebar) return;

        const container = document.getElementById('draft-buttons-container');

        // Se NÃO estiver na aba Ticket, remove os botões se existirem
        if (!isTicketView(sidebar)) {
            if (container) {
                container.remove();
            }
            return;
        }

        // Se estiver na aba Ticket e os botões não existirem, cria
        if (!container) {
            injectButtons(sidebar);
        } else {
            // Se já existem, apenas atualiza estado (ex: visibilidade do carregar)
            checkDraftExists();
        }
    }

    function injectButtons(sidebar) {
        const scrollable = getScrollableContainer();
        if (!scrollable) return;

        const container = document.createElement('div');
        container.id = 'draft-buttons-container';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.gap = '8px';
        container.style.marginTop = '20px';
        container.style.marginBottom = '20px';
        container.style.padding = '0 10px';

        const btnStyle = `
            width: 100%;
            padding: 8px;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 500;
            text-align: center;
            border: 1px solid transparent;
            transition: all 0.2s;
        `;

        const btnSave = document.createElement('button');
        btnSave.id = 'btn-save-draft';
        btnSave.innerText = '💾 Salvar Rascunho';
        btnSave.style.cssText = btnStyle + `
            background-color: #f3f4f6;
            color: #374151;
            border-color: #d1d5db;
        `;
        btnSave.onmouseover = () => btnSave.style.backgroundColor = '#e5e7eb';
        btnSave.onmouseout = () => btnSave.style.backgroundColor = '#f3f4f6';
        btnSave.onclick = (e) => { e.preventDefault(); saveDraft(); };

        const btnLoad = document.createElement('button');
        btnLoad.id = 'btn-load-draft';
        btnLoad.innerText = '📂 Carregar Rascunho';
        btnLoad.style.cssText = btnStyle + `
            background-color: #dbeafe;
            color: #1e40af;
            border-color: #93c5fd;
            display: none;
        `;
        btnLoad.onmouseover = () => btnLoad.style.backgroundColor = '#bfdbfe';
        btnLoad.onmouseout = () => btnLoad.style.backgroundColor = '#dbeafe';
        btnLoad.onclick = (e) => { e.preventDefault(); restoreDraft(); };

        const btnClear = document.createElement('button');
        btnClear.id = 'btn-clear-draft';
        btnClear.innerText = '🗑️ Limpar Rascunho';
        btnClear.style.cssText = btnStyle + `
            background-color: #fee2e2;
            color: #991b1b;
            border-color: #fca5a5;
            display: none;
        `;
        btnClear.onmouseover = () => btnClear.style.backgroundColor = '#fecaca';
        btnClear.onmouseout = () => btnClear.style.backgroundColor = '#fee2e2';
        btnClear.onclick = (e) => { e.preventDefault(); clearDraft(); };

        container.appendChild(btnSave);
        container.appendChild(btnLoad);
        container.appendChild(btnClear);

        scrollable.appendChild(container);

        checkDraftExists();
    }

    // =================================================================================
    // 4. INICIALIZAÇÃO
    // =================================================================================

    const observer = new MutationObserver((mutations) => {
        manageButtons();
    });

    observer.observe(document.body, { childList: true, subtree: true });

})();
