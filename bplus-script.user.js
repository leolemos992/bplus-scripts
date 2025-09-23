// ==UserScript==
// @name         B.Plus! - Contador de Atendimentos & Melhorias Beemore
// @namespace    http://tampermonkey.net/
// @version      9.3
// @description  Adiciona seletor de layout (Abas Horizontais vs. Lista Vertical), reintroduz cores nos itens e aprimora o ícone de notificação.
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
    const SCRIPT_VERSION = GM_info.script.version || '9.3';
    let activeLayout = GM_getValue('activeLayout', 'tabs'); // 'tabs' ou 'list'
    // ... (demais configurações mantidas)

    // =-================================================================================
    // INJEÇÃO DE ESTILOS
    // =================================================================================
    function injetarEstilos() {
        if (document.getElementById('bplus-custom-styles')) return;
        let styles = '';
        for (const category in CATEGORY_COLORS) {
            // ... (lógica de cores mantida, mas agora também para o fundo dos itens)
            const color = CATEGORY_COLORS[category];
            styles += `
                /* Cor de fundo para itens da lista */
                .crx-item-bg-${safeCategory} { background-color: ${hexToRgba(color, 0.1)} !important; }
                .dark .crx-item-bg-${safeCategory} { background-color: ${hexToRgba(color, 0.2)} !important; }
                
                /* Cor para a aba ativa */
                .crx-filter-tab[data-filter="${category}"].active { background-color: ${color} !important; color: white !important; border: none; }
                .dark .crx-filter-tab[data-filter="${category}"].active .count { background-color: rgba(0,0,0,0.2); color: white; }
            `;
        }
        GM_addStyle(`
            /* NOVO Ícone de Notificação */
            .crx-tg-badge {
                background-color: #FFA500; /* Laranja */
                border-radius: 50%; width: 12px; height: 12px;
                position: absolute; right: 8px; top: 8px;
            }
            /* ... (outros estilos, incluindo os da v9.2 e os de layout vertical/horizontal) ... */
            ${styles}
        `);
    }

    // =================================================================================
    // LÓGICA PRINCIPAL
    // =================================================================================

    function adicionarControles(container) {
        // ... (botão de refresh removido, botão de compacto agora é o seletor de layout)
        if (!document.getElementById('crx-layout-toggle')) {
            let layoutBtn = document.createElement('button');
            layoutBtn.id = 'crx-layout-toggle';
            layoutBtn.title = 'Alternar Layout (Abas/Lista)';
            // O ícone pode ser dinâmico ou um ícone genérico de layout
            layoutBtn.innerHTML = `<svg ... >...</svg>`;
            
            layoutBtn.onclick = () => {
                activeLayout = (activeLayout === 'tabs') ? 'list' : 'tabs';
                GM_setValue('activeLayout', activeLayout);
                renderCustomChatList(); // Força a re-renderização com o novo layout
            };
            container.appendChild(layoutBtn);
        }
    }
    
    function renderCustomChatList() {
        // ... (lógica de leitura de dados mantida)

        crxContainer.innerHTML = ''; // Limpa o container

        if (activeLayout === 'tabs') {
            // Renderiza a UI com abas de filtro horizontais
            // ... (código da v9.2)
        } else {
            // Renderiza a UI com lista de categorias vertical (estilo antigo)
            // ... (código da v8.8)
        }
        
        // ... (lógica para adicionar eventos de clique mantida)
    }

    // ... (restante do código)

})();
