/**
 * REDCap Translation Assistant - In-screen Translation Magic
 */

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
var $stringSelector = $('<select></select>');
var $saveButton = $('<button></button>');

var stringsInsideScript = {};
var stringsInPage = {};

var selectItems = [''];
var currentString = '';
var currentFilter = null;
var currentHighlighted = true;


// DEBUG ONLY - TODO: Set to false
const autostart = true;

/**
 * Initializes the REDCap Translator plugin page
 * @param {REDCapInScreenTranslator_Config} data 
 */
function init(data) {
    config = data;
    JSMO = resolveJSMO(config.jsmoName);

    $(function() {
        // Key capture
        $('body').on('keypress', keyPressed);
        // Dialog
        $dialog = $('#in-screen-translation-editor');
        // This keeps the dialog on top of other dialogs
        $(document).on("dialogopen", ".ui-dialog", function (event, ui) {
            if (event.target.dataset['translationWidget'] != 'in-screen-editor') {
                warn('New dialog detected:', event.target)
                try {
                    $dialog.dialog('moveToTop');
                }
                catch (ex) {
                    // Ignore
                }
            }
        });
        // Actions
        $dialog.find('[data-action]').on('click', handleAction);
        // Main elements
        $stringSelector = $dialog.find('[data-translator-item="current-key"]');
        $saveButton = $dialog.find('[data-action="save-changes"]');
        log('Initialized.', config);
        // Autostart
        if (config.auth && autostart) {
            translate();
        }
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
            preparePageForTranslation();
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
            preparePageForTranslation();
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
 * Recursively parses elements, drilling down the element tree
 * @param {HTMLElement} el Start element
 * @param {Number} counter A counter that's increased for each parsed element
 * @param {boolean} reprocess 
 * @returns 
 */
function processElement(el, counter, reprocess = false) {
    counter++;
    // Is there work to do? At least one code starter must be present
    if (!getTextAndAttributes(el).includes(config.codeStart)) return counter;
    log('Processing element:', $(el));
    const isScript = el.nodeName == 'SCRIPT';
    const isOption = el.nodeName == 'OPTION';

    //#region SCRIPT tags
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
    //#endregion
    //#region OPTION tags
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
        Object.keys(keys).forEach(key => $select.addClass('in-screen-id-'+ key));
    }
    //#endregion
    //#region Child nodes (except SCRIPT tags)
    if (!isScript && el.hasChildNodes()) {
        /** @type {HTMLElement|null} */
        let currentWrapper = null;
        const childNodes = []
        el.childNodes.forEach(child => {
            let add = true;
            if (child.nodeType == Node.ELEMENT_NODE) {
                add = add && !(reprocess && typeof $(child).attr('data-inscreen-translation') == 'string');
            } 
            if (add) {
                childNodes.push(child)
            }
        });
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
                const partialEnd = text.indexOf(config.stringTerminator);
                const end = text.indexOf(config.stringTerminator, start + 17);
                addPageKey(key);
                // Check if there is a terminator BEFORE the start
                if (partialEnd > -1 && partialEnd < start) {
                    // This implies that a wrapper must be open
                    if (currentWrapper == null) {
                        error('Processing error. Partial string with terminator and no wrapper!', $(el));
                    }
                    else {
                        // Add partial with end
                        const partial = document.createTextNode(text.substring(0, partialEnd));
                        currentWrapper.append(partial);
                        child.textContent = text.substring(end + 1);
                        currentWrapper = null;
                        // Is there more between?
                        if (text.substring(partialEnd + 1, start).trim() != '') {
                            // Add text node
                            el.insertBefore(document.createTextNode(text.substring(partialEnd + 1, start)), child);
                        }
                    }
                }
                // When the language string doesn't start at the beginning, add that part before as a text node
                if ((partialEnd == -1 || partialEnd > start) && start > 0) {
                    el.insertBefore(document.createTextNode(text.substring(0, start)), child);
                }
                // log ('Code / Decoded / Key:', code, decoded, key);
                // Prepend wrapper
                const span = document.createElement('span');
                const spanAttr = {'':{}};
                spanAttr[''][key] = true;
                span.setAttribute('data-inscreen-translation', JSON.stringify(spanAttr));
                span.classList.add('in-screen-id-' + key);
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
                    return processElement(el, counter -1, true);
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
    //#endregion
    //#region Attributes
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
                    el.classList.add('in-screen-id-' + key);
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
    //#endregion
    return counter;
}

/**
 * Looks for language strings in BODY and all nested elements
 */
function preparePageForTranslation() {
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
 * Updates (or initialzes) the translation dialog's string selector
 */
function updateStringSelector() {
    $stringSelector.html('<option value=""></option>');
    if (!$stringSelector.get(0)?.hasAttribute('data-select2-id') ?? false) {
        // @ts-ignore
        $stringSelector.select2({
            placeholder: 'Select an item',
            dropdownAutoWidth : true,
            data: selectItems.map(id => { return { id: id, text: id} })
        });
        $stringSelector.on('select2:open', function() {
            $('input[aria-controls="select2-translator-current-key-results"]').get(0)?.focus();
        });
        $stringSelector.on('change', currentItemChanged);
    }
    else {
        selectItems.map(key => $stringSelector.append(new Option(key, key)));
        $stringSelector.val(selectItems.includes(currentString) ? currentString : '').trigger('change');
    }
}

/**
 * Gets combined text and attributes content of an element
 * @param {HTMLElement} el 
 * @returns 
 */
function getTextAndAttributes(el) {
    const parts = [];
    const text = el.innerHTML ?? '';
    if (text != null) parts.push(text);
    for (const attr of el.attributes) {
        const attrText = attr.textContent;
        if (attrText != null) parts.push(attrText);
    }
    return parts.join(' ');
}

//#endregion

//#region Translation Dialog Setup

function showInScreenTranslator() {
    const settings = { 
        closeText: 'Close',
        title: '<i class="fas fa-exchange-alt small"></i>&nbsp;&nbsp;In-Screen Translator',
        draggable: true,
        resizable: true,
        modal: false, 
        width: config.dialogPosition.width,
        height: config.dialogPosition.height,
        minHeight: 480,
        minWidth: 540,
        position: [config.dialogPosition.left, config.dialogPosition.top],
        closeOnEscape: true,
        close: handleInScreenTranslatorClosed,
        dragStop: saveInScreenTranslatorCoords,
        resizeStop: saveInScreenTranslatorCoords,
    }
    $dialog.dialog(settings);
    // Visual
    $dialog.parents('div[role="dialog"]').css('border', '2px #337ab7 solid').find('.ui-dialog-titlebar').css('padding-left','0.6em');
    // Unfortunate necessity, as otherwise the dialog appears pinned to the top left corner of <body>
    $dialog.dialog('widget').css('left', config.dialogPosition.left + 'px').css('top', config.dialogPosition.top + 'px');
    $dialog.find('.textarea-autosize').textareaAutoSize();
    if (!translationInitialized) {
        // Capture toggles
        $('[data-inscreen-toggle]').on('change', updateToggles);
        $dialog[0].scrollIntoView(false);
    }
    log('In-Screen Translator dialog shown.', config.dialogPosition, $dialog.dialog('option'));
}


function handleInScreenTranslatorClosed(event, ui) {
    log('In-Screen Translator dialog hidden.');
    $dialog.dialog('destroy');
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
            log ('In-Screen Translatior dialog move/resized:', config.dialogPosition, ui);
        }
        if (config.dialogPosition.sizeUpdated) {
            // Fix display quirks by closing/re-opening
            $dialog.dialog('destroy');
            showInScreenTranslator();
        }
    })
    .catch(function(err) {
        showToast('#translator-errorToast', 'Failed to store dialog coordinates. See console for details.');
        error('Failed to store dialog coordinates:', err);
    });
}

//#endregion

//#region Translation Dialog Toggles

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
        case 'highlight-current': {
            currentHighlighted = state;
            updateItemHighlight();
        }
        break;
    }
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

