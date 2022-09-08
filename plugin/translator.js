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

/**
 * Initializes the REDCap Translator plugin page
 * @param {REDCapTranslator_Config} data 
 */
THIS.init = function(data) {
    config = data;

    $(function() {
        log('Initialized.', config);

        // Handle actions
        // General
        $('div.translator-em').on('click', handleActions);
        // Uploads 
        $('div.translator-em input[name=upload-zip]').on('change', uploadZip);

        activateTab('uploads');
    });
};

var currentTab = '';



//#region Uploads

/**
 * Uploads a ZIP file.
 * @param {JQuery.TriggeredEvent} event
 */
 function uploadZip(event) {
    const $file = $('div.translator-em input[name=upload-zip]');
    const $filename = $('div.translator-em label[for=upload-zip] span.filename');
    const $spinner = $('div.translator-em label[for=upload-zip] .processing-file');
    const $progress = $('div.translator-em label[for=upload-zip] [data-upload-progress]');
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
                    const myXhr = $.ajaxSettings.xhr();
                    if (myXhr.upload) {
                        myXhr.upload.addEventListener('progress', function(e) {
                            let percent = 0;
                            const position = e.loaded || e.position;
                            const total = e.total;
                            if (e.lengthComputable) {
                                percent = Math.ceil(position / total * 100);
                            }
                            $progress.text(percent.toString());
                            log('Progress', e);
                        }, false);
                    }
                    return myXhr;
                },
                success: function (data) {
                    $spinner.addClass('hide');
                    showToast('#translator-successToast', 'File has been uploaded.');
                    log('Success', data);
                    // your callback here
                },
                error: function (err) {
                    $spinner.addClass('hide');
                    showToast('#translator-errorToast', 'Failed to upload the file. See console for details.');
                    error('Error', err);
                    // handle error
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

    log('Handling action "' + action + '" from:', $source)

    switch (action) {
        case 'main-nav':
            var target = $source.attr('data-nav-target') ?? ''
            activateTab(target)
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
    log('Toast', $toast)
    $toast.find('[data-content=toast]').html(msg)
    // @ts-ignore
    $toast.toast('show')
}




})();