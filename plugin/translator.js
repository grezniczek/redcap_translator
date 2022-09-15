/* REDCap Translator EM */

// @ts-check
;(function() {

//#region Variables and Initialization

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
        // Languages 
        $('div.translator-em input[name=upload-lang-json]').on('change', uploadLanguageJson);
        // Packages 
        $('div.translator-em input[name=package-zip]').on('change', uploadZip);
        // Settings
        $('div.translator-em [data-type="setting"]').on('change', updateSetting);


        renderLanguagesTab();
        renderPackagesTab();
        renderToolsTab();
        renderSettingsTab();
        activateTab('languages');
    });
};

var currentTab = '';

//#endregion

//#region Languages

function sortLanguages() {
    const sorted = {};
    for (const name of Object.keys(config.languages).sort()) {
        sorted.push(config.languages[name]);
    }
    return sorted;
}

/**
 * Renders the 'Languages' tab.
 */
 function renderLanguagesTab() {
    // Versions
    addVersions($('[data-nav-tab="languages"] select[data-em-para="create-lang-basedon"]'));
    log('Updating languages:', config.languages);

    const $tbody = $('div.translator-em tbody.languages-body');
    // Remove all rows
    $tbody.children().remove();
    const keys = sortLanguages();
    if (keys.length) {
        // Create rows
        for (const key in sortLanguages()) {
            /** @type LanguageData */
            const language = config.languages[key];
            const $row = getTemplate('languages-row');
            $row.attr('data-name', language.name);
            $row.find('[data-key]').each(function() {
                const $this = $(this);
                const name = $this.attr('data-key') ?? '';
                if (['name','localized-name','coverage'].includes(name)) {
                    $this.text(language[name]);
                }
            });
            $row.find('[data-action]').attr('data-name', language.name);
            $tbody.append($row)
        }
    }
    else {
        $tbody.append(getTemplate('languages-empty'));
    }
}