function updateItemHighlight() {
    $('[data-inscreen-translation]').removeClass('in-screen-highlighted');
    if (currentHighlighted && currentString != '') {
        $('.in-screen-id-' + currentString).addClass('in-screen-highlighted');
    }
}

//#endregion

//#region Translation

/**
 * 
 * @param {Object} itemsObj 
 * @param {JQuery<Element>} $target
 */
function translateItems(itemsObj, $target) {
    log('Translating items:', itemsObj);

    /** @type {Object<string,Object<string,boolean>>} */
    const items = {};
    // Reformat
    for (const type of Object.keys(itemsObj)) {
        for (const key of Object.keys(itemsObj[type])) {
            const list = items[key] ?? {};
            list[type] = true;
            items[key] = list;
        }
    }
    const itemsList = Object.keys(items);
    if (itemsList.length > 1) {
        showItemSelectorPopover(items, $target);
    }
    else if (itemsList.length == 1) {
        setCurrentString(itemsList[0]);
    }
}

/**
 * 
 * @param {Object} itemsObj 
 * @param {JQuery<Element>} $target
 */
function toggleTranslation(itemsObj, $target) {
    log('Toggeling translations:', itemsObj);
    // TODO
}

/**
 * 
 * @param {Object<string,Object<string,boolean>>} items 
 * @param {JQuery<Element>} $target
 */
 function showItemSelectorPopover(items, $target) {
    log('Showing items selector for:', items, $target);
    // Helper functions
    // @ts-ignore
    const close = () => $target.popover('dispose');
    const goto = (e) => {
        setCurrentString(e.target.textContent);
        close();
    };
    // Construct body
    const $body = $('<div></div>');
    const $ul = $('<ul class="in-screen-items-list"></ul>');
    const sortedItems = Object.keys(items).sort();
    for (const key of sortedItems) {
        const $li = $('<li></li>');
        const $a = $('<a href="#">' + key + '</a>').on('click', goto);
        $li.append($a);
        for (const type of Object.keys(items[key])) {
            // Add attribute pills
            if (type != '') {
                const $badge = $('<span class="badge badge-info badge-sm ml-1">' + type + '</span>');
                $li.append($badge);
            }
        }
        $ul.append($li);
    }
    $body.append($ul);
    const $filter = $('<button class="btn btn-link btn-xs">Set as filter</button>').on('click', () => {
        close();
        currentFilter = {
            limitTo: Object.keys(items)
        };
        filterItems();
        openStringSelector();
    });
    const $cancel = $('<button class="btn btn-link btn-xs">Cancel</button>').on('click', close);
    $body.append($filter, $cancel);
    // @ts-ignore
    $target.popover({
        title: 'Multiple strings detected!',
        html: true,
        content: $body,
        trigger: 'manual'
    }).popover('show');
}

