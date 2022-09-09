/* REDCap Translator EM */

// @ts-check
;(function() {

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

/** @type REDCapTranslator */
var THIS = {};
window['REDCap']['EM']['RUB']['REDCapTranslator'] = THIS;

/** @type REDCapTranslator_Config */
var config;

/** @type JavascriptModuleObject */
var JSMO;

/**
 * Initializes the REDCap Translator plugin page
 * @param {REDCapTranslator_Config} data 
 */
THIS.init = function(data) {
    config = data;
    JSMO = resolveJSMO(config.jsmoName);

    $(function() {
        log('Initialized.', config);

        // Handle actions
        // General
        $('div.translator-em').on('click', handleActions);
        // Uploads 
        $('div.translator-em input[name=upload-zip]').on('change', uploadZip);

        renderUploadsTable();
        activateTab('uploads');
    });
};

var currentTab = '';



//#region Uploads

function sortUploads() {
    const unsorted = {};
    for (const version of Object.keys(config.uploads)) {
        const parts = version.split('.');
        const numVersion = 
            Number.parseInt(parts[0]) * 10000 +
            Number.parseInt(parts[1]) * 100 +
            Number.parseInt(parts[2]);
        unsorted[numVersion] = version
    }
    /** @type {Array<string>} */
    const sorted = []
    for (const sortKey of Object.keys(unsorted).sort()) {
        const key = unsorted[sortKey]
        sorted.push(key)
    }
    return sorted
}

/**
 * Renders the table on the 'Languages' tab.
 */
function renderUploadsTable() {
    log('Updating uploads:', config.uploads);
    const $tbody = $('div.translator-em tbody.uploads-body');
    // Remove all rows
    $tbody.children().remove();
    // Create rows
    for (const key of sortUploads()) {
        /** @type UploadData */
        const upload = config.uploads[key];
        const $row = getTemplate('uploads-row');
        $row.attr('data-version', upload.version);
        $row.find('[data-key]').each(function() {
            const $this = $(this);
            const name = $this.attr('data-key');
            if (name == undefined) return;
            if (name == 'version') {
                $this.text(upload.version);
            }
            else if (name == 'type') {
                $this.text(upload.upgrade ? 'Upgrade' : 'Full Install');
            }
            else if (name == 'size') {
                $this.text(Math.ceil(upload.size / 1024 / 1024).toFixed(1));
            }
        });
        $row.find('[data-action]').attr('data-version', upload.version);
        $tbody.append($row)
    }
}

/**
 * Handles actions from the Uploads table
 * @param {string} action 
 * @param {string} version 
 */
function handleUploadsAction(action, version) {
    log('Uploads action:', action, version);
    switch(action) {
        case 'uploads-delete':
            JSMO.ajax(action, version)
            .then(function(response) {
                if (response.success) {
                    delete config.uploads[version];
                    renderUploadsTable();
                    showToast('#translator-successToast', 'Version \'' + version + '\' has been deleted.');
                }
            })
            .catch(function(err) {
                showToast('#translator-errorToast', 'Failed to delete version \'' + version + '\'. Check the console for details.');
                error('Failed to delete version \'' + version + '\':', err);
            });
        break;
        case 'uploads-get-zip':
        case 'uploads-get-strings':
            const url = new URL(config.downloadUrl);
            url.searchParams.append('mode', action.replace('uploads-get-', ''));
            url.searchParams.append('version', version);
            log('Requestiong download from:',url);
            showToast('#translator-successToast', 'Initiated download of version \'' + version + '\' ZIP file. The download should start momentarily.');
            // @ts-ignore
            window.location = url;
        break;
    }
}

/**
 * Uploads a ZIP file.
 * @param {JQuery.TriggeredEvent} event
 */
function uploadZip(event) {
    const $file = $('div.translator-em input[name=upload-zip]');
    const $filename = $('div.translator-em label[for=upload-zip] span.filename');
    const $spinner = $('div.translator-em label[for=upload-zip] .processing-file');
    const $progress = $('div.translator-em label[for=upload-zip] [data-upload-progress]');
    const $invalid = $('div.translator-em div.invalid-feedback');
    $filename.html('Choose or drop ZIP file&hellip;');
    $file.removeClass('is-valid').removeClass('is-invalid');
    $spinner.addClass('hide');
    const files = $file.prop('files')
    if (files.length === 1) {
        const file = files[0];
        $filename.text(file.name);
        // REDCap install/upgrade file regex: https://regex101.com/r/QDOxi6/2
        const regex = /^redcap(?<version>\d+\.\d+\.\d+)(_upgrade){0,1}\.zip$/gm;
        if (!regex.test(file.name)) {
            $file.addClass('is-invalid');
            event.target.setCustomValidity('Invalid');
            $invalid.text('This is not a valid REDCap package.');
        }
        else {
            $file.removeClass('is-valid').addClass('is-valid');
            $spinner.removeClass('hide');
            log('Uploading: "' + file.name + '"');
            const formData = new FormData();
            formData.append("redcap_zip", file, file.name);
            formData.append('redcap_csrf_token', config.csrfToken);
            $.ajax({
                type: "POST",
                url: config.uploadUrl,
                xhr: function () {
                    const xhr = new XMLHttpRequest();
                    if (xhr.upload) {
                        xhr.upload.addEventListener('progress', function(e) {
                            let percent = 0;
                            if (e.lengthComputable) {
                                percent = Math.ceil(e.loaded / e.total * 100);
                            }
                            $progress.text(percent.toString());
                        }, false);
                    }
                    return xhr;
                },
                success: function (response) {
                    $spinner.addClass('hide');
                    const data = JSON.parse(response)
                    if (data.success) {
                        showToast('#translator-successToast', 'File has been uploaded.');
                        log('File upload succeeded:', data);
                        config.uploads[data.version] = {
                            version: data.version,
                            upgrade: data.upgrade,
                            size: data.size,
                        };
                        renderUploadsTable();
                    }
                    else {
                        $file.addClass('is-invalid').removeClass('is-valid');
                        event.target.setCustomValidity('Invalid');
                        $invalid.text(data.error);
                        error('File upload failed: ' + data.error);
                    }
                },
                error: function (err) {
                    $spinner.addClass('hide');
                    showToast('#translator-errorToast', 'Failed to upload the file. See console for details.');
                    error('Error', err);
                },
                async: true,
                data: formData,
                cache: false,
                contentType: false,
                processData: false,
                timeout: 0
            });

        }
    }
}

//#endregion

/**
 * Handles actions (mouse clicks on links, buttons)
 * @param {JQuery.TriggeredEvent} event 
 */
function handleActions(event) {
    var $source = $(event.target)
    var action = $source.attr('data-action')
    if (!action) {
        $source = $source.parents('[data-action]')
        action = $source.attr('data-action')
    }
    if (!action || $source.prop('disabled')) return
    switch (action) {
        case 'main-nav':
            var target = $source.attr('data-nav-target') ?? ''
            activateTab(target)
            break;
        case 'uploads-get-strings':
        case 'uploads-get-zip':
        case 'uploads-delete':
            handleUploadsAction(action, ($source.attr('data-version') ?? '').toString());
            break;
        // ???
        default:
            warn('Unknown action: ' + action)
            break
    }
}


/**
 * Switches between main tabs.
 * @param {string} tab The name of the tab to navigate to
 */
function activateTab(tab) {
    currentTab = tab;
    log('Activating tab: ' + tab);
    $('a[data-nav-target]').parent().removeClass('active')
    $('a[data-nav-target="' + tab + '"]').parent().addClass('active')
    $('div[data-nav-tab]').addClass('d-none')
    $('div[data-nav-tab="' + tab + '"]').removeClass('d-none')
}




//#region -- Debug Logging

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
    if (!config.debug) return
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
    var prompt = 'REDCap Translator [' + ln + ']'
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

/**
 * Gets a template by name and returns its jQuery representation
 * @param {string} name 
 * @returns {JQuery<HTMLElement>}
 */
function getTemplate(name) {
    var $tpl = $($('[data-template="' + name + '"]').html())
    return $tpl
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


})();