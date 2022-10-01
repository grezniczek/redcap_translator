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

/**
 * Initializes the REDCap Translator plugin page
 * @param {REDCapInScreenTranslator_Config} data 
 */
function init(data) {
    config = data;
    JSMO = resolveJSMO(config.jsmoName);

    $(function() {
        log('Initialized.', config);

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
            updateProgressModal('Preparing page for translation ...', 5);
            injectTranslationHooks();
            translationInitialized = true;
            log('Translation, metadata, and keys loaded.', config);
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
        }, 200);
    });
}

function injectTranslationHooks() {
    log('Injecting hooks ...');
    const $childLess = $('*:not(:has(*))').not('script');
    const nTotal = $('*').not('script').length;
    log ('Processing ' + nTotal + ' elements (' + $childLess.length + ' leaves).');

    // Compile a list of all candidate HTML elements
    /**
     * @type HTMLElement[]
     */
    const elements = [];
    $childLess.each(function() {
        const $this = $(this);
        const content = getTextAndAttributes(this);
        if (content.includes(config.codeStart)) {
            elements.push(this);
        }
        else {
            let $parent = $this.parent();
            while (!($parent.is('body') || $parent.is('html'))) {
                const text = $parent.contents().filter(function() {
                    return this.nodeType == Node.TEXT_NODE;
                }).text();
                if (text.includes(config.codeStart)) {
                    const el = $parent.get(0);
                    if (el != null) elements.push(el);
                }
                $parent = $parent.parent();
            }
        }
    });
    // Now enhance
    let i = 0; // Keep track of progress
    for (const el of elements) {
        i++;
        // Already processed? Skip
        if (el.getAttribute('data-inscreen-translation') == '1') continue;
        // Replace all strings that are in text content in the html content
        let html = el.innerHTML;
        let text = el.innerText;
        // log($(el), text); // Debug logging
        let pos = text.indexOf(config.codeStart);
        while (pos > -1) {
            const code = text.substring(pos + 1, 16);
            const decoded = decodeInvisiCode(code);
            // log(code, decoded, config.keys[decoded.int]); // Debug logging


            // Replace




            pos = text.indexOf(config.codeStart, pos + 1);
        }
        // Look through all text nodes and attributes

        // Wrap accordingly or add class
        $(el).attr('data-inscreen-translation', '1');

        // TODO inject
    }

    updateProgressModal('Translation setup has completed.');
}

/**
 * Decodes an invisible code
 * @param {string} encoded 
 * @returns {Object}
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