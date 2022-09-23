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
        // Translations 
        $('div.translator-em [data-uploader="translation-json"] input[type="file"]').on('change', uploadTranslationJson);
        // Metadata 
        $('div.translator-em [data-uploader="metadata-json"] input[type="file"]').on('change', uploadMetadataJson);
        // Packages 
        $('div.translator-em [data-uploader="package-zip"] input[type="file"]').on('change', uploadZip);
        // Tools
        $('div.translator-em [data-uploader="convert-ini-to-json"] input[type="file"]').on('change', convertIniToJson);
        $('div.translator-em [data-uploader="convert-mlm-to-json"] input[type="file"]').on('change', convertMlmToJson);
        // Settings
        $('div.translator-em [data-type="setting"]').on('change', updateSetting);


        validateCreateNewForm(true);
        renderTranslationsTab();
        renderMetadataTab();
        renderPackagesTab();
        renderToolsTab();
        renderSettingsTab();
        activateTab('metadata');
    });
};

var currentTab = '';

//#endregion

//#region Translations

function validateCreateNewForm(e) {
    let valid = true;
    let showInvalid = false;
    const $name = $('input[data-em-para="create-lang-name"]');
    const $localizedName = $('input[data-em-para="create-lang-localizedname"]');
    const $iso = $('input[data-em-para="create-lang-iso"]');
    if (e === true) {
        $('[data-form="create-new-translation"] input').on('keyup change', validateCreateNewForm).removeClass('is-invalid').removeClass('is-valid');
    }
    else if (e == 'clear') {
        $name.val('').removeClass('is-valid').removeClass('is-invalid');
        $localizedName.val('');
        $iso.val('');
        validateCreateNewForm();
        return;
    }
    const $invalid = $('[data-form="create-new-translation"] .invalid-feedback');
    const $create = $('[data-action="create-new-translation"]');
    const name = ($name.val() ?? '').toString();
    const localizedName = ($localizedName.val() ?? '').toString();
    const iso = ($iso.val() ?? '').toString();
    const nameRegex = /^[A-Za-z_-]+$/m;
    if (nameRegex.test(name)) {
        $name.removeClass('is-invalid').addClass('is-valid');
    }
    else if (name == '') {
        $name.removeClass('is-invalid').removeClass('is-valid');
        valid = false;
    }
    else {
        $name.removeClass('is-valid').addClass('is-invalid');
        valid = false;
        showInvalid = true;
    }
    if (localizedName == '') {
        valid = false;
    }
    $invalid[showInvalid ? 'show' : 'hide']();
    $create.prop('disabled', !valid);
    return valid ? {
        name: name,
        'localized-name': localizedName,
        iso: iso,
        strings: []
    } : false;
}