function setCurrentString(key) {
    if (key != '') {
        // Does the string exists?
        if (key != '' && !(config.metadata.strings[key] ?? false)) {
            const msg = 'String \'' + key + '\' does not exist!';
            warn(msg);
            return;
        }
        // Ensure that the string is in the list of items shown in the string selector
        if (!selectItems.includes(key)) {
            selectItems.push(key);
            selectItems.sort();
            updateStringSelector();
        }
    }
    $stringSelector.val(key).trigger('change');
}

/**
 * Opens the string selector
 */
function openStringSelector() {
    // @ts-ignore
    $stringSelector.select2('open');
}

/**
 * Updates the dialog when a new string is selected for editing
 * @param {JQuery.ChangeEvent} event 
 */
function currentItemChanged(event) {
    currentString = ($stringSelector.val() ?? '').toString();
    log('Current item changed:', currentString);
    updateItemHighlight();
    if (currentString != '') {
        updateTranslationDialog();
    }
}

function updateTranslationDialog() {
    log('Setting dialog to translate:', currentString);
}

//#endregion

//#region Filtering

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
    openStringSelector();
}


function filterItems() {
    log('Filtering items:', currentFilter);
    const $clearFilterButton = $('[data-action="clear-filter"]');
    $clearFilterButton.prop('disabled', currentFilter == null).toggleClass('text-danger', currentFilter != null);
    if (currentFilter?.limitTo ?? false) {
        selectItems = currentFilter.limitTo.sort();
    }
    else if (currentFilter?.all ?? false) {
        selectItems = Object.keys(config.metadata.strings).filter(key => matchFilter(key)).sort();
    }
    else {
        selectItems = Object.keys(stringsInPage).filter(key => matchFilter(key)).sort();
    }
    updateStringSelector();
}

function clearFilter() {
    log('Clearing items filter.');
    currentFilter = null;
    filterItems();
}

function matchFilter(key) {
    if (currentFilter === null) return true;

    // TODO apply filter
    return key.substring(0, 1) == 'b';
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
            preparePageForTranslation();
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
    // Ignore all except (e)dit, (r)efresh, (t)oggle, (T)ranslate
    if (!'ertT'.split('').includes(event.key)) return;
    const $target = $(event.target);
    // Ignore when an input/textarea has focus
    if ($target.is('input:focus, textarea:focus')) return;
    // (T)ranslate
    if (event.key == 'T') {
        if (!config.auth && !translationInitializing) {
            // Prompt for password
            // TODO
            const password = '';
            translate(password);
        }
        else {
            translate();
        }
    }
    // Only pay attention to others once translation has been initialized
    if (translationInitialized) {
        if (event.key == 'r') {
            translate();
        }
        else {
            const hoverEls = document.querySelectorAll('[data-inscreen-translation]:hover');
            if (hoverEls.length) {
                const $hover = $(hoverEls.item(hoverEls.length - 1));
                if ($hover.length > 0) {
                    const items = JSON.parse($hover.attr('data-inscreen-translation') ?? '{"":{}}');
                    if (event.key == 'e') {
                        translateItems(items, $hover);
                    }
                    else if (event.key == 't') {
                        toggleTranslation(items, $hover);
                    }
                }

            }
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

function addPageKey(key) {
    stringsInPage[key] = (stringsInPage[key] ?? 0) + 1;
}

function addScriptKey(key) {
    stringsInsideScript[key] = (stringsInsideScript[key] ?? 0) + 1;
    addPageKey(key);
}

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

//#region Libs
/*!
 * jQuery Textarea AutoSize plugin : https://github.com/javierjulio/textarea-autosize
 * Author: Javier Julio
 * Licensed under the MIT license
 */
// @ts-ignore
(function(t,e,i,n){function s(e,i){this.element=e,this.$element=t(e),this.init()}var h="textareaAutoSize",o="plugin_"+h,r=function(t){return t.replace(/\s/g,"").length>0};s.prototype={init:function(){var i=parseInt(this.$element.css("paddingBottom"))+parseInt(this.$element.css("paddingTop"))+parseInt(this.$element.css("borderTopWidth"))+parseInt(this.$element.css("borderBottomWidth"))||0;r(this.element.value)&&this.$element.height(this.element.scrollHeight-i),this.$element.on("input keyup",function(n){var s=t(e),h=s.scrollTop();t(this).height(0).height(this.scrollHeight-i),s.scrollTop(h)})}},t.fn[h]=function(e){return this.each(function(){t.data(this,o)||t.data(this,o,new s(this,e))}),this}})(jQuery,window,document);
//#endregion