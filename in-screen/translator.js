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
var $codeButton = $('<button></button>');
var $saveCloak;

var stringsInsideScript = {};
var stringsInPage = {};

var selectItems = [''];
var currentString = '';
var currentFilter = null;
var currentHighlighted = true;
var currentHash = '';

const showOriginalCache = {}



// DEBUG ONLY - TODO: Set to false
const autostart = true;

/**
 * Initializes the REDCap Translator plugin page
 * @param {REDCapInScreenTranslator_Config} data 
 */
function init(data) {
    config = data;
    JSMO = resolveJSMO(config.jsmoName);
    config.stringRegex = new RegExp(config.codeStart + '(?<code>' + 
        '[' + config.code0 + config.code1 + ']' + 
        '[' + config.code0 + config.code1 + ']' + 
        '[' + config.code0 + config.code1 + ']' + 
        '[' + config.code0 + config.code1 + ']' + 
        '[' + config.code0 + config.code1 + ']' + 
        '[' + config.code0 + config.code1 + ']' + 
        '[' + config.code0 + config.code1 + ']' + 
        '[' + config.code0 + config.code1 + ']' + 
        '[' + config.code0 + config.code1 + ']' + 
        '[' + config.code0 + config.code1 + ']' + 
        '[' + config.code0 + config.code1 + ']' + 
        '[' + config.code0 + config.code1 + ']' + 
        '[' + config.code0 + config.code1 + ']' + 
        '[' + config.code0 + config.code1 + ']' + 
        '[' + config.code0 + config.code1 + ']' + 
        '[' + config.code0 + config.code1 + ']' + 
        ')(?<text>[^' + config.codeStart + ']+)(?<terminator>' + config.stringTerminator + ')', 'ms');
    config.codeRegex = new RegExp(config.codeStart + '(?<code>' + 
        '[' + config.code0 + config.code1 + ']' + 
        '[' + config.code0 + config.code1 + ']' + 
        '[' + config.code0 + config.code1 + ']' + 
        '[' + config.code0 + config.code1 + ']' + 
        '[' + config.code0 + config.code1 + ']' + 
        '[' + config.code0 + config.code1 + ']' + 
        '[' + config.code0 + config.code1 + ']' + 
        '[' + config.code0 + config.code1 + ']' + 
        '[' + config.code0 + config.code1 + ']' + 
        '[' + config.code0 + config.code1 + ']' + 
        '[' + config.code0 + config.code1 + ']' + 
        '[' + config.code0 + config.code1 + ']' + 
        '[' + config.code0 + config.code1 + ']' + 
        '[' + config.code0 + config.code1 + ']' + 
        '[' + config.code0 + config.code1 + ']' + 
        '[' + config.code0 + config.code1 + '])', 'ms');

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
        // Useability improvement: Take away focus from input elements to force update of save button state
        // Need to add to parent because disabled elements won't trigger
        $saveButton.parent().on('pointerenter', () => {
            $(':focus').trigger('blur');
        });
        $codeButton = $dialog.find('[data-action="view-code"]');
        $saveCloak = $dialog.find('.in-screen-saving-cloak');
        $saveCloak.hide();
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
            config.codeLens = config.codeLens && response.codeLens;
            log('Translation, metadata, and keys loaded.', config);
            updateProgressModal('Preparing page for translation ...', 5);
            preparePageForTranslation();
            translationInitialized = true;
        }
        else {
            errorMsg = response.error;
        }
        // Add warning when user tries to move away with unsaved changes
        window.addEventListener('beforeunload', function (e) {
            if (isDirty()) {
                // Cancel the event
                e.preventDefault(); // If you prevent default behavior in Mozilla Firefox prompt will be allways shown
                // Chrome requires returnValue to be set
                e.returnValue = '';
            }
            else {
                delete e['returnValue'];
            }
        })
    })
    .catch(function(err) {
        errorMsg = err;
    })
    .finally(function() {
        if (errorMsg != '') {
            showError('Failed to load translation data.', errorMsg);
        }
        translationInitializing = false;
        setTimeout(() => {
            hideProgressModal();
            log('Initialization complete.', config);
        }, 200);
    });
}


/**
 * 
 * @param {string} text 
 * @param {Number} start 
 * @param {string[]} nested 
 * @return {Number}
 */
function findEnd(text, start, nested) {
    let end = text.indexOf(config.stringTerminator, start + 17);
    let nstart = text.indexOf(config.codeStart, start + 17);
    if (nstart > -1 && nstart < end) {
        // Nested string
        const code = text.substring(nstart + 1, nstart + 17);
        const decoded = decodeInvisiCode(code);
        const key = config.keys[decoded.int];
        nested.push(key);
        const nend = text.indexOf(config.stringTerminator, nstart + 17);
        end = text.indexOf(config.stringTerminator, nend + 1);
    }
    return end;
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
                const text = '' + child.textContent ?? '';
                // This could be a language string or have additional content or be only a partial language string or 
                // even be multiple language strings
                let start = 0;
                start = text.indexOf(config.codeStart, start);
                const code = text.substring(start + 1, start + 17);
                const decoded = decodeInvisiCode(code);
                const key = config.keys[decoded.int];
                const partialEnd = text.indexOf(config.stringTerminator);
                const keys = [key];
                const end = findEnd(text, start, keys); // text.indexOf(config.stringTerminator, start + 17);
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
                // Prepend wrapper
                const span = document.createElement('span');
                const spanAttr = {'':{}};
                keys.forEach(key => { 
                    addPageKey(key);
                    spanAttr[''][key] = true 
                    span.classList.add('in-screen-id-' + key);
                });
                span.setAttribute('data-inscreen-translation', JSON.stringify(spanAttr));
                el.insertBefore(span, child);
                if (end < 0) {
                    // There is no end, thus append complete text node and set currentWrapper
                    span.appendChild(child);
                    child.textContent = text.replaceAll(config.codeStart, '').replaceAll(config.code0, '').replaceAll(config.code1, '');
                    currentWrapper = span;
                }
                else {
                    // Add without code and reprocess
                    const space = (start == 1 && text.substring(0, 1) == ' ') ? ' ' : '';
                    const partial = document.createTextNode(space + text.substring(start + 17, end).replaceAll(config.codeStart, '').replaceAll(config.code0, '').replaceAll(config.code1, ''));
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
    if (!config.codeLens) $codeButton.hide();
    // Inject translations
    for (const key of Object.keys(stringsInPage)) {
        setShowOriginalState(key, showOriginalCache[key] ?? false);
    }
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
        minWidth: 600,
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
        // Change tracking
        $dialog.find('.in-screen-translation-items, .in-screen-metadata-items').on('change', dialogDataChanged);
        $dialog.find('textarea[data-inscreen-content], input[data-inscreen-content]').on('blur', dialogDataChanged);
    }
    setDialogData();
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
        showError('Failed to store dialog coordinates.', err);
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
        case 'show-original': {
            setShowOriginalState(currentString, state);
        }
        break;
    }
}

/**
 * 
 * @param {boolean} state 
 */
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
    setDialogData();
    updateItemHighlight();
    $codeButton.prop('disabled', currentString == '');
}

