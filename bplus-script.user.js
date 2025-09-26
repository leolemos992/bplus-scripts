// ==UserScript==
// @name         B.Plus! - Otimização Visual para Lista de Chats
// @namespace    http://tampermonkey.net/
// @version      10.1
// @description  Adiciona seções recolhíveis, esquema de cores e indicador novo à lista de chats do Beemore, corrigindo o bug de desaparecimento.
// @author       Jose Leonardo Lemos
// @match        https://*.beemore.com/*
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';

    // --- ESTADO GLOBAL ---
    // Armazena o estado (recolhido/expandido) de cada categoria para persistir durante a sessão.
    const collapsedStates = {};

    // --- CONFIGURAÇÕES DE CORES ---
    const CATEGORY_COLORS = {
        'Suporte - PDV': '#EF5350',
        'Suporte - Retaguarda': '#42A5F5',
        'Suporte - Fiscal': '#66BB6A',
        'Suporte - Web': '#FFCA28',
        'Suporte - Mobile': '#FFA726',
        'default': '#BDBDBD'
    };
    const BG_OPACITY_LIGHT = '0.08';
    const BG_OPACITY_DARK = '0.15';

    // =================================================================================
    // INJEÇÃO DE ESTILOS
    // =================================================================================
    function injetarEstilos() {
        if (document.getElementById('bplus-custom-styles')) return;

        const hexToRgba = (hex, opacity) => {
            let r = 0, g = 0, b = 0;
            if (hex.length == 7) {
                r = parseInt(hex.slice(1, 3), 16);
                g = parseInt(hex.slice(3, 5), 16);
                b = parseInt(hex.slice(5, 7), 16);
            }
            return `rgba(${r}, ${g}, ${b}, ${opacity})`;
        };

        let styles = '';
        for (const category in CATEGORY_COLORS) {
            const colorHex = CATEGORY_COLORS[category];
            const categoryClass = `crx-category-${category.replace(/[\s-]+/g, '-').toLowerCase()}`;
            styles += `
                .${categoryClass} {
                    border-left: 5px solid ${colorHex} !important;
                    background-color: ${hexToRgba(colorHex, BG_OPACITY_LIGHT)} !important;
                }
                .dark .${categoryClass} {
                    background-color: ${hexToRgba(colorHex, BG_OPACITY_DARK)} !important;
                }
            `;
        }

        GM_addStyle(`
            /* Animação da bolinha pulsante */
            @keyframes pulse-dot {
                0% { box-shadow: 0 0 0 0 ${hexToRgba(CATEGORY_COLORS['Suporte - Mobile'], 0.7)}; }
                70% { box-shadow: 0 0 0 6px rgba(255, 167, 38, 0); }
                100% { box-shadow: 0 0 0 0 rgba(255, 167, 38, 0); }
            }

            /* Estilo da Bolinha de Notificação */
            .crx-notification-dot {
                width: 10px; height: 10px;
                background-color: ${CATEGORY_COLORS['Suporte - Mobile']};
                border-radius: 50%;
                animation: pulse-dot 1.7s infinite cubic-bezier(0.66, 0, 0, 1);
                flex-shrink: 0;
            }

            /* Cabeçalhos de grupo customizados */
            .crx-group-header {
                display: flex; justify-content: space-between; align-items: center;
                font-size: 0.75rem; font-weight: 600; color: #4a4a4a;
                background-color: #f0f0f0; padding: 4px 12px;
                border-bottom: 1px solid #e0e0e0; border-top: 1px solid #e0e0e0;
                text-transform: uppercase; margin-top: 8px; position: sticky; top: 0; z-index: 5;
                cursor: pointer; user-select: none;
            }
            .dark .crx-group-header { background-color: #3e374e; border-color: #4c445c; color: #e1e1e1; }

            /* Ícone Chevron para expandir/recolher */
            .crx-chevron {
                width: 16px; height: 16px;
                stroke-width: 2.5;
                transition: transform 0.2s ease-in-out;
                transform: rotate(90deg); /* Estado padrão: expandido */
            }
            .crx-collapsed .crx-chevron {
                transform: rotate(0deg); /* Estado recolhido */
            }

            /* Botão de Atualizar */
            #custom-refresh-btn { background-color: #ffffff; border: 1px solid #e5e7eb; color: #525252; }
            .dark #custom-refresh-btn { background-color: #37374a; border-color: #4c445c; color: #e1e1e1; }

            ${styles}
        `);
    }

    // =================================================================================
    // MELHORIAS DE INTERFACE
    // =================================================================================
    function adicionarBotaoDeAtualizacao(container) {
        if (document.getElementById('custom-refresh-btn')) return;
        let refreshBtn = document.createElement('button');
        refreshBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>';
        refreshBtn.id = 'custom-refresh-btn';
        refreshBtn.title = 'Atualizar listas de chat';
        Object.assign(refreshBtn.style, { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '2rem', width: '2rem', marginLeft: '0.5rem', borderRadius: '0.25rem', cursor: 'pointer' });
        refreshBtn.onclick = () => {
            atualizarListasDeChat();
            setTimeout(aplicarCustomizacoes, 1200);
        };
        container.appendChild(refreshBtn);
    }

    function atualizarListasDeChat() {
        document.querySelectorAll('app-chat-list > header').forEach((header, index) => {
            const iconeChevron = header.querySelector('app-icon[icon="tablerChevronRight"]');
            if (iconeChevron && iconeChevron.classList.contains('rotate-90')) {
                setTimeout(() => {
                    header.click();
                    setTimeout(() => header.click(), 200);
                }, index * 250);
            }
        });
    }

    function aplicarDestaquesECores() {
        document.querySelectorAll('app-chat-list-item').forEach(item => {
            item.className = item.className.replace(/\bcrx-category-\S+/g, '');
            item.querySelector('.crx-notification-dot')?.remove();

            const categoryElement = item.querySelector('section > div > span:not([class*="font-medium"])');
            const category = categoryElement ? categoryElement.textContent.trim() : 'default';
            const categoryClass = `crx-category-${category.replace(/[\s-]+/g, '-').toLowerCase()}`;
            item.classList.add(categoryClass);

            const alertIconWrapper = item.querySelector('app-icon[icon="tablerAlertCircle"]')?.parentElement;
            if (alertIconWrapper) {
                alertIconWrapper.style.display = 'none';
                const dot = document.createElement('div');
                dot.className = 'crx-notification-dot';
                alertIconWrapper.parentElement.appendChild(dot);
            }
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
            const categoryElement = item.querySelector('section > div > span:not([class*="font-medium"])');
            const category = categoryElement ? categoryElement.textContent.trim() : 'Sem Categoria';
            if (!groups.has(category)) groups.set(category, []);
            groups.get(category).push(item);
        });

        const sortedGroups = new Map([...groups.entries()].sort());
        othersContainer.innerHTML = '';

        sortedGroups.forEach((groupItems, category) => {
            const isCollapsed = collapsedStates[category] === true;

            const header = document.createElement('div');
            header.className = 'crx-group-header';
            if (isCollapsed) header.classList.add('crx-collapsed');
            header.innerHTML = `
                <span>${category} (${groupItems.length})</span>
                <svg class="crx-chevron" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M9 6l6 6l-6 6"></path>
                </svg>
            `;

            header.addEventListener('click', (event) => {
                const clickedHeader = event.currentTarget;
                collapsedStates[category] = !collapsedStates[category]; // Inverte o estado
                clickedHeader.classList.toggle('crx-collapsed', collapsedStates[category]);

                // Itera sobre os irmãos do header (os chats) e alterna sua visibilidade
                let nextEl = clickedHeader.nextElementSibling;
                while (nextEl && !nextEl.classList.contains('crx-group-header')) {
                    nextEl.style.display = collapsedStates[category] ? 'none' : 'flex';
                    nextEl = nextEl.nextElementSibling;
                }
            });

            othersContainer.appendChild(header);

            groupItems.sort((a, b) => {
                const aPriority = a.querySelector('.crx-notification-dot') ? 1 : 0;
                const bPriority = b.querySelector('.crx-notification-dot') ? 1 : 0;
                return bPriority - aPriority;
            });

            // Adiciona todos os itens ao DOM, mas define a visibilidade inicial correta
            groupItems.forEach(item => {
                item.style.display = isCollapsed ? 'none' : 'flex';
                othersContainer.appendChild(item);
            });
        });
        othersContainer.setAttribute('data-crx-grouped', 'true');
    }

    // =================================================================================
    // LOOP PRINCIPAL E INICIALIZAÇÃO
    // =================================================================================
    function aplicarCustomizacoes() {
        aplicarDestaquesECores();
        const groupedContainer = document.querySelector('[data-crx-grouped="true"]');
        if (groupedContainer) {
            groupedContainer.removeAttribute('data-crx-grouped');
        }
        agruparEOrdenarChats();
    }

    function inicializar() {
        injetarEstilos();
        const refreshObserver = new MutationObserver(() => {
            const targetContainer = document.querySelector('app-chat-list-container > div.flex.items-center');
            if (targetContainer && !document.getElementById('custom-refresh-btn')) {
                adicionarBotaoDeAtualizacao(targetContainer);
            }
        });
        refreshObserver.observe(document.body, { childList: true, subtree: true });

        setInterval(aplicarCustomizacoes, 1500);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', inicializar);
    } else {
        inicializar();
    }
})();