/**
 * Handles actions from the Translations table
 * @param {string} action 
 * @param {string} name 
 * @param {string} basedOn
 */
 function handleTranslationsAction(action, name, basedOn) {
    log('Language action:', action, name);
    switch(action) {
        case 'create-new-translation': {
            const data = validateCreateNewForm();
            if (data) {
                JSMO.ajax(action, data)
                .then(function(response) {
                    if (response.success) {
                        validateCreateNewForm('clear');
                        config.translations[response.data.name] = {
                            name: response.data.name,
                            'localized-name': response.data['localized-name'],
                            iso: response.data.iso,
                            coverage: response.data.coverage,
                            updated: response.data.timestamp
                        };
                        renderTranslationsTab();
                        showToast('#translator-successToast', 'Language \'' + data.name + '\' has been created.');
                    }
                    else {
                        showToast('#translator-errorToast', 'Failed to create new language \'' + data.name + '\'. Check the console for details.');
                        error('Failed to create new language \'' + data.name + '\':', response.error);
                    }
                })
                .catch(function(err) {
                    showToast('#translator-errorToast', 'Failed to create new language \'' + data.name + '\'. Check the console for details.');
                    error('Failed to create new language \'' + data.name + '\':', err);
                })
            }
        }
        break;
        case 'translation-delete': {
            JSMO.ajax(action, name)
            .then(function(response) {
                log('Ajax: ', response)
                if (response.success) {
                    delete config.translations[name];
                    renderTranslationsTab();
                    showToast('#translator-successToast', 'Language \'' + name + '\' has been deleted.');
                }
                else {
                    showToast('#translator-errorToast', 'Failed to delete language \'' + name + '\'. Check the console for details.');
                    error('Failed to delete language \'' + name + '\':', response.error);
                }
            })
            .catch(function(err) {
                showToast('#translator-errorToast', 'Failed to delete language \'' + name + '\'. Check the console for details.');
                error('Failed to delete language \'' + name + '\':', err);
            });
        }
        break;
        case 'translation-get-ini':
        case 'translation-get-json':
        case 'translation-get-in-screen-ini': {
            const url = new URL(config.downloadUrl);
            url.searchParams.append('mode', action);
            url.searchParams.append('name', name);
            url.searchParams.append('based-on', basedOn);
            log('Requesting download from:', url);
            showToast('#translator-successToast', 'Initiated download of language \'' + name + '\' file. The download should start momentarily.');
            setTimeout(() => {
                // @ts-ignore
                window.location = url;
            }, 400);
        }
        break;
    }
}

/**
 * Renders the 'Translations' tab.
 */
 function renderTranslationsTab() {
    // Versions
    addVersions($('[data-nav-tab="translations"] select[data-em-para="translation-based-on"]'), sortByVersion(config.metadataFiles));
    log('Updating translations:', config.translations);

    const $tbody = $('div.translator-em tbody.translations-body');
    // Remove all rows
    $tbody.children().remove();
    const langs = Object.keys(config.translations).sort();
    if (langs.length) {
        // Create rows
        for (const key of langs) {
            /** @type TranslationData */
            const language = config.translations[key];
            const $row = getTemplate('translations-row');
            $row.attr('data-name', language.name);
            $row.find('[data-key]').each(function() {
                const $this = $(this);
                const name = $this.attr('data-key') ?? '';
                if (['name','localized-name','iso','coverage','updated'].includes(name)) {
                    $this.text(language[name]);
                }
            });
            $row.find('[data-action]').attr('data-name', language.name);
            $tbody.append($row)
        }
    }
    else {
        $tbody.append(getTemplate('translations-empty'));
    }
}

