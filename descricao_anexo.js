// ==UserScript==
// @name         Adicionar Descrição em Anexos - Beemore (Corrigido)
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Adiciona um campo de texto para descrever anexos APENAS na pop-up de anexos do Beemore.
// @author       Jose Leonardo Lemos
// @match        https://*.beemore.com/*
// @updateURL    https://raw.githubusercontent.com/leolemos992/bplus-scripts/main/descricao_anexo.js
// @downloadURL  https://raw.githubusercontent.com/leolemos992/bplus-scripts/main/descricao_anexo.js
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    // Função para adicionar o campo de texto na pop-up
    function addDescriptionField(modalContent) {
        // Verifica se o campo de texto já foi adicionado para evitar duplicatas
        if (modalContent.querySelector('#attachment-description')) {
            return;
        }

        // Cria o container para o campo de texto
        const descriptionContainer = document.createElement('div');
        descriptionContainer.style.width = '100%';
        descriptionContainer.style.marginBottom = '16px';

        // Cria o label para o campo de texto
        const descriptionLabel = document.createElement('label');
        descriptionLabel.innerText = 'Descrição do Anexo:';
        descriptionLabel.style.display = 'block';
        descriptionLabel.style.marginBottom = '8px';
        descriptionLabel.style.fontWeight = 'bold';
        descriptionLabel.style.color = '#333';

        // Cria o campo de texto (textarea)
        const descriptionTextarea = document.createElement('textarea');
        descriptionTextarea.id = 'attachment-description';
        descriptionTextarea.placeholder = 'Digite uma descrição para o anexo aqui...';
        descriptionTextarea.style.width = '100%';
        descriptionTextarea.style.minHeight = '80px';
        descriptionTextarea.style.padding = '8px';
        descriptionTextarea.style.border = '1px solid #ccc';
        descriptionTextarea.style.borderRadius = '4px';
        descriptionTextarea.style.resize = 'vertical';
        descriptionTextarea.style.boxSizing = 'border-box';

        // Adiciona o label e o textarea ao container
        descriptionContainer.appendChild(descriptionLabel);
        descriptionContainer.appendChild(descriptionTextarea);

        // Insere o container com o campo de texto na pop-up
        modalContent.prepend(descriptionContainer);
    }

    // Observador de mutações para detectar o aparecimento da pop-up
    const observer = new MutationObserver((mutationsList, observer) => {
        for (const mutation of mutationsList) {
            if (mutation.type === 'childList') {
                // Seleciona todas as pop-ups visíveis
                const modals = document.querySelectorAll('app-modal-content');
                modals.forEach(modal => {
                    // *** PONTO CHAVE DA CORREÇÃO ***
                    // Verifica se a pop-up contém o elemento de anexo
                    const attachmentElement = modal.querySelector('app-attachments');
                    if (attachmentElement) {
                        // Se for a pop-up de anexo, adiciona o campo de descrição
                        addDescriptionField(modal);
                    }
                });
            }
        }
    });

    // Inicia a observação no corpo do documento
    observer.observe(document.body, { childList: true, subtree: true });

})();