function setDialogData() {
    const metadata = getStringMetadata(currentString);
    if (!metadata) {
        currentHash = '';
        currentString = '';
    }
    else {

        const translation = getStringTranslation(currentString);
        log('Setting dialog to translate:', metadata, translation);
        const translatedText = getTranslation(currentString);
        // Translation pane
        $dialog.find('[data-inscreen-content="translation"]').val(translatedText.text);
        $dialog.find('[data-inscreen-content="do-not-translate"]').prop('checked', translation["do-not-translate"]);
        $dialog.find('[data-inscreen-content="metadata-text"]').text(metadata.text);
        $dialog.find('[data-inscreen-content="translation-annotation"]').val(translation.annotation);
        $dialog.find('[data-inscreen-toggle="show-original"]').prop('checked', getShowOriginalState(currentString));
        // Metadata pane
        // Badges
        $dialog.find('[data-inscreen-badge="new"]')[metadata.new == true ? 'show' : 'hide']();
        $dialog.find('[data-inscreen-badge="changed"]')[metadata.changed == true ? 'show' : 'hide']();
        $dialog.find('[data-inscreen-badge="interpolated"]')[metadata.interpolated > 0 ? 'show' : 'hide']();
        $dialog.find('[data-inscreen-badge="untranslated"]')[metadata.translate && translatedText.text == '' ? 'show' : 'hide']();
        $dialog.find('[data-inscreen-badge="outdated"]')[translatedText.text != '' && !translatedText.isMatch ? 'show' : 'hide']();
        // HTML Support
        $dialog.find('[data-inscreen-content="html-supported"]').prop('checked', metadata.html === true);
        $dialog.find('[data-inscreen-content="html-not-supported"]').prop('checked', metadata.html === false);
        // Length Restriction
        $dialog.find('[data-inscreen-content="length-restricted-no"]').prop('checked', metadata["length-restricted"] === false);
        $dialog.find('[data-inscreen-content="length-restricted-yes"]').prop('checked', metadata["length-restricted"] !== false && metadata["length-restricted"] !== null);
        if (metadata["length-restricted"]) {
            $dialog.find('[data-inscreen-content="length-restricted-px"]').val(metadata["length-restricted"]);
        }
        // Interpolations
        const $interpolations = $dialog.find('[data-inscreen-container="interpolations"]');
        // Clear and add
        $interpolations.html(''); 
        let i = 0;
        for (const row of metadata["interpolation-hints"]) {
            i++;
            const id = 'interpolation-hint_' + i;
            const $row = getTemplate('interpolation-hint');
            $row.find('label').attr('for', id).text(row.id + ' =');
            $row.find('[data-inscreen-content="interpolation-hint"]').attr('id', id).val(row.hint).attr('data-inscreen-index', row.id);
            $interpolations.append($row);
        }
        $interpolations.find('.textarea-autosize').textareaAutoSize();
        
        // Annotation
        $dialog.find('[data-inscreen-content="metadata-annotation"]').val(metadata.annotation);
        
        // Split and translation
        $dialog.find('[data-inscreen-content="metadata-split"]').prop('checked', metadata.split);
        $dialog.find('[data-inscreen-content="metadata-do-not-translate"]').prop('checked', !metadata.translate);
        
        // Set initial hash
        currentHash = getHash(getDialogData());
    }
    updateDialog();
}

/**
 * Generates a hash value
 * @param {any} obj 
 * @returns {string} 
 */
function getHash(obj) {
    // @ts-ignore Third-party lib
    return objectHash(obj);
}

function isDirty() {
    if (currentHash == '') return false;
    // @ts-ignore
    return currentHash != getHash(getDialogData());
}

/**
 * 
 * @returns {DialogData}
 */
function getDialogData() {
    /** @type {DialogData} */
    const data = {
        translationText: $('[data-inscreen-content="translation"]').val()?.toString() ?? '',
        translationDoNotTranslate: $('[data-inscreen-content="do-not-translate"]').prop('checked'),
        translationAnnotation: $('[data-inscreen-content="translation-annotation"]').val()?.toString() ?? '',
        metadataHTMLSupport: $('[data-inscreen-content="html-supported"]').prop('checked') ? true : ($('[data-inscreen-content="html-not-supported"]').prop('checked') ? false : null),
        metadataLengthRestricted:  $('[data-inscreen-content="length-restricted-yes"]').prop('checked') ? true : ($('[data-inscreen-content="length-restricted-no"]').prop('checked') ? false : null),
        metadataLengthRestrictedPx:  $('[data-inscreen-content="length-restricted-px"]').val()?.toString() ?? '',
        metadataAnnotation: $('[data-inscreen-content="metadata-annotation"]').val()?.toString() ?? '',
        metadataSplit: $('[data-inscreen-content="metadata-split"]').prop('checked'),
        metadataDoNotTranslate: $('[data-inscreen-content="metadata-do-not-translate"]').prop('checked'),
        metadataInterpolationHints: []
    };
    $('textarea[data-inscreen-content="interpolation-hint"]').each(function() {
        const $this = $(this);
        data.metadataInterpolationHints.push({
            id: $this.attr('data-inscreen-index') ?? '',
            hint: ($this.val() ?? '').toString()
        });
    });
    return data;
}

function updateDialog() {
    if (currentString == '') {
        $dialog.find('[data-inscreen-visibility="no-item-selected"]').show();
        $dialog.find('[data-inscreen-visibility="item-selected"]').hide();
        setSaveButtonState(false);
    }
    else {
        const data = getDialogData();
        const metadata = config.metadata.strings[currentString];
        $dialog.find('[data-inscreen-visibility="no-item-selected"]').hide();
        $dialog.find('[data-inscreen-visibility="item-selected"]').show();

        $dialog.find('[data-inscreen-visibility="html-support"]')[data.metadataHTMLSupport === null ? 'hide' : 'show']();
        $dialog.find('[data-inscreen-visibility="length-restricted"]')[data.metadataLengthRestricted === true ? 'show' : 'hide']();
        $dialog.find('[data-inscreen-visibility="length-restriction"]')[data.metadataLengthRestricted === null ? 'hide' : 'show']();

        $dialog.find('[data-inscreen-visibility="interpolated"]')[metadata.interpolated > 0 ? 'show' : 'hide']();
        // Save button state
        setSaveButtonState(isDirty());
        $dialog.find('.textarea-autosize').trigger('input');
    }
}

/**
 * Sets the state of the Save Changes button
 * @param {boolean} stuffToSave 
 */
function setSaveButtonState(stuffToSave) {
    if (stuffToSave) {
        $saveButton.prop('disabled', false).addClass('btn-warning').removeClass('btn-light');
    }
    else {
        $saveButton.prop('disabled', true).addClass('btn-light').removeClass('btn-warning');
    }
}

function dialogDataChanged(event) {
    updateDialog();
}


/**
 * 
 * @param {string} key 
 * @returns boolean
 */
function getShowOriginalState(key) {
    showOriginalCache[key] = showOriginalCache[key] ?? false;
    return showOriginalCache[key];
}

/**
 * 
 * @param {string} key 
 * @param {boolean} showOriginal 
 */
function setShowOriginalState(key, showOriginal) {
    if (!config.metadata.strings.hasOwnProperty(key)) return;
    log('Showing ' + (showOriginal ? 'original' : 'translation') + ' of item ' + key);
    showOriginalCache[key] = showOriginal;
    let text = showOriginal ? getOriginal(key) : getTranslation(key).text;
    if (text == '') return;
    const meta = config.metadata.strings[key];
    // Update each item
    $('.in-screen-id-' + key).each(function() {
        const $this = $(this);
        if (meta.interpolated > 0) {
            // This item is interpolated. It should have a parent with data-rc-lang-values
            const $parents = $this.parents('[data-rc-lang-values]');
            if ($parents.length) {
                const encodedVals = atob($parents.first().attr('data-rc-lang-values')?.toString() ?? '');
                const vals = encodedVals == '' ? {} : JSON.parse(encodedVals);
                // @ts-ignore base.js
                text = interpolateString(text, vals);
            }
        }
        $this.html(text);
    });
}


/**
 * 
 * @param {string} key 
 * @returns {TranslatedString}
 */
function getTranslation(key) {
    const metadata = getStringMetadata(key);
    if (!metadata) {
        warn('Cannot translate item \'' + key + '\'.');
        return { text: '', isMatch: false };
    }
    const translation = getStringTranslation(key);
    if (translation.translations.hasOwnProperty(metadata.hash)) {
        return {
            text: translation.translations[metadata.hash],
            isMatch: true
        };
    }
    return {
        text: translation.translations[''] ?? '',
        isMatch: false
    };
}

/**
 * 
 * @param {string} key 
 * @returns {string}
 */
function getOriginal(key) {
    return config.metadata.strings[key]?.text ?? '';
}

/**
 * 
 * @param {string} key 
 * @returns {StringMetadata}
 */
function getStringMetadata(key) {
    return config.metadata.strings[key] ?? null;
}

/**
 * 
 * @param {string} key 
 * @returns {StringTranslation}
 */
function getStringTranslation(key) {
    if (!config.translation.strings.hasOwnProperty(key)) {
        config.translation.strings[key] = generateEmptyStringTranslation(key);
    }
    return config.translation.strings[key];
}

