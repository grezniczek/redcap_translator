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

var stringsInsideScript = {};
var stringsInPage = {};

var selectItems = [];
var currentString = '';
var currentFilter = null;

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


function addPageKey(key) {
    stringsInPage[key] = (stringsInPage[key] ?? 0) + 1;
}

function addScriptKey(key) {
    stringsInsideScript[key] = (stringsInsideScript[key] ?? 0) + 1;
    addPageKey(key);
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
    if (!getTextAndAttributes(el).includes(config.codeStart)) return counter;

    log('Processing element:', $(el));

    const isScript = el.nodeName == 'SCRIPT';
    const isOption = el.nodeName == 'OPTION';

    // Is this a script tag?
    if (isScript && el.textContent?.includes(config.codeStart)) {
        const text = el.textContent ?? '';
        let start = 0;
        start = text.indexOf(config.codeStart, start);
        while (start > -1) {
            const code = text.substring(start + 1, start + 17);
            const decoded = decodeInvisiCode(code);
            const key = config.keys[decoded.int];
            const end = text.indexOf(config.stringTerminator, start + 17);
            addScriptKey(key);
            start = text.indexOf(config.codeStart, end);
        }
    }

    if (isOption && el.textContent?.includes(config.codeStart)) {
        const keys = {};
        let text = el.textContent ?? '';
        let start = 0;
        start = text.indexOf(config.codeStart, start);
        while (start > -1) {
            const code = text.substring(start + 1, start + 17);
            const decoded = decodeInvisiCode(code);
            const key = config.keys[decoded.int];
            const end = text.indexOf(config.stringTerminator, start + 17);
            keys[key] = true;
            addPageKey(key);
            start = text.indexOf(config.codeStart, end);
            text = text.replace(config.codeStart + code, '').replace(config.stringTerminator, '');
            start = text.indexOf(config.codeStart, start);
        }
        el.textContent = text;
        const $select = $(el).parents('select');
        const attrVal = $select.attr('data-inscreen-translation') ?? '{"":{}}';
        const attrObj = JSON.parse(attrVal);
        Object.keys(attrObj['']).map(key => keys[key] = true);
        $select.attr('data-inscreen-translation', JSON.stringify({'':keys}));
    }

    // Inspect and process all child nodes (not for SCRIPT tags)
    if (!isScript && el.hasChildNodes()) {
        /** @type {HTMLElement|null} */
        let currentWrapper = null;
        const childNodes = []
        el.childNodes.forEach(child => childNodes.push(child));
        for (const child of childNodes) {
            if (child.nodeType == Node.TEXT_NODE && child.textContent?.includes(config.codeStart)) {
                log('Processing text child:', $(child), $(el));
                const text = child.textContent;
                // This could be a language string or have additional content or be only a partial language string or 
                // even be multiple language strings
                let start = 0;
                start = text.indexOf(config.codeStart, start);
                const code = text.substring(start + 1, start + 17);
                const decoded = decodeInvisiCode(code);
                const key = config.keys[decoded.int];
                addPageKey(key);
                // log ('Code / Decoded / Key:', code, decoded, key);
                const end = text.indexOf(config.stringTerminator, start + 17);
                // Prepend wrapper
                const span = document.createElement('span');
                const spanAttr = {'':{}};
                spanAttr[''][key] = true;
                span.setAttribute('data-inscreen-translation', JSON.stringify(spanAttr));
                el.insertBefore(span, child);
                if (end < 0) {
                    // There is no end, thus append complete text node and set currentWrapper
                    span.appendChild(child);
                    child.textContent = child.textContent.replace(code, '').replace(config.codeStart, '');
                    currentWrapper = span;
                }
                else {
                    // Add without code and reprocess
                    const space = (start == 1 && text.substring(0, 1) == ' ') ? ' ' : '';
                    const partial = document.createTextNode(space + text.substring(start + 17, end));
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
        const attrKeys = {};
        for (const attr of el.attributes) {
            let text = attr.textContent ?? '';
            if (text.includes(config.codeStart)) {
                log('Processing attribute:', attr.name, $(el));
                // Find all keys and remove codes
                let start = 0;
                start = text.indexOf(config.codeStart, start);
                while (start > -1) {
                    const code = text.substring(start + 1, start + 17);
                    const decoded = decodeInvisiCode(code);
                    const key = config.keys[decoded.int];
                    addPageKey(key);
                    const end = text.indexOf(config.stringTerminator, start + 17);
                    attrKeys[attr.name] = attrKeys[attr.name] ?? {};
                    attrKeys[attr.name][key] = true;
                    text = text.replace(config.codeStart + code, '').replace(config.stringTerminator, '');
                    start = text.indexOf(config.codeStart, start);
                }
                attr.textContent = text;
            }
        }
        // Add keys to element
        if (Object.keys(attrKeys).length) {
            el.setAttribute('data-inscreen-translation', JSON.stringify(attrKeys));
        }
    }
    return counter;
}

function injectTranslationHooks() {
    log('Injecting hooks ...');

    const nTotal = $('body *').length;
    log('Processing ' + nTotal + ' elements ...');
    let i = 0; // Keep track of progress
    const nProcessed = processElement(document.body, i);
    log('Elements processed: ' + nProcessed);
    log('Script strings:', stringsInsideScript);

    filterItems();


    updateProgressModal('Translation setup has completed.');
    showInScreenTranslator();
}


/**
 * 
 */
function initSelect() {
    const $select = $('[data-translator-item="current-key"]');
    $select.html('');
    if (!$select[0].hasAttribute('data-select2-id')) {
        // @ts-ignore
        $select.select2({
            placeholder: 'Select an item',
            dropdownAutoWidth : true,
            data: selectItems.map(id => { return { id: id, text: id} })
        });
        $select.on('select2:open', function() {
            $('input[aria-controls="select2-translator-current-key-results"]').get(0)?.focus();
        });
    }
    else {
        selectItems.map(key => $select.append(new Option(key, key)));
        $select.val(selectItems.includes(currentString) ? currentString : '').trigger('change');
    }
}

function showItemsFilter() {
    log('Showing the items filter.')
    // TODO - Show modal

    applyItemsFilter();
}

function applyItemsFilter() {
    // TODO - construct filter object
    currentFilter = {
        translated: false
    };
    filterItems();
    openSelect();
}

function openSelect() {
    // @ts-ignore
    $('[data-translator-item="current-key"]').select2('open');
}

function filterItems() {
    log('Filtering items:', currentFilter);
    const $clearFilterButton = $('[data-action="clear-filter"]');
    $clearFilterButton.prop('disabled', currentFilter == null).toggleClass('text-danger', currentFilter != null);
    selectItems = Object.keys(stringsInPage).filter(key => matchFilter(key)).sort();
    initSelect();
}

function clearFilter() {
    log('Clearing items filter.');
    currentFilter = null;
    filterItems();
    openSelect();
}

function matchFilter(key) {
    if (currentFilter === null) return true;

    // TODO apply filter
    return key.substring(0, 1) == 'b';
}

function highlightTranslationStatus(state) {
    $('[data-inscreen-translation]').each(function() {
        const $this = $(this);
        if (state) {
            const keys = getTranslationKeys($this);
            const state = {
                outdated: false,
                translate: false,
                translated: false,
                'do-not-translate': false
            };
            for (const key of keys) {
                const meta = config.metadata.strings[key];
                const translation = config.translation.strings[key] ?? generateEmptyStringTranslation(key);
                try {
                    if (translation["do-not-translate"] == true) {
                        state['do-not-translate'] = true;
                    }
                    else if (translation.translations.hasOwnProperty(meta.hash)) {
                        state['translated'] = true;
                    }
                    else if ((translation.translations[''] ?? '').length) {
                        state['outdated'] = true;
                    }
                    else {
                        state['translate'] = true;
                    }
                }
                catch (err) {
                    error('Exception during determination of translation status:', err)
                }
            }
            $this.attr('data-inscreen-status', getTranslationStatus(state));
        }
        else {
            $this.removeAttr('data-inscreen-status');
        }
    });
}

function generateEmptyStringTranslation(key) {
    return {
        key: key,
        'do-not-translate': null,
        annotation: '',
        translations: {}
    };
}

function getTranslationStatus(state) {
    for(const key of ['translate', 'outdate', 'do-not-translate', 'translated']) {
        if (state[key] == true) return key;
    }
    return 'translate';
}

function getTranslationKeys($el) {
    const raw = $el.attr('data-inscreen-translation');
    const keyObj = JSON.parse(raw);
    const keys = {};
    // Extract keys
    for (const name in keyObj) {
        for (const key of Object.keys(keyObj[name])) {
            keys[key] = true;
        }
    }
    return Object.keys(keys);
}

/**
 * Handles actions (mouse clicks on links, buttons)
 * @param {JQuery.ChangeEvent} event 
 */
function updateToggles(event) {
    const $toggle = $(event.target);
    const name = $toggle.attr('data-inscreen-toggle') ?? '';
    const state = $toggle.prop('checked');
    log('Handling toggle:', name, state);
    switch (name) {
        case 'highlight-translation-status': {
            highlightTranslationStatus(state);
        }
        break;
    }
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
        // Capture toggles
        $('[data-inscreen-toggle]').on('change', updateToggles);
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
            injectTranslationHooks();
            break;
        case 'filter-items': 
            showItemsFilter();
            break;
        case 'clear-filter': 
            clearFilter();
            break;
        default: 
            log('Unknown action:', action);
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
    if (!'mrtT'.split('').includes(event.key)) return; // Ignore all except m, t, T, and R
    const $target = $(event.target);
    if ($target.is('input:focus, textarea:focus')) return; // Ignore when an input/textarea has focus

    if (event.key == 'r') {
        translate();
    }
    if (event.key == 'T') {
        translate();
    }
    else {
        const $hover = $('[data-inscreen-translation]:hover');
        if ($hover.length > 0) {
            const items = ($hover.attr('data-inscreen-translation') ?? '').split(',');
            translateItems(items, event.key == 'm');
        }
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