/**
 * Uploads a language JSON file.
 * @param {JQuery.TriggeredEvent} event
 */
 function uploadLanguageJson(event) {
    const $uploader = $('div.translator-em [data-uploader="lang-json"]');
    const $file = $uploader.find('input[name=package-zip]');
    const $filename = $uploader.find('span.filename');
    const $spinner = $uploader.find('.processing-file');
    const $progress = $uploader.find('[data-upload-progress]');
    const $invalid = $uploader.find('.invalid-feedback');
    $filename.html('Choose or drop JSON file&hellip;');
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
                        config.packages[data.version] = {
                            version: data.version,
                            upgrade: data.upgrade,
                            size: data.size,
                        };
                        renderPackagesTab();
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

//#region Packages

function sortPackages() {
    const unsorted = {};
    for (const version of Object.keys(config.packages)) {
        const parts = version.split('.');
        const numVersion = 
            Number.parseInt(parts[0]) * 10000 +
            Number.parseInt(parts[1]) * 100 +
            Number.parseInt(parts[2]);
        unsorted[numVersion] = version;
    }
    /** @type {Array<string>} */
    const sorted = [];
    for (const sortKey of Object.keys(unsorted).sort().reverse()) {
        const key = unsorted[sortKey];
        sorted.push(key);
    }
    return sorted;
}

/**
 * Renders the table on the 'Packages' tab.
 */
function renderPackagesTab() {
    log('Updating packages:', config.packages);
    const $tbody = $('div.translator-em tbody.packages-body');
    // Remove all rows
    $tbody.children().remove();
    const keys = sortPackages();
    if (keys.length) {
        // Create rows
        for (const key of sortPackages()) {
            /** @type PackageData */
            const package = config.packages[key];
            const $row = getTemplate('packages-row');
            $row.attr('data-version', package.version);
            $row.find('[data-key]').each(function() {
                const $this = $(this);
                const name = $this.attr('data-key');
                if (name == undefined) return;
                if (name == 'version') {
                    $this.text(package.version);
                }
                else if (name == 'type') {
                    $this.text(package.upgrade ? 'Upgrade' : 'Full Install');
                }
                else if (name == 'size') {
                    $this.html((package.size / 1024 / 1024).toFixed(1) + 'M');
                }
            });
            $row.find('[data-action]').attr('data-version', package.version);
            $tbody.append($row)
        }
    }
    else {
        $tbody.append(getTemplate('packages-empty'));
    }
}

/**
 * Handles actions from the Packages table
 * @param {string} action 
 * @param {string} version 
 */
function handlePackagesAction(action, version) {
    log('Packages action:', action, version);
    switch(action) {
        case 'package-delete':
            JSMO.ajax(action, version)
            .then(function(response) {
                if (response.success) {
                    delete config.packages[version];
                    renderPackagesTab();
                    showToast('#translator-successToast', 'Version \'' + version + '\' has been deleted.');
                }
            })
            .catch(function(err) {
                showToast('#translator-errorToast', 'Failed to delete version \'' + version + '\'. Check the console for details.');
                error('Failed to delete version \'' + version + '\':', err);
            });
        break;
        case 'package-get-zip':
        case 'package-get-strings':
            const url = new URL(config.downloadUrl);
            url.searchParams.append('mode', action);
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
    const $uploader = $('div.translator-em [data-uploader="package-zip"]');
    const $file = $uploader.find('input[name=package-zip]');
    const $filename = $uploader.find('span.filename');
    const $spinner = $uploader.find('.processing-file');
    const $progress = $uploader.find('[data-upload-progress]');
    const $invalid = $uploader.find('.invalid-feedback');
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
                        config.packages[data.version] = {
                            version: data.version,
                            upgrade: data.upgrade,
                            size: data.size,
                        };
                        renderPackagesTab();
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

//#region Tools

function renderToolsTab() {
    // Versions
    addVersions($('[data-nav-tab="tools"] select[data-em-para="based-on"]'));
}

function handleToolsAction(action) {
    if (action == 'gen-metadata-json') {
        const basedOn = ($('[data-nav-tab="tools"] select[data-em-para="based-on"]').val() ?? '').toString();
        const withCode = $('[data-nav-tab="tools"] input[data-em-para="gen-json-with-code"]').prop('checked') == true;
        const withCodeBrute = $('[data-nav-tab="tools"] input[data-em-para="gen-json-with-code-brute"]').prop('checked') == true;
        const url = new URL(config.downloadUrl);
        url.searchParams.append('mode', action);
        url.searchParams.append('version', basedOn);
        url.searchParams.append('code', withCode ? '1' : '0');
        url.searchParams.append('brute', withCodeBrute ? '1' : '0');
        log('Requestiong download from:',url);
        showToast('#translator-successToast', 'Initiated download of strings metadata file. The download should start momentarily.');
        // @ts-ignore
        window.location = url;
    }
}

//#endregion

//#region Settings

/**
 * Handles actions (mouse clicks on links, buttons)
 * @param {JQuery.TriggeredEvent} event 
 */
function updateSetting(event) {
    const $el = $(event.target);
    const setting = $el.attr('data-setting');
    const val = $el.prop('checked');
    switch (setting) {
        case 'debug': {
            JSMO.ajax('settings-update', { setting: setting, value: val })
            .then(function(data) {
                if (data.success) {
                    showToast('#translator-successToast', 'The setting has been updated.');
                    config.debug = true;
                    log('Setting update succeeded:', data);
                    config.debug = val;
                }
                else {
                    showToast('#translator-errorToast', 'Failed to update the setting. Please check the console for details.');
                    error('Failed to update setting \'' + setting + '\': ' + data.error);
                    $el.prop('checked', config.debug);
                }

            })
            .catch(function(err) {
                showToast('#translator-errorToast', 'Failed to update the setting. Please check the console for details.');
                error('Failed to update the setting \'' + setting + '\'', err);
                $el.prop('checked', config.debug);
            });
        }
        break;
        default: {
            warn('Unknown setting \'' + setting + '\'.', event);
        }
        break;
    }
}

function renderSettingsTab() {
    const $tab = $('div[data-nav-tab="settings"]');
    $tab.find('input[data-setting="debug"]').prop('checked', config.debug);
}

//#endregion

//#region Navigation and Actions

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
        case 'package-get-strings':
        case 'package-get-zip':
        case 'package-delete':
            handlePackagesAction(action, ($source.attr('data-version') ?? '').toString());
            break;
        case 'gen-metadata-json':
            handleToolsAction(action);
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

//#region Helpers

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

function addVersions($select) {
    for (const key of sortPackages()) {
        const $opt = $('<option></option>');
        $opt.prop('selected', key == 'current');
        $opt.val(key);
        $opt.text(key);
        $select.append($opt);
    }
    // @ts-ignore
    $select.select2();
}

//#endregion

})();