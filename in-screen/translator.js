// @ts-check
;(function() {

//#region Variables and Initialization

const APP_NAME = 'InScreenTranslator';

if (typeof window['REDCap'] == 'undefined') {
    window['REDCap'] = {
        EM: {}
    };
}
if (typeof window['REDCap']['EM'] == 'undefined') {
    window['REDCap']['EM'] = {
        RUB: {}
    };
}
if (typeof window['REDCap']['EM']['RUB'] == 'undefined') {
    window['REDCap']['EM']['RUB'] = {};
}
window['REDCap']['EM']['RUB']['REDCapInScreenTranslator'] = {
    init: init,
    translate: translate
};

/** @type REDCapInScreenTranslator_Config */
var config;

/** @type JavascriptModuleObject */
var JSMO;

var translationInitialized = false;
var translationInitializing = false;

var $dialog = null;

/**
 * Initializes the REDCap Translator plugin page
 * @param {REDCapInScreenTranslator_Config} data 
 */
function init(data) {
    config = data;
    JSMO = resolveJSMO(config.jsmoName);

    $(function() {
        log('Initialized.', config);

        $dialog = $('#in-screen-translation-editor');
        // This keeps the dialog on top of other dialogs
        $(document).on("dialogopen", ".ui-dialog", function (event, ui) {
            if (event.target.dataset['translationWidget'] != 'in-screen-editor') {
                warn('New dialog detected:', event.target)
                $dialog.dialog('moveToTop');
            }
        });

        // Actions
        $dialog.find('[data-action]').on('click', handleAction);


        // TODO: Remove - DEBUG only
        translate();
    });
}

function translate(password = '') {
    if (translationInitializing) {
        warn('Already initializing. Please be patient ...');
    }
    else {
        translationInitializing = true;
        if (!translationInitialized) {
            log('Starting translation of \'' + config.name + '\' based on ' + config.basedOn + ' metadata ...');
            setupTranslation(password);
        }
        else {
            injectTranslationHooks();
            translationInitializing = false;
        }
    }
}

//#endregion

//#region Setup

function setupTranslation(password = '') {
    setProgressModalProgress(0);
    showProgressModal('Loading translation data ...');
    let errorMsg = '';
    // Load data
    JSMO.ajax('load-translation-data', { name: config.name, basedOn: config.basedOn, password: password })
    .then(function(response) {
        if (response.success) {
            config.metadata = response.data.metadata;
            config.translation = response.data.translation;
            config.keys = response.data.keys; 
            log('Translation, metadata, and keys loaded.', config);
            updateProgressModal('Preparing page for translation ...', 5);
            injectTranslationHooks();
            translationInitialized = true;
        }
        else {
            errorMsg = response.error;
        }
    })
    .catch(function(err) {
        errorMsg = err;
    })
    .finally(function() {
        if (errorMsg != '') {
            showToast('#translator-errorToast', 'Failed to load translation data. See console for details.');
            error('Failed to load translation data:', errorMsg);
        }
        translationInitializing = false;
        setTimeout(() => {
            hideProgressModal();
            log('Initialization complete.');
        }, 200);
    });
}

/**
 * 
 * @param {HTMLElement} el 
 * @param {Number} counter 
 * @returns 
 */
function processElement(el, counter) {
    counter++;

    // Is there work to do? At least one code starter must be present
    if (!el.innerHTML.includes(config.codeStart)) return counter;

    log('Processing element:', $(el));

    // Inspect and process all child nodes
    if (el.hasChildNodes()) {
        /** @type {HTMLElement|null} */
        let currentWrapper = null;
        const childNodes = []
        el.childNodes.forEach(child => childNodes.push(child));
        for (const child of childNodes) {
            if (child.nodeType == Node.TEXT_NODE && child.textContent?.includes(config.codeStart)) {
                log('Processing text child:', $(child), $(el));
                const text = child.textContent;
                log('Text:', text)
                // Text node
                // This could be a language string or have additional content or be only a partial language string or 
                // even be multiple language strings
                let start = 0;
                start = text.indexOf(config.codeStart, start);
                const code = text.substring(start + 1, 17);
                const decoded = decodeInvisiCode(code);
                const key = config.keys[decoded.int];
                // log ('Code / Decoded / Key:', code, decoded, key);
                const end = text.indexOf(config.stringTerminator, start + 17);
                // Prepend wrapper
                const span = document.createElement('span');
                span.setAttribute('data-inscreen-translation', key);
                el.insertBefore(span, child);
                if (end < 0) {
                    // There is no end, thus append complete text node and set currentWrapper
                    span.appendChild(child);
                    child.textContent = child.textContent.replace(code, '').replace(config.codeStart, '');
                    currentWrapper = span;
                }
                else {
                    // Add without code and reprocess
                    const partial = document.createTextNode(text.substring(start + 17, end));
                    span.append(partial);
                    child.textContent = text.substring(end + 1);
                    return processElement(el, counter -1);
                }
            }
            else if (child.nodeType == Node.TEXT_NODE && child.textContent?.includes(config.stringTerminator)) {
                // Partial text node with a terminater
                if (currentWrapper != null) {
                    const text = child.textContent;
                    const end = text.indexOf(config.stringTerminator);
                    const partial = document.createTextNode(text.substring(0, end));
                    currentWrapper.append(partial);
                    child.textContent = text.substring(end + 1);
                    currentWrapper = null;
                }
                else {
                    error('Processing error. Partial string with terminator and no wrapper!', $(el));
                }
            }
            else if (child.nodeType == Node.TEXT_NODE && currentWrapper != null) {
                // Text node without terminator - means in the middle of the string
                currentWrapper.appendChild(child);
            }
            else if (child.nodeType == Node.ELEMENT_NODE) {
                if (currentWrapper == null) {
                    counter = processElement(child, counter);
                }
                else {
                    // Append this node to the wrapper
                    currentWrapper.append(child);
                }
            }
            else if (child.nodeType != Node.TEXT_NODE && child.nodeType != Node.ELEMENT_NODE && child.nodeType != Node.COMMENT_NODE) {
                // Comment nodes are completely ignored
                log('Skipping other child:', child.nodeType, $(child), $(el));
            }
        }
    }
    // Inspect all attributes
    if (el.hasAttributes()) {
        for (const attr of el.attributes) {
            if (attr.textContent?.includes(config.codeStart)) {
                log('Processing attribute:', attr.name, $(el));
            }
        }
    }

    return counter;
}

function injectTranslationHooks() {
    log('Injecting hooks ...');

    const nTotal = $('body *').length;
    log ('Processing ' + nTotal + ' elements ...');
    let i = 0; // Keep track of progress
    const nProcessed = processElement(document.body, i);
    log ('Elements processed: ' + nProcessed);


    // // Compile a list of all candidate HTML elements
    // /**
    //  * @type HTMLElement[]
    //  */
    // const elements = [];
    // $childLess.each(function() {
    //     const $this = $(this);
    //     const content = getTextAndAttributes(this);
    //     if (content.includes(config.codeStart)) {
    //         elements.push(this);
    //     }
    //     else {
    //         let $parent = $this.parent();
    //         while (!($parent.is('body') || $parent.is('html'))) {
    //             const text = $parent.contents().filter(function() {
    //                 return this.nodeType == Node.TEXT_NODE || this.nodeType == Node.ATTRIBUTE_NODE;
    //             }).text();
    //             if (text.includes(config.codeStart)) {
    //                 const el = $parent.get(0);
    //                 if (el != null) elements.push(el);
    //             }
    //             $parent = $parent.parent();
    //         }
    //     }
    // });
        


        // // Replace all strings that are in text content in the html content
        // let html = el.innerHTML;
        // let text = el.innerText;
        // // log($(el), text); // Debug logging
        // let start = html.indexOf(config.codeStart);
        // const keys = {};
        // while (start > -1) {
        //     const code = html.substring(start + 1, 16);
        //     const decoded = decodeInvisiCode(code);
        //     const key = config.keys[decoded.int];
        //     keys[key] = true;
        //     const end = html.indexOf(config.stringTerminator, start + 17);
        //     log(start, end, code, decoded, key, $(el)); // Debug logging


        //     // Replace




        //     start = html.indexOf(config.codeStart, end);
        // }
        // // Look through all text nodes and attributes

        // // Wrap accordingly or add class
        // $(el).attr('data-inscreen-translation', Object.keys(keys).join(','));

        // TODO inject
    // }

    updateProgressModal('Translation setup has completed.');
    showInScreenTranslator();
}

/**
 * 
 * @param {any} textNode 
 */
function wrapTextNode(textNode) {
    const spanNode = document.createElement('span');
    const newTextNode = document.createTextNode(textNode.textContent);
    spanNode.appendChild(newTextNode);
    textNode.parentNode.replaceChild(spanNode, textNode);
    return spanNode;
}

function showInScreenTranslator() {
    if (!translationInitialized) {
        const position = config.dialogPosition.positionUpdated ? [config.dialogPosition.left, config.dialogPosition.top ] : {
            my: "right bottom",
            at: "right-10 bottom-10",
            of: window
        };
        const settings = { 
            closeText: 'Close',
            title: 'In-Screen Translator',
            draggable: true,
            resizable: true,
            modal: false, 
            width: config.dialogPosition.sizeUpdated ? config.dialogPosition.width : '50%',
            height: config.dialogPosition.sizeUpdated ? config.dialogPosition.height : 'auto',
            minHeight: 300,
            minWidth: 400,
            position: position,
            closeOnEscape: true,
            close: handleInScreenTranslatorClosed,
            dragStop: saveInScreenTranslatorCoords,
            resizeStop: saveInScreenTranslatorCoords,
        }
        $dialog.dialog(settings);
        if (config.dialogPosition.positionUpdated) {
            // Unfortunate necessity, as otherwise the dialog appears pinned to the top left corner of <body>
            $dialog.dialog('widget').css('left', config.dialogPosition.left + 'px').css('top', config.dialogPosition.top + 'px');
        }
        // Capture keyboard (T = translate, M = metadata)
        $('body').on('keypress', keyPressed);
    }
    else {
        $dialog.dialog('open');
    }
    $dialog[0].scrollIntoView(false);
    log('In-Screen Translator dialog shown.', $dialog.dialog('option'));
}

function handleInScreenTranslatorClosed(event, ui) {
    log('In-Screen Translator dialog hidden.')
}

function saveInScreenTranslatorCoords(event, ui) {
    if (ui['position']) {
        config.dialogPosition.left = ui.position.left;
        config.dialogPosition.top = ui.position.top;
        config.dialogPosition.positionUpdated = true;
    }
    if (ui['size']) {
        config.dialogPosition.width = ui.size.width;
        config.dialogPosition.height = ui.size.height;
        config.dialogPosition.sizeUpdated = true;
    }
    JSMO.ajax('set-dialog-coordinates', config.dialogPosition)
    .then(function(response) {
        if (response.success) {
            log ('In-Screen Translatior dialog move/resized:', config.dialogPosition);
        }
    })
    .catch(function(err) {
        showToast('#translator-errorToast', 'Failed to store dialog coordinates. See console for details.');
        error('Failed to store dialog coordinates:', err);
    });
}

/**
 * Decodes an invisible code
 * @param {string} encoded 
 * @returns {InvisiCode}
 */
function decodeInvisiCode(encoded) {
    // Convert to binary
    const binary = encoded.split('').map(char => char == config.code0 ? '0' : '1').join('');
    return {
        binary: binary,
        int: Number.parseInt(binary, 2)
    };
}

/**
 * 
 * @param {HTMLElement} el 
 * @returns 
 */
function getTextAndAttributes(el) {
    const parts = [];
    const text = el.textContent;
    if (text != null) parts.push(text);
    for (const attr of el.attributes) {
        const attrText = attr.textContent;
        if (attrText != null) parts.push(attrText);
    }
    return parts.join(' ');
}

//#endregion

//#region Translation

/**
 * 
 * @param {string[]} items 
 * @param {boolean} showMeta
 */
function translateItems(items, showMeta = false) {
    log('Translating items' + (showMeta ? ' (metadata)' : '') + ':', items);
    // TODO
}

//#endregion

//#region Actions

/**
 * Handles actions (mouse clicks on links, buttons)
 * @param {JQuery.TriggeredEvent} event 
 */
function handleAction(event) {
    let $source = $(event.target)
    let action = $source.attr('data-action')
    if (!action) {
        $source = $source.parents('[data-action]')
        action = $source.attr('data-action')
    }
    if (!action || $source.prop('disabled')) return
    switch (action) {
        case 'refresh-translation': 
        {
            injectTranslationHooks();
        }
        break;
        default: 
        {
            log('Unknown action:', action);
        }
        break;
    }
}

//#endregion

//#region Keyboard
/**
 * 
 * @param {JQuery.KeyPressEvent} event 
 */
function keyPressed(event) {
    if (!'tm'.split('').includes(event.key)) return; // Ignore all except T and M
    const $target = $(event.target);
    if ($target.is('input:focus, textarea:focus')) return; // Ignore when an input/textarea has focus

    const $hover = $('[data-inscreen-translation]:hover');
    if ($hover.length > 0) {
        const items = ($hover.attr('data-inscreen-translation') ?? '').split(',');
        translateItems(items, event.key == 'm');
    }
}

//#endregion

//#region Progress Modal

function showProgressModal(text) {
    updateProgressModal(text, 0);
    log('Progress modal shown:', text);
}

function hideProgressModal() {
    log('Progress modal hidden.')
}

function updateProgressModal(text, percentage) {
    // Update text
    setProgressModalProgress(percentage);
    log('Progress update:', text, percentage);
}

function setProgressModalProgress(percentage) {
    // Update progress bar
}

//#endregion

//#region Helpers

/**
 * 
 * @param {string} name 
 * @returns {JavascriptModuleObject}
 */
 function resolveJSMO(name) {
    const parts = name.split('.');
    let jsmo;
    jsmo = window;
    for (const part of parts) {
        jsmo = jsmo[part];
    }
    return jsmo;
}

/**
 * Shows a message in a toast
 * @param {string} selector 
 * @param {string} msg 
 */
 function showToast(selector, msg) {
    const $toast = $(selector)
    $toast.find('[data-content=toast]').html(msg)
    // @ts-ignore
    $toast.toast('show')
}

//#endregion

//#region Debug Logging

/**
 * Logs a message to the console when in debug mode
 */
 function log() {
    if (!config.debug) return
    let ln = '??'
    try {
        const line = ((new Error).stack ?? '').split('\n')[2]
        const parts = line.split(':')
        ln = parts[parts.length - 2]
    }
    catch { }
    log_print(ln, 'log', arguments)
}
/**
 * Logs a warning to the console when in debug mode
 */
function warn() {
    if (!config.debug) return
    let ln = '??'
    try {
        const line = ((new Error).stack ?? '').split('\n')[2]
        const parts = line.split(':')
        ln = parts[parts.length - 2]
    }
    catch { }
    log_print(ln, 'warn', arguments)
}

/**
 * Logs an error to the console when in debug mode
 */
function error() {
    let ln = '??'
    try {
        const line = ((new Error).stack ?? '').split('\n')[2]
        const parts = line.split(':')
        ln = parts[parts.length - 2]
    }
    catch { }
    log_print(ln, 'error', arguments)
}

/**
 * Prints to the console
 * @param {string} ln Line number where log was called from
 * @param {'log'|'warn'|'error'} mode 
 * @param {IArguments} args 
 */
function log_print(ln, mode, args) {
    var prompt = APP_NAME + ' [' + ln + ']'
    switch(args.length) {
        case 1: 
            console[mode](prompt, args[0])
            break
        case 2: 
            console[mode](prompt, args[0], args[1])
            break
        case 3: 
            console[mode](prompt, args[0], args[1], args[2])
            break
        case 4: 
            console[mode](prompt, args[0], args[1], args[2], args[3])
            break
        case 5: 
            console[mode](prompt, args[0], args[1], args[2], args[3], args[4])
            break
        case 6: 
            console[mode](prompt, args[0], args[1], args[2], args[3], args[4], args[5])
            break
        default: 
            console[mode](prompt, args)
            break
    }
}

//#endregion

})();