function saveChanges() {
    if (currentString == '') return;
    $saveCloak.show();
    const data = getDialogData();
    const newHash = getHash(data);
    data['key'] = currentString;
    data['version'] = config.basedOn;
    data['language'] = config.name;
    log('Saving changes for \'' + currentString + '\'', data);
    JSMO.ajax('save-changes', data)
    .then(response => {
        if (response.success) {
            // Update item
            config.translation.strings[currentString] = response.updated;
            // Update hash
            currentHash = newHash;
            setSaveButtonState(false);
            setShowOriginalState(currentString, $('[data-inscreen-toggle="show-original"]').prop('checked'));
        }
        else {
            showError('Failed to save changes.', response.error);
        }
    })
    .catch(err => {
        showError('Failed to save changes.', err);
    })
    .finally(() => {
        $saveCloak.hide();
    });
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

//#region Code Lens

function displayCode(key) {
    warn('CodeLens - Not implemented yet.', key);

    // Display a new tab with code view - if multiple locations, show a menu only (without preloading the first file).
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
        case 'save-changes':
            saveChanges();
            break;
        case 'copy-metadata-text':
            // @ts-ignore base.js
            copyTextToClipboard($('[data-inscreen-content="metadata-text"]').text());
            break;
        case 'copy-translation':
            // @ts-ignore base.js
            copyTextToClipboard($('[data-inscreen-content="translation"]').val());
            break;
        case 'copy-translation-annotation':
            // @ts-ignore base.js
            copyTextToClipboard($('[data-inscreen-content="translation-annotation"]').val());
            break;
        case 'copy-metadata-annotation':
            // @ts-ignore base.js
            copyTextToClipboard($('[data-inscreen-content="metadata-annotation"]').val());
            break;
        case 'reset-html-support':
            $dialog.find('[data-inscreen-content="html-supported"]').prop('checked', false);
            $dialog.find('[data-inscreen-content="html-not-supported"]').prop('checked', false).trigger('change');
            break;
        case 'reset-length-restricted':
            $dialog.find('[data-inscreen-content="length-restricted-no"]').prop('checked', false);
            $dialog.find('[data-inscreen-content="length-restricted-yes"]').prop('checked', false);
            $dialog.find('[data-inscreen-content="length-restricted-px"]').val('').trigger('change');
            break;
        case 'view-code':
            if (currentString != '') {
                displayCode(currentString)
            }
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
                const $hover = $(hoverEls.item(0));
                const items = {'':{}};
                hoverEls.forEach(el => {
                    const elItems = JSON.parse(el.getAttribute('data-inscreen-translation') ?? '{"":{}}');
                    for (const type in elItems) {
                        if (!items.hasOwnProperty(type)) {
                            items[type] = {};
                        }
                        for (const key in elItems[type]) {
                            items[type][key] = true;
                        }
                    }
                });
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
 * Gets a template by name and returns its jQuery representation
 * @param {string} name 
 * @returns {JQuery<HTMLElement>}
 */
function getTemplate(name) {
    var $tpl = $($dialog.find('[data-template="' + name + '"]').html())
    return $tpl
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
 * @param {string} key 
 * @returns {StringTranslation}
 */
function generateEmptyStringTranslation(key) {
    return {
        key: key,
        'do-not-translate': null,
        annotation: '',
        translations: {}
    };
}

/**
 * 
 * @param {TranslationState} state 
 * @returns {string}
 */
function getTranslationStatus(state) {
    for(const key of ['translate', 'outdated', 'do-not-translate', 'translated']) {
        if (state[key] == true) return key;
    }
    return 'translate';
}

/**
 * 
 * @param {JQuery<HTMLElement>} $el 
 * @returns {string[]}
 */
function getTranslationKeys($el) {
    const raw = $el.attr('data-inscreen-translation') ?? '';
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
 * 
 * @param {string} key 
 */
function addPageKey(key) {
    stringsInPage[key] = (stringsInPage[key] ?? 0) + 1;
}

/**
 * 
 * @param {string} key 
 */
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
 * Reports an error (as toast and to the console)
 * @param {string} text 
 * @param {any} details 
 */
function showError(text, details = null) {
    if (details == null) {
        showToast('#translator-errorToast', text);
        error(text);
    }
    else {
        showToast('#translator-errorToast', text + ' See console for details.');
        error(text + ' Details:', details);
    }
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
/*!
 * object-hash.js 2.2.0 https://github.com/puleos/object-hash
 * Copyright (c) 2014 object-hash contributors.
 * Licensed under MIT (https://github.com/puleos/object-hash/blob/master/LICENSE)
 */
// @ts-ignore
!function(e){var t;"object"==typeof exports?module.exports=e():"function"==typeof define&&define.amd?define(e):("undefined"!=typeof window?t=window:"undefined"!=typeof global?t=global:"undefined"!=typeof self&&(t=self),t.objectHash=e())}(function(){return function o(i,u,a){function s(n,e){if(!u[n]){if(!i[n]){var t="function"==typeof require&&require;if(!e&&t)return t(n,!0);if(f)return f(n,!0);throw new Error("Cannot find module '"+n+"'")}var r=u[n]={exports:{}};i[n][0].call(r.exports,function(e){var t=i[n][1][e];return s(t||e)},r,r.exports,o,i,u,a)}return u[n].exports}for(var f="function"==typeof require&&require,e=0;e<a.length;e++)s(a[e]);return s}({1:[function(w,b,m){(function(e,t,f,n,r,o,i,u,a){"use strict";var s=w("crypto");function c(e,t){return function(e,t){var n;n="passthrough"!==t.algorithm?s.createHash(t.algorithm):new y;void 0===n.write&&(n.write=n.update,n.end=n.update);g(t,n).dispatch(e),n.update||n.end("");if(n.digest)return n.digest("buffer"===t.encoding?void 0:t.encoding);var r=n.read();return"buffer"!==t.encoding?r.toString(t.encoding):r}(e,t=h(e,t))}(m=b.exports=c).sha1=function(e){return c(e)},m.keys=function(e){return c(e,{excludeValues:!0,algorithm:"sha1",encoding:"hex"})},m.MD5=function(e){return c(e,{algorithm:"md5",encoding:"hex"})},m.keysMD5=function(e){return c(e,{algorithm:"md5",encoding:"hex",excludeValues:!0})};var l=s.getHashes?s.getHashes().slice():["sha1","md5"];l.push("passthrough");var d=["buffer","hex","binary","base64"];function h(e,t){t=t||{};var n={};if(n.algorithm=t.algorithm||"sha1",n.encoding=t.encoding||"hex",n.excludeValues=!!t.excludeValues,n.algorithm=n.algorithm.toLowerCase(),n.encoding=n.encoding.toLowerCase(),n.ignoreUnknown=!0===t.ignoreUnknown,n.respectType=!1!==t.respectType,n.respectFunctionNames=!1!==t.respectFunctionNames,n.respectFunctionProperties=!1!==t.respectFunctionProperties,n.unorderedArrays=!0===t.unorderedArrays,n.unorderedSets=!1!==t.unorderedSets,n.unorderedObjects=!1!==t.unorderedObjects,n.replacer=t.replacer||void 0,n.excludeKeys=t.excludeKeys||void 0,void 0===e)throw new Error("Object argument required.");for(var r=0;r<l.length;++r)l[r].toLowerCase()===n.algorithm.toLowerCase()&&(n.algorithm=l[r]);if(-1===l.indexOf(n.algorithm))throw new Error('Algorithm "'+n.algorithm+'"  not supported. supported values: '+l.join(", "));if(-1===d.indexOf(n.encoding)&&"passthrough"!==n.algorithm)throw new Error('Encoding "'+n.encoding+'"  not supported. supported values: '+d.join(", "));return n}function p(e){if("function"==typeof e){return null!=/^function\s+\w*\s*\(\s*\)\s*{\s+\[native code\]\s+}$/i.exec(Function.prototype.toString.call(e))}}function g(u,t,a){a=a||[];function s(e){return t.update?t.update(e,"utf8"):t.write(e,"utf8")}return{dispatch:function(e){return u.replacer&&(e=u.replacer(e)),this["_"+(null===e?"null":typeof e)](e)},_object:function(t){var e=Object.prototype.toString.call(t),n=/\[object (.*)\]/i.exec(e);n=(n=n?n[1]:"unknown:["+e+"]").toLowerCase();var r;if(0<=(r=a.indexOf(t)))return this.dispatch("[CIRCULAR:"+r+"]");if(a.push(t),void 0!==f&&f.isBuffer&&f.isBuffer(t))return s("buffer:"),s(t);if("object"===n||"function"===n||"asyncfunction"===n){var o=Object.keys(t);u.unorderedObjects&&(o=o.sort()),!1===u.respectType||p(t)||o.splice(0,0,"prototype","__proto__","constructor"),u.excludeKeys&&(o=o.filter(function(e){return!u.excludeKeys(e)})),s("object:"+o.length+":");var i=this;return o.forEach(function(e){i.dispatch(e),s(":"),u.excludeValues||i.dispatch(t[e]),s(",")})}if(!this["_"+n]){if(u.ignoreUnknown)return s("["+n+"]");throw new Error('Unknown object type "'+n+'"')}this["_"+n](t)},_array:function(e,t){t=void 0!==t?t:!1!==u.unorderedArrays;var n=this;if(s("array:"+e.length+":"),!t||e.length<=1)return e.forEach(function(e){return n.dispatch(e)});var r=[],o=e.map(function(e){var t=new y,n=a.slice();return g(u,t,n).dispatch(e),r=r.concat(n.slice(a.length)),t.read().toString()});return a=a.concat(r),o.sort(),this._array(o,!1)},_date:function(e){return s("date:"+e.toJSON())},_symbol:function(e){return s("symbol:"+e.toString())},_error:function(e){return s("error:"+e.toString())},_boolean:function(e){return s("bool:"+e.toString())},_string:function(e){s("string:"+e.length+":"),s(e.toString())},_function:function(e){s("fn:"),p(e)?this.dispatch("[native]"):this.dispatch(e.toString()),!1!==u.respectFunctionNames&&this.dispatch("function-name:"+String(e.name)),u.respectFunctionProperties&&this._object(e)},_number:function(e){return s("number:"+e.toString())},_xml:function(e){return s("xml:"+e.toString())},_null:function(){return s("Null")},_undefined:function(){return s("Undefined")},_regexp:function(e){return s("regex:"+e.toString())},_uint8array:function(e){return s("uint8array:"),this.dispatch(Array.prototype.slice.call(e))},_uint8clampedarray:function(e){return s("uint8clampedarray:"),this.dispatch(Array.prototype.slice.call(e))},_int8array:function(e){return s("uint8array:"),this.dispatch(Array.prototype.slice.call(e))},_uint16array:function(e){return s("uint16array:"),this.dispatch(Array.prototype.slice.call(e))},_int16array:function(e){return s("uint16array:"),this.dispatch(Array.prototype.slice.call(e))},_uint32array:function(e){return s("uint32array:"),this.dispatch(Array.prototype.slice.call(e))},_int32array:function(e){return s("uint32array:"),this.dispatch(Array.prototype.slice.call(e))},_float32array:function(e){return s("float32array:"),this.dispatch(Array.prototype.slice.call(e))},_float64array:function(e){return s("float64array:"),this.dispatch(Array.prototype.slice.call(e))},_arraybuffer:function(e){return s("arraybuffer:"),this.dispatch(new Uint8Array(e))},_url:function(e){return s("url:"+e.toString())},_map:function(e){s("map:");var t=Array.from(e);return this._array(t,!1!==u.unorderedSets)},_set:function(e){s("set:");var t=Array.from(e);return this._array(t,!1!==u.unorderedSets)},_file:function(e){return s("file:"),this.dispatch([e.name,e.size,e.type,e.lastModfied])},_blob:function(){if(u.ignoreUnknown)return s("[blob]");throw Error('Hashing Blob objects is currently not supported\n(see https://github.com/puleos/object-hash/issues/26)\nUse "options.replacer" or "options.ignoreUnknown"\n')},_domwindow:function(){return s("domwindow")},_bigint:function(e){return s("bigint:"+e.toString())},_process:function(){return s("process")},_timer:function(){return s("timer")},_pipe:function(){return s("pipe")},_tcp:function(){return s("tcp")},_udp:function(){return s("udp")},_tty:function(){return s("tty")},_statwatcher:function(){return s("statwatcher")},_securecontext:function(){return s("securecontext")},_connection:function(){return s("connection")},_zlib:function(){return s("zlib")},_context:function(){return s("context")},_nodescript:function(){return s("nodescript")},_httpparser:function(){return s("httpparser")},_dataview:function(){return s("dataview")},_signal:function(){return s("signal")},_fsevent:function(){return s("fsevent")},_tlswrap:function(){return s("tlswrap")}}}function y(){return{buf:"",write:function(e){this.buf+=e},end:function(e){this.buf+=e},read:function(){return this.buf}}}m.writeToStream=function(e,t,n){return void 0===n&&(n=t,t={}),g(t=h(e,t),n).dispatch(e)}}).call(this,w("lYpoI2"),"undefined"!=typeof self?self:"undefined"!=typeof window?window:{},w("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/fake_7eac155c.js","/")},{buffer:3,crypto:5,lYpoI2:10}],2:[function(e,t,f){(function(e,t,n,r,o,i,u,a,s){!function(e){"use strict";var f="undefined"!=typeof Uint8Array?Uint8Array:Array,n="+".charCodeAt(0),r="/".charCodeAt(0),o="0".charCodeAt(0),i="a".charCodeAt(0),u="A".charCodeAt(0),a="-".charCodeAt(0),s="_".charCodeAt(0);function c(e){var t=e.charCodeAt(0);return t===n||t===a?62:t===r||t===s?63:t<o?-1:t<o+10?t-o+26+26:t<u+26?t-u:t<i+26?t-i+26:void 0}e.toByteArray=function(e){var t,n;if(0<e.length%4)throw new Error("Invalid string. Length must be a multiple of 4");var r=e.length,o="="===e.charAt(r-2)?2:"="===e.charAt(r-1)?1:0,i=new f(3*e.length/4-o),u=0<o?e.length-4:e.length,a=0;function s(e){i[a++]=e}for(t=0;t<u;t+=4,0)s((16711680&(n=c(e.charAt(t))<<18|c(e.charAt(t+1))<<12|c(e.charAt(t+2))<<6|c(e.charAt(t+3))))>>16),s((65280&n)>>8),s(255&n);return 2==o?s(255&(n=c(e.charAt(t))<<2|c(e.charAt(t+1))>>4)):1==o&&(s((n=c(e.charAt(t))<<10|c(e.charAt(t+1))<<4|c(e.charAt(t+2))>>2)>>8&255),s(255&n)),i},e.fromByteArray=function(e){var t,n,r,o,i=e.length%3,u="";function a(e){return"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".charAt(e)}for(t=0,r=e.length-i;t<r;t+=3)n=(e[t]<<16)+(e[t+1]<<8)+e[t+2],u+=a((o=n)>>18&63)+a(o>>12&63)+a(o>>6&63)+a(63&o);switch(i){case 1:u+=a((n=e[e.length-1])>>2),u+=a(n<<4&63),u+="==";break;case 2:u+=a((n=(e[e.length-2]<<8)+e[e.length-1])>>10),u+=a(n>>4&63),u+=a(n<<2&63),u+="="}return u}}(void 0===f?this.base64js={}:f)}).call(this,e("lYpoI2"),"undefined"!=typeof self?self:"undefined"!=typeof window?window:{},e("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/node_modules/gulp-browserify/node_modules/base64-js/lib/b64.js","/node_modules/gulp-browserify/node_modules/base64-js/lib")},{buffer:3,lYpoI2:10}],3:[function(O,e,H){(function(e,t,g,n,r,o,i,u,a){var s=O("base64-js"),f=O("ieee754");function g(e,t,n){if(!(this instanceof g))return new g(e,t,n);var r,o,i,u,a,s=typeof e;if("base64"===t&&"string"==s)for(e=(r=e).trim?r.trim():r.replace(/^\s+|\s+$/g,"");e.length%4!=0;)e+="=";if("number"==s)o=x(e);else if("string"==s)o=g.byteLength(e,t);else{if("object"!=s)throw new Error("First argument needs to be a number, array or string.");o=x(e.length)}if(g._useTypedArrays?i=g._augment(new Uint8Array(o)):((i=this).length=o,i._isBuffer=!0),g._useTypedArrays&&"number"==typeof e.byteLength)i._set(e);else if(S(a=e)||g.isBuffer(a)||a&&"object"==typeof a&&"number"==typeof a.length)for(u=0;u<o;u++)g.isBuffer(e)?i[u]=e.readUInt8(u):i[u]=e[u];else if("string"==s)i.write(e,0,t);else if("number"==s&&!g._useTypedArrays&&!n)for(u=0;u<o;u++)i[u]=0;return i}function y(e,t,n,r){return g._charsWritten=T(function(e){for(var t=[],n=0;n<e.length;n++)t.push(255&e.charCodeAt(n));return t}(t),e,n,r)}function w(e,t,n,r){return g._charsWritten=T(function(e){for(var t,n,r,o=[],i=0;i<e.length;i++)t=e.charCodeAt(i),n=t>>8,r=t%256,o.push(r),o.push(n);return o}(t),e,n,r)}function c(e,t,n){var r="";n=Math.min(e.length,n);for(var o=t;o<n;o++)r+=String.fromCharCode(e[o]);return r}function l(e,t,n,r){r||(D("boolean"==typeof n,"missing or invalid endian"),D(null!=t,"missing offset"),D(t+1<e.length,"Trying to read beyond buffer length"));var o,i=e.length;if(!(i<=t))return n?(o=e[t],t+1<i&&(o|=e[t+1]<<8)):(o=e[t]<<8,t+1<i&&(o|=e[t+1])),o}function d(e,t,n,r){r||(D("boolean"==typeof n,"missing or invalid endian"),D(null!=t,"missing offset"),D(t+3<e.length,"Trying to read beyond buffer length"));var o,i=e.length;if(!(i<=t))return n?(t+2<i&&(o=e[t+2]<<16),t+1<i&&(o|=e[t+1]<<8),o|=e[t],t+3<i&&(o+=e[t+3]<<24>>>0)):(t+1<i&&(o=e[t+1]<<16),t+2<i&&(o|=e[t+2]<<8),t+3<i&&(o|=e[t+3]),o+=e[t]<<24>>>0),o}function h(e,t,n,r){if(r||(D("boolean"==typeof n,"missing or invalid endian"),D(null!=t,"missing offset"),D(t+1<e.length,"Trying to read beyond buffer length")),!(e.length<=t)){var o=l(e,t,n,!0);return 32768&o?-1*(65535-o+1):o}}function p(e,t,n,r){if(r||(D("boolean"==typeof n,"missing or invalid endian"),D(null!=t,"missing offset"),D(t+3<e.length,"Trying to read beyond buffer length")),!(e.length<=t)){var o=d(e,t,n,!0);return 2147483648&o?-1*(4294967295-o+1):o}}function b(e,t,n,r){return r||(D("boolean"==typeof n,"missing or invalid endian"),D(t+3<e.length,"Trying to read beyond buffer length")),f.read(e,t,n,23,4)}function m(e,t,n,r){return r||(D("boolean"==typeof n,"missing or invalid endian"),D(t+7<e.length,"Trying to read beyond buffer length")),f.read(e,t,n,52,8)}function v(e,t,n,r,o){o||(D(null!=t,"missing value"),D("boolean"==typeof r,"missing or invalid endian"),D(null!=n,"missing offset"),D(n+1<e.length,"trying to write beyond buffer length"),N(t,65535));var i=e.length;if(!(i<=n))for(var u=0,a=Math.min(i-n,2);u<a;u++)e[n+u]=(t&255<<8*(r?u:1-u))>>>8*(r?u:1-u)}function _(e,t,n,r,o){o||(D(null!=t,"missing value"),D("boolean"==typeof r,"missing or invalid endian"),D(null!=n,"missing offset"),D(n+3<e.length,"trying to write beyond buffer length"),N(t,4294967295));var i=e.length;if(!(i<=n))for(var u=0,a=Math.min(i-n,4);u<a;u++)e[n+u]=t>>>8*(r?u:3-u)&255}function E(e,t,n,r,o){o||(D(null!=t,"missing value"),D("boolean"==typeof r,"missing or invalid endian"),D(null!=n,"missing offset"),D(n+1<e.length,"Trying to write beyond buffer length"),Y(t,32767,-32768)),e.length<=n||v(e,0<=t?t:65535+t+1,n,r,o)}function I(e,t,n,r,o){o||(D(null!=t,"missing value"),D("boolean"==typeof r,"missing or invalid endian"),D(null!=n,"missing offset"),D(n+3<e.length,"Trying to write beyond buffer length"),Y(t,2147483647,-2147483648)),e.length<=n||_(e,0<=t?t:4294967295+t+1,n,r,o)}function A(e,t,n,r,o){o||(D(null!=t,"missing value"),D("boolean"==typeof r,"missing or invalid endian"),D(null!=n,"missing offset"),D(n+3<e.length,"Trying to write beyond buffer length"),F(t,34028234663852886e22,-34028234663852886e22)),e.length<=n||f.write(e,t,n,r,23,4)}function B(e,t,n,r,o){o||(D(null!=t,"missing value"),D("boolean"==typeof r,"missing or invalid endian"),D(null!=n,"missing offset"),D(n+7<e.length,"Trying to write beyond buffer length"),F(t,17976931348623157e292,-17976931348623157e292)),e.length<=n||f.write(e,t,n,r,52,8)}H.Buffer=g,H.SlowBuffer=g,H.INSPECT_MAX_BYTES=50,g.poolSize=8192,g._useTypedArrays=function(){try{var e=new ArrayBuffer(0),t=new Uint8Array(e);return t.foo=function(){return 42},42===t.foo()&&"function"==typeof t.subarray}catch(e){return!1}}(),g.isEncoding=function(e){switch(String(e).toLowerCase()){case"hex":case"utf8":case"utf-8":case"ascii":case"binary":case"base64":case"raw":case"ucs2":case"ucs-2":case"utf16le":case"utf-16le":return!0;default:return!1}},g.isBuffer=function(e){return!(null==e||!e._isBuffer)},g.byteLength=function(e,t){var n;switch(e+="",t||"utf8"){case"hex":n=e.length/2;break;case"utf8":case"utf-8":n=C(e).length;break;case"ascii":case"binary":case"raw":n=e.length;break;case"base64":n=k(e).length;break;case"ucs2":case"ucs-2":case"utf16le":case"utf-16le":n=2*e.length;break;default:throw new Error("Unknown encoding")}return n},g.concat=function(e,t){if(D(S(e),"Usage: Buffer.concat(list, [totalLength])\nlist should be an Array."),0===e.length)return new g(0);if(1===e.length)return e[0];if("number"!=typeof t)for(o=t=0;o<e.length;o++)t+=e[o].length;for(var n=new g(t),r=0,o=0;o<e.length;o++){var i=e[o];i.copy(n,r),r+=i.length}return n},g.prototype.write=function(e,t,n,r){var o;isFinite(t)?isFinite(n)||(r=n,n=void 0):(o=r,r=t,t=n,n=o),t=Number(t)||0;var i,u,a,s,f,c,l,d,h,p=this.length-t;switch((!n||p<(n=Number(n)))&&(n=p),r=String(r||"utf8").toLowerCase()){case"hex":i=function(e,t,n,r){n=Number(n)||0;var o=e.length-n;(!r||o<(r=Number(r)))&&(r=o);var i=t.length;D(i%2==0,"Invalid hex string"),i/2<r&&(r=i/2);for(var u=0;u<r;u++){var a=parseInt(t.substr(2*u,2),16);D(!isNaN(a),"Invalid hex string"),e[n+u]=a}return g._charsWritten=2*u,u}(this,e,t,n);break;case"utf8":case"utf-8":c=this,l=e,d=t,h=n,i=g._charsWritten=T(C(l),c,d,h);break;case"ascii":case"binary":i=y(this,e,t,n);break;case"base64":u=this,a=e,s=t,f=n,i=g._charsWritten=T(k(a),u,s,f);break;case"ucs2":case"ucs-2":case"utf16le":case"utf-16le":i=w(this,e,t,n);break;default:throw new Error("Unknown encoding")}return i},g.prototype.toString=function(e,t,n){var r,o,i,u,a=this;if(e=String(e||"utf8").toLowerCase(),t=Number(t)||0,(n=void 0!==n?Number(n):n=a.length)===t)return"";switch(e){case"hex":r=function(e,t,n){var r=e.length;(!t||t<0)&&(t=0);(!n||n<0||r<n)&&(n=r);for(var o="",i=t;i<n;i++)o+=j(e[i]);return o}(a,t,n);break;case"utf8":case"utf-8":r=function(e,t,n){var r="",o="";n=Math.min(e.length,n);for(var i=t;i<n;i++)e[i]<=127?(r+=M(o)+String.fromCharCode(e[i]),o=""):o+="%"+e[i].toString(16);return r+M(o)}(a,t,n);break;case"ascii":case"binary":r=c(a,t,n);break;case"base64":o=a,u=n,r=0===(i=t)&&u===o.length?s.fromByteArray(o):s.fromByteArray(o.slice(i,u));break;case"ucs2":case"ucs-2":case"utf16le":case"utf-16le":r=function(e,t,n){for(var r=e.slice(t,n),o="",i=0;i<r.length;i+=2)o+=String.fromCharCode(r[i]+256*r[i+1]);return o}(a,t,n);break;default:throw new Error("Unknown encoding")}return r},g.prototype.toJSON=function(){return{type:"Buffer",data:Array.prototype.slice.call(this._arr||this,0)}},g.prototype.copy=function(e,t,n,r){if(n=n||0,r||0===r||(r=this.length),t=t||0,r!==n&&0!==e.length&&0!==this.length){D(n<=r,"sourceEnd < sourceStart"),D(0<=t&&t<e.length,"targetStart out of bounds"),D(0<=n&&n<this.length,"sourceStart out of bounds"),D(0<=r&&r<=this.length,"sourceEnd out of bounds"),r>this.length&&(r=this.length),e.length-t<r-n&&(r=e.length-t+n);var o=r-n;if(o<100||!g._useTypedArrays)for(var i=0;i<o;i++)e[i+t]=this[i+n];else e._set(this.subarray(n,n+o),t)}},g.prototype.slice=function(e,t){var n=this.length;if(e=U(e,n,0),t=U(t,n,n),g._useTypedArrays)return g._augment(this.subarray(e,t));for(var r=t-e,o=new g(r,void 0,!0),i=0;i<r;i++)o[i]=this[i+e];return o},g.prototype.get=function(e){return console.log(".get() is deprecated. Access using array indexes instead."),this.readUInt8(e)},g.prototype.set=function(e,t){return console.log(".set() is deprecated. Access using array indexes instead."),this.writeUInt8(e,t)},g.prototype.readUInt8=function(e,t){if(t||(D(null!=e,"missing offset"),D(e<this.length,"Trying to read beyond buffer length")),!(e>=this.length))return this[e]},g.prototype.readUInt16LE=function(e,t){return l(this,e,!0,t)},g.prototype.readUInt16BE=function(e,t){return l(this,e,!1,t)},g.prototype.readUInt32LE=function(e,t){return d(this,e,!0,t)},g.prototype.readUInt32BE=function(e,t){return d(this,e,!1,t)},g.prototype.readInt8=function(e,t){if(t||(D(null!=e,"missing offset"),D(e<this.length,"Trying to read beyond buffer length")),!(e>=this.length))return 128&this[e]?-1*(255-this[e]+1):this[e]},g.prototype.readInt16LE=function(e,t){return h(this,e,!0,t)},g.prototype.readInt16BE=function(e,t){return h(this,e,!1,t)},g.prototype.readInt32LE=function(e,t){return p(this,e,!0,t)},g.prototype.readInt32BE=function(e,t){return p(this,e,!1,t)},g.prototype.readFloatLE=function(e,t){return b(this,e,!0,t)},g.prototype.readFloatBE=function(e,t){return b(this,e,!1,t)},g.prototype.readDoubleLE=function(e,t){return m(this,e,!0,t)},g.prototype.readDoubleBE=function(e,t){return m(this,e,!1,t)},g.prototype.writeUInt8=function(e,t,n){n||(D(null!=e,"missing value"),D(null!=t,"missing offset"),D(t<this.length,"trying to write beyond buffer length"),N(e,255)),t>=this.length||(this[t]=e)},g.prototype.writeUInt16LE=function(e,t,n){v(this,e,t,!0,n)},g.prototype.writeUInt16BE=function(e,t,n){v(this,e,t,!1,n)},g.prototype.writeUInt32LE=function(e,t,n){_(this,e,t,!0,n)},g.prototype.writeUInt32BE=function(e,t,n){_(this,e,t,!1,n)},g.prototype.writeInt8=function(e,t,n){n||(D(null!=e,"missing value"),D(null!=t,"missing offset"),D(t<this.length,"Trying to write beyond buffer length"),Y(e,127,-128)),t>=this.length||(0<=e?this.writeUInt8(e,t,n):this.writeUInt8(255+e+1,t,n))},g.prototype.writeInt16LE=function(e,t,n){E(this,e,t,!0,n)},g.prototype.writeInt16BE=function(e,t,n){E(this,e,t,!1,n)},g.prototype.writeInt32LE=function(e,t,n){I(this,e,t,!0,n)},g.prototype.writeInt32BE=function(e,t,n){I(this,e,t,!1,n)},g.prototype.writeFloatLE=function(e,t,n){A(this,e,t,!0,n)},g.prototype.writeFloatBE=function(e,t,n){A(this,e,t,!1,n)},g.prototype.writeDoubleLE=function(e,t,n){B(this,e,t,!0,n)},g.prototype.writeDoubleBE=function(e,t,n){B(this,e,t,!1,n)},g.prototype.fill=function(e,t,n){if(e=e||0,t=t||0,n=n||this.length,"string"==typeof e&&(e=e.charCodeAt(0)),D("number"==typeof e&&!isNaN(e),"value is not a number"),D(t<=n,"end < start"),n!==t&&0!==this.length){D(0<=t&&t<this.length,"start out of bounds"),D(0<=n&&n<=this.length,"end out of bounds");for(var r=t;r<n;r++)this[r]=e}},g.prototype.inspect=function(){for(var e=[],t=this.length,n=0;n<t;n++)if(e[n]=j(this[n]),n===H.INSPECT_MAX_BYTES){e[n+1]="...";break}return"<Buffer "+e.join(" ")+">"},g.prototype.toArrayBuffer=function(){if("undefined"==typeof Uint8Array)throw new Error("Buffer.toArrayBuffer not supported in this browser");if(g._useTypedArrays)return new g(this).buffer;for(var e=new Uint8Array(this.length),t=0,n=e.length;t<n;t+=1)e[t]=this[t];return e.buffer};var L=g.prototype;function U(e,t,n){return"number"!=typeof e?n:t<=(e=~~e)?t:0<=e||0<=(e+=t)?e:0}function x(e){return(e=~~Math.ceil(+e))<0?0:e}function S(e){return(Array.isArray||function(e){return"[object Array]"===Object.prototype.toString.call(e)})(e)}function j(e){return e<16?"0"+e.toString(16):e.toString(16)}function C(e){for(var t=[],n=0;n<e.length;n++){var r=e.charCodeAt(n);if(r<=127)t.push(e.charCodeAt(n));else{var o=n;55296<=r&&r<=57343&&n++;for(var i=encodeURIComponent(e.slice(o,n+1)).substr(1).split("%"),u=0;u<i.length;u++)t.push(parseInt(i[u],16))}}return t}function k(e){return s.toByteArray(e)}function T(e,t,n,r){for(var o=0;o<r&&!(o+n>=t.length||o>=e.length);o++)t[o+n]=e[o];return o}function M(e){try{return decodeURIComponent(e)}catch(e){return String.fromCharCode(65533)}}function N(e,t){D("number"==typeof e,"cannot write a non-number as a number"),D(0<=e,"specified a negative value for writing an unsigned value"),D(e<=t,"value is larger than maximum value for type"),D(Math.floor(e)===e,"value has a fractional component")}function Y(e,t,n){D("number"==typeof e,"cannot write a non-number as a number"),D(e<=t,"value larger than maximum allowed value"),D(n<=e,"value smaller than minimum allowed value"),D(Math.floor(e)===e,"value has a fractional component")}function F(e,t,n){D("number"==typeof e,"cannot write a non-number as a number"),D(e<=t,"value larger than maximum allowed value"),D(n<=e,"value smaller than minimum allowed value")}function D(e,t){if(!e)throw new Error(t||"Failed assertion")}g._augment=function(e){return e._isBuffer=!0,e._get=e.get,e._set=e.set,e.get=L.get,e.set=L.set,e.write=L.write,e.toString=L.toString,e.toLocaleString=L.toString,e.toJSON=L.toJSON,e.copy=L.copy,e.slice=L.slice,e.readUInt8=L.readUInt8,e.readUInt16LE=L.readUInt16LE,e.readUInt16BE=L.readUInt16BE,e.readUInt32LE=L.readUInt32LE,e.readUInt32BE=L.readUInt32BE,e.readInt8=L.readInt8,e.readInt16LE=L.readInt16LE,e.readInt16BE=L.readInt16BE,e.readInt32LE=L.readInt32LE,e.readInt32BE=L.readInt32BE,e.readFloatLE=L.readFloatLE,e.readFloatBE=L.readFloatBE,e.readDoubleLE=L.readDoubleLE,e.readDoubleBE=L.readDoubleBE,e.writeUInt8=L.writeUInt8,e.writeUInt16LE=L.writeUInt16LE,e.writeUInt16BE=L.writeUInt16BE,e.writeUInt32LE=L.writeUInt32LE,e.writeUInt32BE=L.writeUInt32BE,e.writeInt8=L.writeInt8,e.writeInt16LE=L.writeInt16LE,e.writeInt16BE=L.writeInt16BE,e.writeInt32LE=L.writeInt32LE,e.writeInt32BE=L.writeInt32BE,e.writeFloatLE=L.writeFloatLE,e.writeFloatBE=L.writeFloatBE,e.writeDoubleLE=L.writeDoubleLE,e.writeDoubleBE=L.writeDoubleBE,e.fill=L.fill,e.inspect=L.inspect,e.toArrayBuffer=L.toArrayBuffer,e}}).call(this,O("lYpoI2"),"undefined"!=typeof self?self:"undefined"!=typeof window?window:{},O("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/node_modules/gulp-browserify/node_modules/buffer/index.js","/node_modules/gulp-browserify/node_modules/buffer")},{"base64-js":2,buffer:3,ieee754:11,lYpoI2:10}],4:[function(l,d,e){(function(e,t,u,n,r,o,i,a,s){var u=l("buffer").Buffer,f=4,c=new u(f);c.fill(0);d.exports={hash:function(e,t,n,r){return u.isBuffer(e)||(e=new u(e)),function(e,t,n){for(var r=new u(t),o=n?r.writeInt32BE:r.writeInt32LE,i=0;i<e.length;i++)o.call(r,e[i],4*i,!0);return r}(t(function(e,t){var n;e.length%f!=0&&(n=e.length+(f-e.length%f),e=u.concat([e,c],n));for(var r=[],o=t?e.readInt32BE:e.readInt32LE,i=0;i<e.length;i+=f)r.push(o.call(e,i));return r}(e,r),8*e.length),n,r)}}}).call(this,l("lYpoI2"),"undefined"!=typeof self?self:"undefined"!=typeof window?window:{},l("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/node_modules/gulp-browserify/node_modules/crypto-browserify/helpers.js","/node_modules/gulp-browserify/node_modules/crypto-browserify")},{buffer:3,lYpoI2:10}],5:[function(w,e,b){(function(e,t,a,n,r,o,i,u,s){var a=w("buffer").Buffer,f=w("./sha"),c=w("./sha256"),l=w("./rng"),d={sha1:f,sha256:c,md5:w("./md5")},h=64,p=new a(h);function g(e,r){var o=d[e=e||"sha1"],i=[];return o||y("algorithm:",e,"is not yet supported"),{update:function(e){return a.isBuffer(e)||(e=new a(e)),i.push(e),e.length,this},digest:function(e){var t=a.concat(i),n=r?function(e,t,n){a.isBuffer(t)||(t=new a(t)),a.isBuffer(n)||(n=new a(n)),t.length>h?t=e(t):t.length<h&&(t=a.concat([t,p],h));for(var r=new a(h),o=new a(h),i=0;i<h;i++)r[i]=54^t[i],o[i]=92^t[i];var u=e(a.concat([r,n]));return e(a.concat([o,u]))}(o,r,t):o(t);return i=null,e?n.toString(e):n}}}function y(){var e=[].slice.call(arguments).join(" ");throw new Error([e,"we accept pull requests","http://github.com/dominictarr/crypto-browserify"].join("\n"))}p.fill(0),b.createHash=function(e){return g(e)},b.createHmac=g,b.randomBytes=function(e,t){if(!t||!t.call)return new a(l(e));try{t.call(this,void 0,new a(l(e)))}catch(e){t(e)}},function(e,t){for(var n in e)t(e[n],n)}(["createCredentials","createCipher","createCipheriv","createDecipher","createDecipheriv","createSign","createVerify","createDiffieHellman","pbkdf2"],function(e){b[e]=function(){y("sorry,",e,"is not implemented yet")}})}).call(this,w("lYpoI2"),"undefined"!=typeof self?self:"undefined"!=typeof window?window:{},w("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/node_modules/gulp-browserify/node_modules/crypto-browserify/index.js","/node_modules/gulp-browserify/node_modules/crypto-browserify")},{"./md5":6,"./rng":7,"./sha":8,"./sha256":9,buffer:3,lYpoI2:10}],6:[function(w,b,e){(function(e,t,n,r,o,i,u,a,s){var f=w("./helpers");function c(e,t){e[t>>5]|=128<<t%32,e[14+(t+64>>>9<<4)]=t;for(var n=1732584193,r=-271733879,o=-1732584194,i=271733878,u=0;u<e.length;u+=16){var a=n,s=r,f=o,c=i,n=d(n,r,o,i,e[u+0],7,-680876936),i=d(i,n,r,o,e[u+1],12,-389564586),o=d(o,i,n,r,e[u+2],17,606105819),r=d(r,o,i,n,e[u+3],22,-1044525330);n=d(n,r,o,i,e[u+4],7,-176418897),i=d(i,n,r,o,e[u+5],12,1200080426),o=d(o,i,n,r,e[u+6],17,-1473231341),r=d(r,o,i,n,e[u+7],22,-45705983),n=d(n,r,o,i,e[u+8],7,1770035416),i=d(i,n,r,o,e[u+9],12,-1958414417),o=d(o,i,n,r,e[u+10],17,-42063),r=d(r,o,i,n,e[u+11],22,-1990404162),n=d(n,r,o,i,e[u+12],7,1804603682),i=d(i,n,r,o,e[u+13],12,-40341101),o=d(o,i,n,r,e[u+14],17,-1502002290),n=h(n,r=d(r,o,i,n,e[u+15],22,1236535329),o,i,e[u+1],5,-165796510),i=h(i,n,r,o,e[u+6],9,-1069501632),o=h(o,i,n,r,e[u+11],14,643717713),r=h(r,o,i,n,e[u+0],20,-373897302),n=h(n,r,o,i,e[u+5],5,-701558691),i=h(i,n,r,o,e[u+10],9,38016083),o=h(o,i,n,r,e[u+15],14,-660478335),r=h(r,o,i,n,e[u+4],20,-405537848),n=h(n,r,o,i,e[u+9],5,568446438),i=h(i,n,r,o,e[u+14],9,-1019803690),o=h(o,i,n,r,e[u+3],14,-187363961),r=h(r,o,i,n,e[u+8],20,1163531501),n=h(n,r,o,i,e[u+13],5,-1444681467),i=h(i,n,r,o,e[u+2],9,-51403784),o=h(o,i,n,r,e[u+7],14,1735328473),n=p(n,r=h(r,o,i,n,e[u+12],20,-1926607734),o,i,e[u+5],4,-378558),i=p(i,n,r,o,e[u+8],11,-2022574463),o=p(o,i,n,r,e[u+11],16,1839030562),r=p(r,o,i,n,e[u+14],23,-35309556),n=p(n,r,o,i,e[u+1],4,-1530992060),i=p(i,n,r,o,e[u+4],11,1272893353),o=p(o,i,n,r,e[u+7],16,-155497632),r=p(r,o,i,n,e[u+10],23,-1094730640),n=p(n,r,o,i,e[u+13],4,681279174),i=p(i,n,r,o,e[u+0],11,-358537222),o=p(o,i,n,r,e[u+3],16,-722521979),r=p(r,o,i,n,e[u+6],23,76029189),n=p(n,r,o,i,e[u+9],4,-640364487),i=p(i,n,r,o,e[u+12],11,-421815835),o=p(o,i,n,r,e[u+15],16,530742520),n=g(n,r=p(r,o,i,n,e[u+2],23,-995338651),o,i,e[u+0],6,-198630844),i=g(i,n,r,o,e[u+7],10,1126891415),o=g(o,i,n,r,e[u+14],15,-1416354905),r=g(r,o,i,n,e[u+5],21,-57434055),n=g(n,r,o,i,e[u+12],6,1700485571),i=g(i,n,r,o,e[u+3],10,-1894986606),o=g(o,i,n,r,e[u+10],15,-1051523),r=g(r,o,i,n,e[u+1],21,-2054922799),n=g(n,r,o,i,e[u+8],6,1873313359),i=g(i,n,r,o,e[u+15],10,-30611744),o=g(o,i,n,r,e[u+6],15,-1560198380),r=g(r,o,i,n,e[u+13],21,1309151649),n=g(n,r,o,i,e[u+4],6,-145523070),i=g(i,n,r,o,e[u+11],10,-1120210379),o=g(o,i,n,r,e[u+2],15,718787259),r=g(r,o,i,n,e[u+9],21,-343485551),n=y(n,a),r=y(r,s),o=y(o,f),i=y(i,c)}return Array(n,r,o,i)}function l(e,t,n,r,o,i){return y((u=y(y(t,e),y(r,i)))<<(a=o)|u>>>32-a,n);var u,a}function d(e,t,n,r,o,i,u){return l(t&n|~t&r,e,t,o,i,u)}function h(e,t,n,r,o,i,u){return l(t&r|n&~r,e,t,o,i,u)}function p(e,t,n,r,o,i,u){return l(t^n^r,e,t,o,i,u)}function g(e,t,n,r,o,i,u){return l(n^(t|~r),e,t,o,i,u)}function y(e,t){var n=(65535&e)+(65535&t);return(e>>16)+(t>>16)+(n>>16)<<16|65535&n}b.exports=function(e){return f.hash(e,c,16)}}).call(this,w("lYpoI2"),"undefined"!=typeof self?self:"undefined"!=typeof window?window:{},w("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/node_modules/gulp-browserify/node_modules/crypto-browserify/md5.js","/node_modules/gulp-browserify/node_modules/crypto-browserify")},{"./helpers":4,buffer:3,lYpoI2:10}],7:[function(e,l,t){(function(e,t,n,r,o,i,u,a,s){var f,c;c=function(e){for(var t,n=new Array(e),r=0;r<e;r++)0==(3&r)&&(t=4294967296*Math.random()),n[r]=t>>>((3&r)<<3)&255;return n},l.exports=f||c}).call(this,e("lYpoI2"),"undefined"!=typeof self?self:"undefined"!=typeof window?window:{},e("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/node_modules/gulp-browserify/node_modules/crypto-browserify/rng.js","/node_modules/gulp-browserify/node_modules/crypto-browserify")},{buffer:3,lYpoI2:10}],8:[function(l,d,e){(function(e,t,n,r,o,i,u,a,s){var f=l("./helpers");function c(e,t){e[t>>5]|=128<<24-t%32,e[15+(t+64>>9<<4)]=t;for(var n,r,o,i,u,a=Array(80),s=1732584193,f=-271733879,c=-1732584194,l=271733878,d=-1009589776,h=0;h<e.length;h+=16){for(var p=s,g=f,y=c,w=l,b=d,m=0;m<80;m++){a[m]=m<16?e[h+m]:E(a[m-3]^a[m-8]^a[m-14]^a[m-16],1);var v=_(_(E(s,5),(o=f,i=c,u=l,(r=m)<20?o&i|~o&u:!(r<40)&&r<60?o&i|o&u|i&u:o^i^u)),_(_(d,a[m]),(n=m)<20?1518500249:n<40?1859775393:n<60?-1894007588:-899497514)),d=l,l=c,c=E(f,30),f=s,s=v}s=_(s,p),f=_(f,g),c=_(c,y),l=_(l,w),d=_(d,b)}return Array(s,f,c,l,d)}function _(e,t){var n=(65535&e)+(65535&t);return(e>>16)+(t>>16)+(n>>16)<<16|65535&n}function E(e,t){return e<<t|e>>>32-t}d.exports=function(e){return f.hash(e,c,20,!0)}}).call(this,l("lYpoI2"),"undefined"!=typeof self?self:"undefined"!=typeof window?window:{},l("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/node_modules/gulp-browserify/node_modules/crypto-browserify/sha.js","/node_modules/gulp-browserify/node_modules/crypto-browserify")},{"./helpers":4,buffer:3,lYpoI2:10}],9:[function(l,d,e){(function(e,t,n,r,o,i,u,a,s){function B(e,t){var n=(65535&e)+(65535&t);return(e>>16)+(t>>16)+(n>>16)<<16|65535&n}function L(e,t){return e>>>t|e<<32-t}function f(e,t){var n,r,o,i,u,a,s,f,c,l,d=new Array(1116352408,1899447441,3049323471,3921009573,961987163,1508970993,2453635748,2870763221,3624381080,310598401,607225278,1426881987,1925078388,2162078206,2614888103,3248222580,3835390401,4022224774,264347078,604807628,770255983,1249150122,1555081692,1996064986,2554220882,2821834349,2952996808,3210313671,3336571891,3584528711,113926993,338241895,666307205,773529912,1294757372,1396182291,1695183700,1986661051,2177026350,2456956037,2730485921,2820302411,3259730800,3345764771,3516065817,3600352804,4094571909,275423344,430227734,506948616,659060556,883997877,958139571,1322822218,1537002063,1747873779,1955562222,2024104815,2227730452,2361852424,2428436474,2756734187,3204031479,3329325298),h=new Array(1779033703,3144134277,1013904242,2773480762,1359893119,2600822924,528734635,1541459225),p=new Array(64);e[t>>5]|=128<<24-t%32,e[15+(t+64>>9<<4)]=t;for(var g,y,w,b,m,v,_,E,I=0;I<e.length;I+=16){n=h[0],r=h[1],o=h[2],i=h[3],u=h[4],a=h[5],s=h[6],f=h[7];for(var A=0;A<64;A++)p[A]=A<16?e[A+I]:B(B(B((E=p[A-2],L(E,17)^L(E,19)^E>>>10),p[A-7]),(_=p[A-15],L(_,7)^L(_,18)^_>>>3)),p[A-16]),c=B(B(B(B(f,L(v=u,6)^L(v,11)^L(v,25)),(m=u)&a^~m&s),d[A]),p[A]),l=B(L(b=n,2)^L(b,13)^L(b,22),(g=n)&(y=r)^g&(w=o)^y&w),f=s,s=a,a=u,u=B(i,c),i=o,o=r,r=n,n=B(c,l);h[0]=B(n,h[0]),h[1]=B(r,h[1]),h[2]=B(o,h[2]),h[3]=B(i,h[3]),h[4]=B(u,h[4]),h[5]=B(a,h[5]),h[6]=B(s,h[6]),h[7]=B(f,h[7])}return h}var c=l("./helpers");d.exports=function(e){return c.hash(e,f,32,!0)}}).call(this,l("lYpoI2"),"undefined"!=typeof self?self:"undefined"!=typeof window?window:{},l("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/node_modules/gulp-browserify/node_modules/crypto-browserify/sha256.js","/node_modules/gulp-browserify/node_modules/crypto-browserify")},{"./helpers":4,buffer:3,lYpoI2:10}],10:[function(e,c,t){(function(e,t,n,r,o,i,u,a,s){function f(){}(e=c.exports={}).nextTick=function(){var e="undefined"!=typeof window&&window.setImmediate,t="undefined"!=typeof window&&window.postMessage&&window.addEventListener;if(e)return function(e){return window.setImmediate(e)};if(t){var n=[];return window.addEventListener("message",function(e){var t=e.source;t!==window&&null!==t||"process-tick"!==e.data||(e.stopPropagation(),0<n.length&&n.shift()())},!0),function(e){n.push(e),window.postMessage("process-tick","*")}}return function(e){setTimeout(e,0)}}(),e.title="browser",e.browser=!0,e.env={},e.argv=[],e.on=f,e.addListener=f,e.once=f,e.off=f,e.removeListener=f,e.removeAllListeners=f,e.emit=f,e.binding=function(e){throw new Error("process.binding is not supported")},e.cwd=function(){return"/"},e.chdir=function(e){throw new Error("process.chdir is not supported")}}).call(this,e("lYpoI2"),"undefined"!=typeof self?self:"undefined"!=typeof window?window:{},e("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/node_modules/gulp-browserify/node_modules/process/browser.js","/node_modules/gulp-browserify/node_modules/process")},{buffer:3,lYpoI2:10}],11:[function(e,t,f){(function(e,t,n,r,o,i,u,a,s){f.read=function(e,t,n,r,o){var i,u,a=8*o-r-1,s=(1<<a)-1,f=s>>1,c=-7,l=n?o-1:0,d=n?-1:1,h=e[t+l];for(l+=d,i=h&(1<<-c)-1,h>>=-c,c+=a;0<c;i=256*i+e[t+l],l+=d,c-=8);for(u=i&(1<<-c)-1,i>>=-c,c+=r;0<c;u=256*u+e[t+l],l+=d,c-=8);if(0===i)i=1-f;else{if(i===s)return u?NaN:1/0*(h?-1:1);u+=Math.pow(2,r),i-=f}return(h?-1:1)*u*Math.pow(2,i-r)},f.write=function(e,t,n,r,o,i){var u,a,s,f=8*i-o-1,c=(1<<f)-1,l=c>>1,d=23===o?Math.pow(2,-24)-Math.pow(2,-77):0,h=r?0:i-1,p=r?1:-1,g=t<0||0===t&&1/t<0?1:0;for(t=Math.abs(t),isNaN(t)||t===1/0?(a=isNaN(t)?1:0,u=c):(u=Math.floor(Math.log(t)/Math.LN2),t*(s=Math.pow(2,-u))<1&&(u--,s*=2),2<=(t+=1<=u+l?d/s:d*Math.pow(2,1-l))*s&&(u++,s/=2),c<=u+l?(a=0,u=c):1<=u+l?(a=(t*s-1)*Math.pow(2,o),u+=l):(a=t*Math.pow(2,l-1)*Math.pow(2,o),u=0));8<=o;e[n+h]=255&a,h+=p,a/=256,o-=8);for(u=u<<o|a,f+=o;0<f;e[n+h]=255&u,h+=p,u/=256,f-=8);e[n+h-p]|=128*g}}).call(this,e("lYpoI2"),"undefined"!=typeof self?self:"undefined"!=typeof window?window:{},e("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/node_modules/ieee754/index.js","/node_modules/ieee754")},{buffer:3,lYpoI2:10}]},{},[1])(1)});
//#endregion