// ==UserScript==
// @name         B.Gallery! - Galeria para Beemore
// @namespace    http://tampermonkey.net/
// @version      1.3
// @description  Adiciona uma galeria de imagens funcional com miniaturas para chats e tickets na plataforma Beemore.
// @author       Jose Leonardo Lemos
// @match        https://*.beemore.com/*
// @grant        GM_addStyle
// @updateURL    https://raw.githubusercontent.com/leolemos992/bplus-scripts/main/b_gallery.js
// @downloadURL  https://raw.githubusercontent.com/leolemos992/bplus-scripts/main/b_gallery.js
// @supportURL   https://github.com/leolemos992/bplus-scripts/issues
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
                flex-direction: column; /* Organiza conteúdo principal e miniaturas verticalmente */
                opacity: 0;
                transition: opacity 0.3s ease;
                pointer-events: none; /* Ignora cliques quando invisível */
            }
            /* Torna a galeria visível e clicável */
            #b-gallery-overlay.visible {
                opacity: 1;
                pointer-events: all;
            }
            /* Contêiner da imagem principal */
             #b-gallery-content {
                display: flex;
                align-items: center;
                justify-content: center;
                flex-grow: 1; /* Permite que a imagem ocupe o espaço disponível */
                position: relative;
                width: 100%;
            }
            /* A imagem principal da galeria */
            #b-gallery-image {
                max-height: 80vh; /* Reduzido para dar espaço às miniaturas */
                max-width: 90vw;
                user-select: none;
                border-radius: 4px;
                transition: transform 0.2s ease;
            }
            /* Contêiner das miniaturas */
            #b-gallery-thumbnails {
                height: 80px; /* Altura da faixa de miniaturas */
                width: 90vw;
                padding: 10px 0;
                display: flex;
                justify-content: center;
                align-items: center;
                gap: 8px;
                overflow-x: auto; /* Permite rolagem horizontal se houver muitas imagens */
                flex-shrink: 0; /* Impede que o contêiner encolha */
            }
            /* Estilo da barra de rolagem (opcional, mas melhora a aparência) */
            #b-gallery-thumbnails::-webkit-scrollbar { height: 8px; }
            #b-gallery-thumbnails::-webkit-scrollbar-track { background: rgba(255,255,255,0.1); border-radius: 4px; }
            #b-gallery-thumbnails::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.3); border-radius: 4px; }
            #b-gallery-thumbnails::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.5); }
            /* Estilo de cada miniatura */
            .b-gallery-thumb {
                height: 60px;
                border-radius: 4px;
                cursor: pointer;
                opacity: 0.5;
                transition: opacity 0.2s ease, border 0.2s ease;
                border: 2px solid transparent;
            }
            .b-gallery-thumb:hover {
                opacity: 0.8;
            }
            /* Estilo da miniatura ativa */
            .b-gallery-thumb.active {
                opacity: 1;
                border: 2px solid #fff;
            }
            /* Botões de navegação (Anterior/Próximo) */
            .b-gallery-nav {
                cursor: pointer; position: absolute; top: 50%; transform: translateY(-50%); padding: 10px 18px;
                color: white; font-weight: bold; font-size: 28px; transition: 0.3s; user-select: none;
                background: rgba(0, 0, 0, 0.3); border-radius: 50%; line-height: 1; display: flex;
                align-items: center; justify-content: center; z-index: 10001;
            }
            .b-gallery-nav:hover { background: rgba(0, 0, 0, 0.6); }
            #b-gallery-prev { left: 20px; }
            #b-gallery-next { right: 20px; }
            /* Botão para fechar a galeria */
            #b-gallery-close {
                position: absolute; top: 15px; right: 35px; color: #f1f1f1;
                font-size: 40px; font-weight: bold; cursor: pointer; transition: 0.3s; z-index: 10002;
            }
            #b-gallery-close:hover { color: #bbb; }
            /* Contador de imagens (ex: "3 / 10") */
            #b-gallery-counter {
                position: absolute; top: 20px; left: 50%; transform: translateX(-50%); color: white;
                font-size: 16px; padding: 5px 10px; background: rgba(0, 0, 0, 0.5); border-radius: 5px; z-index: 10002;
            }
        `);
    }

    // =================================================================================
    // 2. INJEÇÃO DOS ELEMENTOS HTML DA GALERIA
    // =================================================================================
    function injetarHTML() {
        if (document.getElementById('b-gallery-overlay')) return;

        const galleryHTML = `
            <div id="b-gallery-overlay">
                <span id="b-gallery-close">&times;</span>
                <span id="b-gallery-counter"></span>
                <div id="b-gallery-content">
                    <a id="b-gallery-prev" class="b-gallery-nav">&#10094;</a>
                    <img id="b-gallery-image" src="">
                    <a id="b-gallery-next" class="b-gallery-nav">&#10095;</a>
                </div>
                <div id="b-gallery-thumbnails"></div>
            </div>`;
        document.body.insertAdjacentHTML('beforeend', galleryHTML);
    }

    // =================================================================================
    // 3. FUNÇÕES DE CONTROLE DA GALERIA
    // =================================================================================

    // Mostra uma imagem específica e atualiza a miniatura ativa
    function showImage(index) {
        if (index >= 0 && index < allImageUrls.length) {
            currentImageIndex = index;
            document.getElementById('b-gallery-image').src = allImageUrls[index];
            document.getElementById('b-gallery-counter').textContent = `${index + 1} / ${allImageUrls.length}`;

            // Atualiza a classe 'active' nas miniaturas
            const oldActiveThumb = document.querySelector('.b-gallery-thumb.active');
            if (oldActiveThumb) {
                oldActiveThumb.classList.remove('active');
            }
            const newActiveThumb = document.querySelector(`.b-gallery-thumb[data-index='${index}']`);
            if (newActiveThumb) {
                newActiveThumb.classList.add('active');
                // Garante que a miniatura ativa esteja sempre visível na barra de rolagem
                newActiveThumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }
        }
    }

    // Cria as miniaturas e abre a galeria
    function openCarousel(clickedElement) {
        const container = clickedElement.closest('app-chat-virtual-scroll, app-item-panel');
        if (!container) return;

        allImageUrls = Array.from(container.querySelectorAll('img.image-clickable')).map(img => img.src);
        const clickedImageSrc = clickedElement.src;
        const initialIndex = allImageUrls.indexOf(clickedImageSrc);

        if (initialIndex === -1) return;

        // --- GERAÇÃO DAS MINIATURAS ---
        const thumbnailsContainer = document.getElementById('b-gallery-thumbnails');
        thumbnailsContainer.innerHTML = ''; // Limpa miniaturas antigas
        allImageUrls.forEach((url, index) => {
            const thumb = document.createElement('img');
            thumb.src = url;
            thumb.classList.add('b-gallery-thumb');
            thumb.dataset.index = index; // Guarda o índice para o clique
            thumbnailsContainer.appendChild(thumb);
        });

        showImage(initialIndex);
        document.getElementById('b-gallery-overlay').classList.add('visible');
    }

    function closeCarousel() {
        document.getElementById('b-gallery-overlay').classList.remove('visible');
    }

    function nextImage() {
        showImage((currentImageIndex + 1) % allImageUrls.length);
    }

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
        document.body.addEventListener('click', (event) => {
            const clickedImage = event.target.closest('img.image-clickable');
            if (clickedImage) {
                event.preventDefault();
                event.stopPropagation();
                openCarousel(clickedImage);
            }
        }, true);

        document.getElementById('b-gallery-close').addEventListener('click', closeCarousel);
        document.getElementById('b-gallery-next').addEventListener('click', nextImage);
        document.getElementById('b-gallery-prev').addEventListener('click', prevImage);
        document.getElementById('b-gallery-overlay').addEventListener('click', (event) => {
            if (event.target.id === 'b-gallery-overlay') {
                closeCarousel();
            }
        });

        // Evento de clique para as miniaturas (usando delegação de evento)
        document.getElementById('b-gallery-thumbnails').addEventListener('click', (event) => {
            const thumb = event.target.closest('.b-gallery-thumb');
            if (thumb && thumb.dataset.index) {
                const index = parseInt(thumb.dataset.index, 10);
                showImage(index);
            }
        });

        document.addEventListener('keydown', (event) => {
            if (document.getElementById('b-gallery-overlay').classList.contains('visible')) {
                if (event.key === 'ArrowRight') { nextImage(); }
                else if (event.key === 'ArrowLeft') { prevImage(); }
                else if (event.key === 'Escape') {
                    event.stopPropagation();
                    event.preventDefault();
                    closeCarousel();
                }
            }
        }, true);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', inicializar);
    } else {
        inicializar();
    }
})();
