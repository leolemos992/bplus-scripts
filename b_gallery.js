// ==UserScript==
// @name         B.Gallery! - Galeria para Beemore
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Adiciona uma galeria de imagens funcional para chats e tickets na plataforma Beemore.
// @author       Jose Leonardo Lemos
// @match        https://*.beemore.com/*
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';

    // --- ESTADO GLOBAL DA GALERIA ---
    let allImageUrls = [];
    let currentImageIndex = 0;

    // =================================================================================
    // 1. INJEÇÃO DOS ESTILOS CSS PARA A GALERIA
    // =================================================================================
    function injetarEstilos() {
        // Evita injetar os estilos mais de uma vez
        if (document.getElementById('b-gallery-styles')) return;

        GM_addStyle(`
            /* O contêiner principal da galeria (fundo escuro) */
            #b-gallery-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.85);
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0;
                transition: opacity 0.3s ease;
                pointer-events: none; /* Ignora cliques quando invisível */
            }
            /* Torna a galeria visível e clicável */
            #b-gallery-overlay.visible {
                opacity: 1;
                pointer-events: all;
            }
            /* A imagem principal da galeria */
            #b-gallery-image {
                max-height: 90vh;
                max-width: 90vw;
                user-select: none;
                border-radius: 4px;
                transition: transform 0.2s ease;
            }
            /* Botões de navegação (Anterior/Próximo) */
            .b-gallery-nav {
                cursor: pointer;
                position: absolute;
                top: 50%;
                transform: translateY(-50%);
                padding: 10px 18px;
                color: white;
                font-weight: bold;
                font-size: 28px;
                transition: 0.3s;
                user-select: none;
                background: rgba(0, 0, 0, 0.3);
                border-radius: 50%;
                line-height: 1;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .b-gallery-nav:hover {
                background: rgba(0, 0, 0, 0.6);
            }
            #b-gallery-prev { left: 20px; }
            #b-gallery-next { right: 20px; }
            /* Botão para fechar a galeria */
            #b-gallery-close {
                position: absolute;
                top: 15px;
                right: 35px;
                color: #f1f1f1;
                font-size: 40px;
                font-weight: bold;
                cursor: pointer;
                transition: 0.3s;
            }
            #b-gallery-close:hover {
                color: #bbb;
            }
            /* Contador de imagens (ex: "3 / 10") */
            #b-gallery-counter {
                position: absolute;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                color: white;
                font-size: 16px;
                padding: 5px 10px;
                background: rgba(0, 0, 0, 0.5);
                border-radius: 5px;
            }
        `);
    }

    // =================================================================================
    // 2. INJEÇÃO DOS ELEMENTOS HTML DA GALERIA
    // =================================================================================
    function injetarHTML() {
        // Evita injetar o HTML mais de uma vez
        if (document.getElementById('b-gallery-overlay')) return;

        const galleryHTML = `
            <div id="b-gallery-overlay">
                <span id="b-gallery-close">&times;</span>
                <a id="b-gallery-prev" class="b-gallery-nav">&#10094;</a>
                <a id="b-gallery-next" class="b-gallery-nav">&#10095;</a>
                <div id="b-gallery-content">
                    <img id="b-gallery-image" src="">
                    <div id="b-gallery-counter"></div>
                </div>
            </div>`;
        document.body.insertAdjacentHTML('beforeend', galleryHTML);
    }

    // =================================================================================
    // 3. FUNÇÕES DE CONTROLE DA GALERIA
    // =================================================================================

    // Mostra uma imagem específica com base no seu índice
    function showImage(index) {
        if (index >= 0 && index < allImageUrls.length) {
            currentImageIndex = index;
            document.getElementById('b-gallery-image').src = allImageUrls[index];
            document.getElementById('b-gallery-counter').textContent = `${index + 1} / ${allImageUrls.length}`;
        }
    }

    // Abre a galeria ao clicar em uma imagem
    function openCarousel(clickedElement) {
        // Encontra o contêiner pai (seja um chat ou um ticket) para buscar todas as imagens
        const container = clickedElement.closest('app-chat-virtual-scroll, app-item-panel');
        if (!container) return;

        // Cria uma lista com o URL de todas as imagens clicáveis dentro do contêiner
        allImageUrls = Array.from(container.querySelectorAll('img.image-clickable')).map(img => img.src);

        const clickedImageSrc = clickedElement.src;
        const initialIndex = allImageUrls.indexOf(clickedImageSrc);

        // Se a imagem clicada não for encontrada na lista, não faz nada
        if (initialIndex === -1) return;

        // Mostra a imagem clicada e torna a galeria visível
        showImage(initialIndex);
        document.getElementById('b-gallery-overlay').classList.add('visible');
    }

    // Fecha a galeria
    function closeCarousel() {
        document.getElementById('b-gallery-overlay').classList.remove('visible');
    }

    // Navega para a próxima imagem (com loop)
    function nextImage() {
        showImage((currentImageIndex + 1) % allImageUrls.length);
    }

    // Navega para a imagem anterior (com loop)
    function prevImage() {
        showImage((currentImageIndex - 1 + allImageUrls.length) % allImageUrls.length);
    }


    // =================================================================================
    // 4. INICIALIZAÇÃO DO SCRIPT
    // =================================================================================
    function inicializar() {
        injetarEstilos();
        injetarHTML();

        // --- Adiciona os "escutadores" de eventos ---

        // 1. Escuta cliques em qualquer lugar do corpo da página
        document.body.addEventListener('click', (event) => {
            // Verifica se o alvo do clique foi uma imagem com a classe 'image-clickable'
            const clickedImage = event.target.closest('img.image-clickable');
            if (clickedImage) {
                event.preventDefault(); // Impede ações padrão do navegador
                event.stopPropagation(); // Impede que o clique se propague para outros elementos
                openCarousel(clickedImage);
            }
        }, true); // O 'true' garante que o evento seja capturado antes de outras ações do site

        // 2. Escuta cliques nos elementos da galeria
        document.getElementById('b-gallery-close').addEventListener('click', closeCarousel);
        document.getElementById('b-gallery-next').addEventListener('click', nextImage);
        document.getElementById('b-gallery-prev').addEventListener('click', prevImage);
        document.getElementById('b-gallery-overlay').addEventListener('click', (event) => {
            // Fecha a galeria se o clique for no fundo escuro, e não na imagem ou botões
            if (event.target.id === 'b-gallery-overlay') {
                closeCarousel();
            }
        });

        // 3. Escuta eventos do teclado para navegação
        document.addEventListener('keydown', (event) => {
            // Só executa se a galeria estiver visível
            if (document.getElementById('b-gallery-overlay').classList.contains('visible')) {
                if (event.key === 'ArrowRight') nextImage();
                if (event.key === 'ArrowLeft') prevImage();
                if (event.key === 'Escape') closeCarousel();
            }
        });
    }

    // Garante que o script só rode depois que a página estiver totalmente carregada
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', inicializar);
    } else {
        inicializar();
    }
})();
