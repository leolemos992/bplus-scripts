// ==UserScript==
// @name         B.Gallery! - Galeria para Beemore (v2.0)
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Galeria avançada com Zoom, Download e Grid View para o Beemore.
// @author       Jose Leonardo Lemos
// @match        https://*.beemore.com/*
// @grant        GM_addStyle
// @grant        GM_download
// @updateURL    https://raw.githubusercontent.com/leolemos992/bplus-scripts/main/b_gallery.js
// @downloadURL  https://raw.githubusercontent.com/leolemos992/bplus-scripts/main/b_gallery.js
// @supportURL   https://github.com/leolemos992/bplus-scripts/issues
// ==/UserScript==

(function () {
    'use strict';

    // --- ESTADO GLOBAL ---
    let allImageUrls = [];
    let currentImageIndex = 0;
    let zoomLevel = 1;
    let isDragging = false;
    let startX, startY, translateX = 0, translateY = 0;
    let isGridView = false;

    // =================================================================================
    // 1. ESTILOS CSS
    // =================================================================================
    function injetarEstilos() {
        if (document.getElementById('b-gallery-styles')) return;

        const style = document.createElement('style');
        style.id = 'b-gallery-styles';
        style.textContent = `
            #b-gallery-overlay {
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0, 0, 0, 0.95); z-index: 10000;
                display: flex; flex-direction: column;
                opacity: 0; transition: opacity 0.3s ease; pointer-events: none;
            }
            #b-gallery-overlay.visible { opacity: 1; pointer-events: all; }

            /* Header com controles */
            #b-gallery-header {
                display: flex; justify-content: space-between; align-items: center;
                padding: 15px 20px; z-index: 10002; color: white;
            }
            .b-gallery-actions { display: flex; gap: 15px; }
            .b-btn {
                background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.2);
                color: white; padding: 8px 12px; border-radius: 6px; cursor: pointer;
                font-size: 14px; display: flex; align-items: center; gap: 6px; transition: 0.2s;
            }
            .b-btn:hover { background: rgba(255, 255, 255, 0.2); }
            .b-btn svg { width: 18px; height: 18px; }

            /* Área Principal */
            #b-gallery-main {
                flex-grow: 1; position: relative; overflow: hidden;
                display: flex; align-items: center; justify-content: center;
            }

            /* Imagem Principal */
            #b-gallery-image-container {
                width: 100%; height: 100%; display: flex;
                align-items: center; justify-content: center;
            }
            #b-gallery-image {
                max-height: 85vh; max-width: 90vw;
                transition: transform 0.1s ease-out;
                cursor: grab; user-select: none;
            }
            #b-gallery-image:active { cursor: grabbing; }

            /* Grid View */
            #b-gallery-grid {
                display: none; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
                gap: 15px; padding: 20px; width: 100%; height: 100%;
                overflow-y: auto; box-sizing: border-box;
            }
            #b-gallery-grid.active { display: grid; }
            .b-grid-item {
                aspect-ratio: 1; overflow: hidden; border-radius: 8px;
                cursor: pointer; border: 2px solid transparent; position: relative;
            }
            .b-grid-item:hover { border-color: rgba(255,255,255,0.5); }
            .b-grid-item img { width: 100%; height: 100%; object-fit: cover; }
            .b-grid-item.active-item { border-color: #fff; box-shadow: 0 0 10px rgba(255,255,255,0.3); }

            /* Navegação */
            .b-gallery-nav {
                position: absolute; top: 50%; transform: translateY(-50%);
                background: rgba(0,0,0,0.5); color: white; border: none;
                width: 50px; height: 50px; border-radius: 50%; font-size: 24px;
                cursor: pointer; display: flex; align-items: center; justify-content: center;
                transition: 0.2s; z-index: 10001;
            }
            .b-gallery-nav:hover { background: rgba(255,255,255,0.2); }
            #b-nav-prev { left: 20px; }
            #b-nav-next { right: 20px; }

            /* Miniaturas inferiores */
            #b-gallery-thumbnails {
                height: 70px; display: flex; gap: 8px; padding: 10px;
                overflow-x: auto; justify-content: center; background: rgba(0,0,0,0.3);
            }
            .b-thumb {
                height: 100%; aspect-ratio: 1; border-radius: 4px; cursor: pointer;
                opacity: 0.5; transition: 0.2s; border: 2px solid transparent; object-fit: cover;
            }
            .b-thumb.active { opacity: 1; border-color: white; }
            .b-thumb:hover { opacity: 0.8; }
        `;
        document.head.appendChild(style);
    }

    // =================================================================================
    // 2. HTML DA GALERIA
    // =================================================================================
    function injetarHTML() {
        if (document.getElementById('b-gallery-overlay')) return;

        const html = `
            <div id="b-gallery-overlay">
                <div id="b-gallery-header">
                    <div id="b-gallery-counter">1 / 1</div>
                    <div class="b-gallery-actions">
                        <button class="b-btn" id="b-btn-grid" title="Visualizar Grade">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                        </button>
                        <button class="b-btn" id="b-btn-download" title="Baixar Imagem">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                        </button>
                        <button class="b-btn" id="b-btn-close" title="Fechar (Esc)">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    </div>
                </div>

                <div id="b-gallery-main">
                    <button id="b-nav-prev" class="b-gallery-nav">&#10094;</button>
                    
                    <div id="b-gallery-image-container">
                        <img id="b-gallery-image" src="" draggable="false">
                    </div>

                    <div id="b-gallery-grid"></div>

                    <button id="b-nav-next" class="b-gallery-nav">&#10095;</button>
                </div>

                <div id="b-gallery-thumbnails"></div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);
    }

    // =================================================================================
    // 3. LÓGICA DA GALERIA
    // =================================================================================

    function updateView() {
        const img = document.getElementById('b-gallery-image');
        const counter = document.getElementById('b-gallery-counter');
        const url = allImageUrls[currentImageIndex];

        // Reset Zoom
        zoomLevel = 1;
        translateX = 0;
        translateY = 0;
        updateTransform();

        img.src = url;
        counter.textContent = `${currentImageIndex + 1} / ${allImageUrls.length}`;

        // Atualizar thumbnails
        document.querySelectorAll('.b-thumb').forEach(t => t.classList.remove('active'));
        const activeThumb = document.querySelector(`.b-thumb[data-index="${currentImageIndex}"]`);
        if (activeThumb) {
            activeThumb.classList.add('active');
            activeThumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }

        // Atualizar Grid highlight
        document.querySelectorAll('.b-grid-item').forEach(i => i.classList.remove('active-item'));
        const activeGrid = document.querySelector(`.b-grid-item[data-index="${currentImageIndex}"]`);
        if (activeGrid) activeGrid.classList.add('active-item');
    }

    function updateTransform() {
        const img = document.getElementById('b-gallery-image');
        img.style.transform = `translate(${translateX}px, ${translateY}px) scale(${zoomLevel})`;
    }

    function toggleGrid() {
        isGridView = !isGridView;
        const grid = document.getElementById('b-gallery-grid');
        const imgContainer = document.getElementById('b-gallery-image-container');
        const navs = document.querySelectorAll('.b-gallery-nav');
        const thumbs = document.getElementById('b-gallery-thumbnails');

        if (isGridView) {
            grid.classList.add('active');
            imgContainer.style.display = 'none';
            navs.forEach(n => n.style.display = 'none');
            thumbs.style.display = 'none';
            renderGrid();
        } else {
            grid.classList.remove('active');
            imgContainer.style.display = 'flex';
            navs.forEach(n => n.style.display = 'flex');
            thumbs.style.display = 'flex';
            updateView(); // Re-sync view
        }
    }

    function renderGrid() {
        const grid = document.getElementById('b-gallery-grid');
        grid.innerHTML = '';
        allImageUrls.forEach((url, idx) => {
            const item = document.createElement('div');
            item.className = `b-grid-item ${idx === currentImageIndex ? 'active-item' : ''}`;
            item.dataset.index = idx;
            item.innerHTML = `<img src="${url}" loading="lazy">`;
            item.onclick = () => {
                currentImageIndex = idx;
                toggleGrid(); // Volta para view normal
            };
            grid.appendChild(item);
        });
    }

    function downloadImage() {
        const url = allImageUrls[currentImageIndex];
        const link = document.createElement('a');
        link.href = url;
        link.download = `beemore-image-${Date.now()}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function openGallery(clickedSrc) {
        // SELETOR CORRIGIDO: div[scrollable="true"] é o container das mensagens
        // Adicionado fallback para classe específica caso o atributo falhe
        const container = document.querySelector('div[scrollable="true"]') ||
            document.querySelector('.h-full.w-full.overflow-y-auto');

        if (!container) {
            console.error('B.Gallery: Container de mensagens não encontrado.');
            return;
        }

        // SELETOR CORRIGIDO: img.image-clickable (encontrado no debug)
        // Também mantemos o filtro de não-avatar por segurança
        const images = Array.from(container.querySelectorAll('img.image-clickable, img.cursor-pointer.object-contain'))
            .filter(img => !img.classList.contains('rounded-full'));

        if (images.length === 0) {
            console.warn('B.Gallery: Nenhuma imagem encontrada no chat.');
            // Fallback: Tenta abrir apenas a imagem clicada se não achar outras
            allImageUrls = [clickedSrc];
        } else {
            allImageUrls = images.map(img => img.src);
            // Remove duplicatas mantendo a ordem
            allImageUrls = [...new Set(allImageUrls)];
        }

        currentImageIndex = allImageUrls.indexOf(clickedSrc);
        if (currentImageIndex === -1) {
            // Se não achou exato, tenta achar o mais próximo ou adiciona
            allImageUrls.unshift(clickedSrc);
            currentImageIndex = 0;
        }

        // Renderizar thumbnails inferiores
        const thumbsContainer = document.getElementById('b-gallery-thumbnails');
        thumbsContainer.innerHTML = '';
        allImageUrls.forEach((url, idx) => {
            const t = document.createElement('img');
            t.src = url;
            t.className = 'b-thumb';
            t.dataset.index = idx;
            t.onclick = () => { currentImageIndex = idx; updateView(); };
            thumbsContainer.appendChild(t);
        });

        updateView();
        document.getElementById('b-gallery-overlay').classList.add('visible');
    }

    function closeGallery() {
        document.getElementById('b-gallery-overlay').classList.remove('visible');
        isGridView = false;
        document.getElementById('b-gallery-grid').classList.remove('active');
        document.getElementById('b-gallery-image-container').style.display = 'flex';
        document.querySelectorAll('.b-gallery-nav').forEach(n => n.style.display = 'flex');
        document.getElementById('b-gallery-thumbnails').style.display = 'flex';
    }

    // =================================================================================
    // 4. EVENTOS E INICIALIZAÇÃO
    // =================================================================================
    function setupEvents() {
        // Abrir galeria ao clicar nas imagens do chat
        document.body.addEventListener('click', (e) => {
            // Verifica se é uma imagem clicável (classe image-clickable ou cursor-pointer+object-contain)
            const isClickableImage = e.target.tagName === 'IMG' && (
                e.target.classList.contains('image-clickable') ||
                (e.target.classList.contains('cursor-pointer') && e.target.classList.contains('object-contain'))
            );

            if (isClickableImage && !e.target.classList.contains('rounded-full')) {
                e.preventDefault();
                e.stopPropagation();
                openGallery(e.target.src);
            }
        }, true);

        // Controles da Galeria
        document.getElementById('b-btn-close').onclick = closeGallery;
        document.getElementById('b-btn-grid').onclick = toggleGrid;
        document.getElementById('b-btn-download').onclick = downloadImage;
        document.getElementById('b-nav-prev').onclick = () => {
            currentImageIndex = (currentImageIndex - 1 + allImageUrls.length) % allImageUrls.length;
            updateView();
        };
        document.getElementById('b-nav-next').onclick = () => {
            currentImageIndex = (currentImageIndex + 1) % allImageUrls.length;
            updateView();
        };

        // Zoom com Scroll
        const imgContainer = document.getElementById('b-gallery-image-container');
        imgContainer.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            zoomLevel = Math.min(Math.max(0.5, zoomLevel + delta), 5);
            updateTransform();
        });

        // Pan (Arrastar imagem com zoom)
        const img = document.getElementById('b-gallery-image');
        img.addEventListener('mousedown', (e) => {
            if (zoomLevel > 1) {
                isDragging = true;
                startX = e.clientX - translateX;
                startY = e.clientY - translateY;
            }
        });
        window.addEventListener('mousemove', (e) => {
            if (isDragging) {
                e.preventDefault();
                translateX = e.clientX - startX;
                translateY = e.clientY - startY;
                updateTransform();
            }
        });
        window.addEventListener('mouseup', () => isDragging = false);

        // Teclado
        document.addEventListener('keydown', (e) => {
            if (!document.getElementById('b-gallery-overlay').classList.contains('visible')) return;

            if (e.key === 'Escape') closeGallery();
            if (!isGridView) {
                if (e.key === 'ArrowLeft') document.getElementById('b-nav-prev').click();
                if (e.key === 'ArrowRight') document.getElementById('b-nav-next').click();
            }
        });
    }

    function init() {
        injetarEstilos();
        injetarHTML();
        setupEvents();
        console.log('B.Gallery v2.0 carregado com sucesso!');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