/**
 * Uploads a language JSON file.
 * @param {JQuery.TriggeredEvent} event
 */
 function uploadTranslationJson(event) {
    const $uploader = $('div.translator-em [data-uploader="translation-json"]');
    const $file = $uploader.find('input[type=file]');
    const $filename = $uploader.find('span.filename');
    const $spinner = $uploader.find('.processing-file');
    const $progress = $uploader.find('[data-upload-progress]');
    const $invalid = $uploader.find('.invalid-feedback');
    $filename.html('Choose or drop JSON file&hellip;');
    $file.removeClass('is-valid').removeClass('is-invalid');
    $spinner.addClass('hide');
    const files = $file.prop('files')
    if (files && files.length === 1) {
        const file = files[0];
        $filename.text(file.name);
        const regex = /\.[jJ][sS][oO][nN]$/gm;
        if (!regex.test(file.name)) {
            $file.addClass('is-invalid');
            event.target.setCustomValidity('Invalid');
            $invalid.text('Invalid file name. It must have a JSON extension.');
        }
        else {
            $file.removeClass('is-valid').addClass('is-valid');
            $spinner.removeClass('hide');
            log('Uploading: "' + file.name + '"');
            const formData = new FormData();
            formData.append('mode', 'translation-json');
            formData.append('file', file, file.name);
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
                        config.translations[data.name] = {
                            name: data.name,
                            'localized-name': data['localized-name'],
                            iso: data.iso,
                            coverage: data.coverage,
                            updated: data.timestamp
                        };
                        $file.val('');
                        // @ts-ignore
                        uploadTranslationJson(null);
                        renderTranslationsTab();
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

/**
 * Renders the table on the 'Packages' tab.
 */
function renderPackagesTab() {
    log('Updating packages:', config.packages);
    const $tbody = $('div.translator-em tbody.packages-body');
    // Remove all rows
    $tbody.children().remove();
    const keys = sortByVersion(config.packages);
    if (keys.length) {
        // Create rows
        for (const key of keys) {
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
                    updateMetadataTab();
                    showToast('#translator-successToast', 'Version \'' + version + '\' has been deleted.');
                }
                else {
                    showToast('#translator-errorToast', 'Failed to delete version \'' + version + '\'. Check the console for details.');
                    error('Failed to delete version \'' + version + '\':', response.error);
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
            log('Requesting download from:',url);
            showToast('#translator-successToast', 'Initiated download of version \'' + version + '\' file. The download should start momentarily.');
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
    const $file = $uploader.find('input[type=file]');
    const $filename = $uploader.find('span.filename');
    const $spinner = $uploader.find('.processing-file');
    const $progress = $uploader.find('[data-upload-progress]');
    const $invalid = $uploader.find('.invalid-feedback');
    $filename.html('Choose or drop ZIP file&hellip;');
    $file.removeClass('is-valid').removeClass('is-invalid');
    $spinner.addClass('hide');
    const files = $file.prop('files')
    if (files && files.length === 1) {
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
            formData.append('mode', 'package-zip');
            formData.append('file', file, file.name);
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
                        $file.val('');
                        // @ts-ignore
                        uploadZip();
                        updateMetadataTab();
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

//#region Metadata


function updateMetadataTab() {
    // Versions
    addVersions($('[data-nav-tab="metadata"] select[data-em-para="gen-metadata-based-on"]'), sortByVersion(config.packages));
    addVersions($('[data-nav-tab="metadata"] select[data-em-para="gen-metadata-merge-from"]'), sortByVersion(config.metadataFiles));
}

function renderMetadataTab() {
    updateMetadataTab();
    // Table
    const $tbody = $('div.translator-em tbody.metadata-body');
    // Remove all rows
    $tbody.children().remove();
    const metadatas = sortByVersion(config.metadataFiles);
    if (metadatas.length) {
        // Create rows
        for (const key of metadatas) {
            /** @type MetadataFileData */
            const metadata = config.metadataFiles[key];
            const $row = getTemplate('metadata-row');
            $row.attr('data-version', key);
            $row.find('[data-key]').each(function() {
                const $this = $(this);
                const name = $this.attr('data-key') ?? '';
                if (['version','updated','strings','annotations'].includes(name)) {
                    $this.text(metadata[name]);
                }
                else if (name == 'code') {
                    $this.html(metadata.code ? '<i class="fas fa-code"></i>' : '');
                }
            });
            $row.find('[data-action]').attr('data-version', key);
            $tbody.append($row)
        }
    }
    else {
        $tbody.append(getTemplate('metadata-empty'));
    }
}

function handleMetadataAction(action, version) {
    if (action == 'gen-metadata-json') {
        const basedOn = ($('select[data-em-para="gen-metadata-based-on"]').val() ?? '').toString();
        const mergeFrom = ($('select[data-em-para="gen-metadata-merge-from"]').val() ?? '').toString();
        const addCode = $('input[data-em-para="gen-metadata-add-code"]').prop('checked') == true;
        const url = new URL(config.downloadUrl);
        url.searchParams.append('mode', action);
        url.searchParams.append('version', basedOn);
        url.searchParams.append('previous', mergeFrom);
        url.searchParams.append('code', addCode ? '1' : '0');
        log('Requestiong download from:',url);
        showToast('#translator-successToast', 'Initiated download of strings metadata file. The download should start momentarily.');
        setTimeout(() => {
            // @ts-ignore
            window.location = url;
        }, 400);
    }
    else if (action == 'metadata-delete') {
        JSMO.ajax(action, version)
        .then(function(response) {
            if (response.success) {
                delete config.metadataFiles[version];
                renderMetadataTab();
                showToast('#translator-successToast', 'Version \'' + version + '\' has been deleted.');
            }
            else {
                showToast('#translator-errorToast', 'Failed to delete version \'' + version + '\'. Check the console for details.');
                error('Failed to delete version \'' + version + '\':', response.error);
            }
        })
        .catch(function(err) {
            showToast('#translator-errorToast', 'Failed to delete version \'' + version + '\'. Check the console for details.');
            error('Failed to delete version \'' + version + '\':', err);
        });
    }
}

/**
 * Uploads a language JSON file.
 * @param {JQuery.TriggeredEvent} event
 */
function uploadMetadataJson(event) {
    const $uploader = $('div.translator-em [data-uploader="metadata-json"]');
    const $file = $uploader.find('input[type=file]');
    const $filename = $uploader.find('span.filename');
    const $spinner = $uploader.find('.processing-file');
    const $progress = $uploader.find('[data-upload-progress]');
    const $invalid = $uploader.find('.invalid-feedback');
    $filename.html('Choose or drop a metadata file&hellip;');
    $file.removeClass('is-valid').removeClass('is-invalid');
    $spinner.addClass('hide');
    const files = $file.prop('files')
    if (files && files.length === 1) {
        const file = files[0];
        $filename.text(file.name);
        const regex = /\.[jJ][sS][oO][nN]$/gm;
        if (!regex.test(file.name)) {
            $file.addClass('is-invalid');
            event.target.setCustomValidity('Invalid');
            $invalid.text('Invalid file name. It must have a JSON extension.');
        }
        else {
            $file.removeClass('is-valid').addClass('is-valid');
            $spinner.removeClass('hide');
            log('Uploading: "' + file.name + '"');
            const formData = new FormData();
            formData.append('mode', 'metadata-json');
            formData.append('merge', ($('input[name="upload-metadata-option"]').val() ?? 'keep').toString());
            formData.append('file', file, file.name);
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
                success: function (raw) {
                    $spinner.addClass('hide');
                    const response = JSON.parse(raw)
                    if (response.success) {
                        showToast('#translator-successToast', 'File has been uploaded.');
                        log('File upload succeeded:', response);
                        const data = response.data;
                        config.metadataFiles[data.version] = data;
                        $file.val('');
                        // @ts-ignore
                        uploadMetadataJson(null);
                        renderMetadataTab();
                    }
                    else {
                        $file.addClass('is-invalid').removeClass('is-valid');
                        event.target.setCustomValidity('Invalid');
                        $invalid.text(response.error);
                        error('File upload failed: ' + response.error);
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

}

/**
 * Uploads a language INI file for conversion.
 * @param {JQuery.TriggeredEvent} event
 */
function convertIniToJson(event) {
    const $uploader = $('div.translator-em [data-uploader="convert-ini-to-json"]');
    const $file = $uploader.find('input[type=file]');
    const $filename = $uploader.find('span.filename');
    const $spinner = $uploader.find('.processing-file');
    const $progress = $uploader.find('[data-upload-progress]');
    const $invalid = $uploader.find('.invalid-feedback');
    $filename.html('Choose or drop INI file&hellip;');
    $file.removeClass('is-valid').removeClass('is-invalid');
    $spinner.addClass('hide');
    const files = $file.prop('files')
    if (files && files.length === 1) {
        const file = files[0];
        $filename.text(file.name);
        const regex = /.+\.[iI][nN][iI]$/gm;
        if (!regex.test(file.name)) {
            $file.addClass('is-invalid');
            event.target.setCustomValidity('Invalid');
            $invalid.text('Invalid file name. It must have an INI extension.');
        }
        else {
            $file.removeClass('is-valid').addClass('is-valid');
            $spinner.removeClass('hide');
            log('Uploading: "' + file.name + '"');
            const formData = new FormData();
            formData.append('mode', 'ini-to-json');
            formData.append('file', file, file.name);
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
                        showToast('#translator-successToast', 'File has been converted. Download will start momentarily.');
                        log('File upload succeeded:', data);
                        $file.val('');
                        // @ts-ignore
                        convertIniToJson(null);
                        const blob = new Blob([data.json], { type: "text/plain;charset=utf-8" })
                        // @ts-ignore
                        saveAs(blob, data.filename);
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
/**
 * Uploads a MLM language file for conversion.
 * @param {JQuery.TriggeredEvent} event
 */
function convertMlmToJson(event) {
    const $uploader = $('div.translator-em [data-uploader="convert-mlm-to-json"]');
    const $file = $uploader.find('input[type=file]');
    const $filename = $uploader.find('span.filename');
    const $spinner = $uploader.find('.processing-file');
    const $progress = $uploader.find('[data-upload-progress]');
    const $invalid = $uploader.find('.invalid-feedback');
    $filename.html('Choose or drop MLM JSON file&hellip;');
    $file.removeClass('is-valid').removeClass('is-invalid');
    $spinner.addClass('hide');
    const files = $file.prop('files')
    if (files && files.length === 1) {
        const file = files[0];
        $filename.text(file.name);
        const regex = /.+\.[jJ][sS][oO][nN]$/gm;
        if (!regex.test(file.name)) {
            $file.addClass('is-invalid');
            event.target.setCustomValidity('Invalid');
            $invalid.text('Invalid file name. It must have a JSON extension.');
        }
        else {
            $file.removeClass('is-valid').addClass('is-valid');
            $spinner.removeClass('hide');
            log('Uploading: "' + file.name + '"');
            const formData = new FormData();
            formData.append('mode', 'mlm-to-json');
            formData.append('file', file, file.name);
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
                        showToast('#translator-successToast', 'File has been converted. Download will start momentarily.');
                        log('File upload succeeded:', data);
                        $file.val('');
                        // @ts-ignore
                        convertMlmToJson(null);
                        const blob = new Blob([data.json], { type: "text/plain;charset=utf-8" })
                        // @ts-ignore
                        saveAs(blob, data.filename);
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
    let $source = $(event.target)
    let action = $source.attr('data-action')
    if (!action) {
        $source = $source.parents('[data-action]')
        action = $source.attr('data-action')
    }
    if (!action || $source.prop('disabled')) return
    switch (action) {
        case 'main-nav': {
            const target = $source.attr('data-nav-target') ?? ''
            activateTab(target)
        }
        break;
        case 'package-get-strings':
        case 'package-get-zip':
        case 'package-delete': 
        {
            handlePackagesAction(action, ($source.attr('data-version') ?? '').toString());
        }
        break;
        case 'gen-metadata-json':
        case 'metadata-delete':
        {
            handleMetadataAction(action, ($source.parents('tr').attr('data-version') ?? '').toString());
        }
        break;
        case 'create-new-translation':
        case 'translation-delete':
        case 'translation-get-json':
        case 'translation-get-ini':
        case 'translation-get-in-screen-ini': 
        {
            const name = ($source.attr('data-name') ?? '').toString();
            const basedOn = ($('[data-em-para="translation-based-on"]').val() ?? '').toString();
            handleTranslationsAction(action, name, basedOn);
        }
        break;
        // ???
        default: 
        {
            warn('Unknown action: ' + action)
        }
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

function sortByVersion(source) {
    const unsorted = {};
    for (const version of Object.keys(source)) {
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

/**
 * 
 * @param {JQuery<HTMLElement>} $select 
 * @param {string[]} source 
 */
function addVersions($select, source) {
    $select.html('');
    for (const key of source) {
        const $opt = $('<option></option>');
        $opt.prop('selected', key == 'current');
        $opt.val(key);
        $opt.text(key);
        $select.append($opt);
    }
    if (!$select[0].hasAttribute('data-select2-id')) {
        // @ts-ignore
        $select.select2();
    }
}

//#endregion

})();

//#region Libs
/*!
 * FileSaver.js 2.0.4 https://github.com/eligrey/FileSaver.js
 * Copyright © 2016 Eli Grey.
 * Licensed under MIT (https://github.com/eligrey/FileSaver.js/blob/master/LICENSE.md)
 */
// @ts-ignore
(function(a,b){if("function"==typeof define&&define.amd)define([],b);else if("undefined"!=typeof exports)b();else{b(),a.FileSaver={exports:{}}.exports}})(this,function(){"use strict";function b(a,b){return"undefined"==typeof b?b={autoBom:!1}:"object"!=typeof b&&(console.warn("Deprecated: Expected third argument to be a object"),b={autoBom:!b}),b.autoBom&&/^\s*(?:text\/\S*|application\/xml|\S*\/\S*\+xml)\s*;.*charset\s*=\s*utf-8/i.test(a.type)?new Blob(["\uFEFF",a],{type:a.type}):a}function c(a,b,c){var d=new XMLHttpRequest;d.open("GET",a),d.responseType="blob",d.onload=function(){g(d.response,b,c)},d.onerror=function(){console.error("could not download file")},d.send()}function d(a){var b=new XMLHttpRequest;b.open("HEAD",a,!1);try{b.send()}catch(a){}return 200<=b.status&&299>=b.status}function e(a){try{a.dispatchEvent(new MouseEvent("click"))}catch(c){var b=document.createEvent("MouseEvents");b.initMouseEvent("click",!0,!0,window,0,0,0,80,20,!1,!1,!1,!1,0,null),a.dispatchEvent(b)}}var f="object"==typeof window&&window.window===window?window:"object"==typeof self&&self.self===self?self:"object"==typeof global&&global.global===global?global:void 0,a=/Macintosh/.test(navigator.userAgent)&&/AppleWebKit/.test(navigator.userAgent)&&!/Safari/.test(navigator.userAgent),g=f.saveAs||("object"!=typeof window||window!==f?function(){}:"download"in HTMLAnchorElement.prototype&&!a?function(b,g,h){var i=f.URL||f.webkitURL,j=document.createElement("a");g=g||b.name||"download",j.download=g,j.rel="noopener","string"==typeof b?(j.href=b,j.origin===location.origin?e(j):d(j.href)?c(b,g,h):e(j,j.target="_blank")):(j.href=i.createObjectURL(b),setTimeout(function(){i.revokeObjectURL(j.href)},4E4),setTimeout(function(){e(j)},0))}:"msSaveOrOpenBlob"in navigator?function(f,g,h){if(g=g||f.name||"download","string"!=typeof f)navigator.msSaveOrOpenBlob(b(f,h),g);else if(d(f))c(f,g,h);else{var i=document.createElement("a");i.href=f,i.target="_blank",setTimeout(function(){e(i)})}}:function(b,d,e,g){if(g=g||open("","_blank"),g&&(g.document.title=g.document.body.innerText="downloading..."),"string"==typeof b)return c(b,d,e);var h="application/octet-stream"===b.type,i=/constructor/i.test(f.HTMLElement)||f.safari,j=/CriOS\/[\d]+/.test(navigator.userAgent);if((j||h&&i||a)&&"undefined"!=typeof FileReader){var k=new FileReader;k.onloadend=function(){var a=k.result;a=j?a:a.replace(/^data:[^;]*;/,"data:attachment/file;"),g?g.location.href=a:location=a,g=null},k.readAsDataURL(b)}else{var l=f.URL||f.webkitURL,m=l.createObjectURL(b);g?g.location=m:location.href=m,g=null,setTimeout(function(){l.revokeObjectURL(m)},4E4)}});f.saveAs=g.saveAs=g,"undefined"!=typeof module&&(module.exports=g)});
//#endregion