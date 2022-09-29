<?php namespace RUB\REDCapTranslatorExternalModule;

class REDCapTranslatorPlugin {
    /**
     * @var REDCapTranslatorExternalModule
     */
    private static $m;

    /**
     * @param REDCapTranslatorExternalModule $m 
     * @return void 
     */
    static function init($m)
    {
        self::$m = $m;
        $m->initializeJavascriptModuleObject();
        $m->ih->css("plugin/translation-assistant.css");
        $m->ih->js("plugin/translation-assistant.js");
    }

    static function get_settings()
    {
        // Prepare initialization object
        $settings = array(
            "debug" => self::$m->getSystemSetting(REDCapTranslatorExternalModule::DEBUG_SETTING_NAME) === true,
            "jsmoName" => self::$m->getJavascriptModuleObjectName(),
            "uploadUrl" => self::$m->getUrl("plugin/upload.php"),
            "downloadUrl" => self::$m->getUrl("plugin/download.php"),
            "csrfToken" => self::$m->getCSRFToken(),
            "invisibleChar1" => REDCapTranslatorExternalModule::INVISIBLE_CHAR_1,
            "invisibleChar2" => REDCapTranslatorExternalModule::INVISIBLE_CHAR_2,
            "password" => self::$m->get_password(),
            "state" => self::$m->get_state(),
        );
        // Metadata files
        $metadata_files = self::$m->get_metadata_files();
        $settings["metadataFiles"] = $metadata_files;
        // Translations
        $settings["translations"] = self::$m->get_translations();
        $current_translation = self::$m->get_current_translation();
        $settings["currentTranslation"] = $current_translation["name"];
        $settings["currentTranslationBasedOn"] = $current_translation["based-on"];
        // In screen
        $in_screen_enabled = self::$m->getSystemSetting(REDCapTranslatorExternalModule::INSCREEN_ENABLED_SETTING_NAME) === true;
        $settings["inScreenEnabled"] = $in_screen_enabled;
        // Packages
        $packages = [];
        $store = self::$m->getSystemSetting(REDCapTranslatorExternalModule::PACKAGES_SETTING_NAME);
        foreach ($store as $version => $doc_id) {
            list($name, $size) = \Files::getEdocNameAndSize($doc_id);
            $packages[$version] = [
                "version" => $version,
                "size" => $size * 1,
                "upgrade" => strpos($name, "_upgrade") > 0,
            ];
        }
        $settings["packages"] = $packages;

        return json_encode($settings, JSON_FORCE_OBJECT);
    }
}
REDCapTranslatorPlugin::init($module);
?>
<div class="translator-em">
    <h1 style="margin-top:0;"><i class="fas fa-language"></i> REDCap Translation Assistant</h1>
    <?php #region Navigation 
    ?>
    <div id="sub-nav" class="d-sm-block" style="margin-bottom:0.5em !important;">
        <ul>
            <li class="active mt-1">
                <a href="javascript:;" data-action="main-nav" data-nav-target="info" style="font-size:13px;color:#393733;padding:7px 9px;"><i class="fas fa-info-circle"></i> Info</a>
            </li>
            <li class="mt-1">
                <a href="javascript:;" data-action="main-nav" data-nav-target="translate" style="font-size:13px;color:#393733;padding:7px 9px;"><i class="fas fa-exchange-alt"></i> Translate</a>
            </li>
            <li class="mt-1">
                <a href="javascript:;" data-action="main-nav" data-nav-target="translations" style="font-size:13px;color:#393733;padding:7px 9px;"><i class="fas fa-globe"></i> Translations</a>
            </li>
            <li class="mt-1">
                <a href="javascript:;" data-action="main-nav" data-nav-target="metadata" style="font-size:13px;color:#393733;padding:7px 9px;"><i class="fas fa-layer-group"></i> Strings Metadata</a>
            </li>
            <li class="mt-1">
                <a href="javascript:;" data-action="main-nav" data-nav-target="packages" style="font-size:13px;color:#393733;padding:7px 9px;"><i class="fas fa-archive"></i> Packages</a>
            </li>
            <li class="mt-1">
                <a href="javascript:;" data-action="main-nav" data-nav-target="tools" style="font-size:13px;color:#393733;padding:7px 9px;"><i class="fas fa-wrench"></i> Tools</a>
            </li>
            <li class="mt-1">
                <a href="javascript:;" data-action="main-nav" data-nav-target="settings" style="font-size:13px;color:#393733;padding:7px 9px;"><i class="fas fa-cog"></i> Settings</a>
            </li>
        </ul>
    </div>
    <?php #endregion 
    ?>
    <div class="sub-tabs">
        <?php #region Info 
        ?>
        <div data-nav-tab="info">
            <p>
                On this tab, ...
            </p>
        </div>
        <?php #endregion 
        ?>
        <?php #region Translate 
        ?>
        <div data-nav-tab="translate" class="d-none">
            <p>
                On this tab, ...
            </p>
            <p>
                <div class="form-inline">
                    <label class="mr-2" for="current-translation-file">Translate</label>
                    <select data-type="setting" data-setting="currentTranslation" id="current-translation-file" class="form-control mr-2"></select>
                    <label class="mr-2 ml-2" for="current-translation-based-on">based on </label>
                    <select data-type="setting" data-setting="currentTranslationBasedOn" id="current-translation-based-on" class="form-control mr-2"></select>
                    <label class="ml-2">metadata.</label>
                </div>
            </p>
            <p>
                <div class="custom-control custom-switch ml-3" style="margin-top:-2px !important;">
                    <input type="checkbox" data-type="setting" data-setting="inScreenEnabled" class="custom-control-input" id="in-screen-switch">
                    <label class="custom-control-label" style="padding-top: 2px;" for="in-screen-switch">Enable in-screen translation</label>
                </div>
            </p>
            <p class="small">
                <b>Note:</b> After enabling in-screen translation, the page must be reloaded for this setting to take effect. In-screen translation cannot be used on the <i>REDCap Translation Assistant</i> plugin page (i.e. the page you are currently viewing). Use the <b style="white-space:nowrap;"><i class="fas fa-exchange-alt"></i> Translate</b> link to translate a page. On non-authenticated pages or survey pages, manually call <i>REDCap.EM.RUB.REDCapInScreenTranslator.translate(<b>***</b>)</i> with your password from the console (F12).
            </p>

        </div>
        <?php #endregion 
        ?>
        <?php #region Translations 
        ?>
        <div data-nav-tab="translations" class="d-none">
            <p>
                On this tab, ...
            </p>
            <h2>Manage and upload translation files</h2>
            <p class="small ml-2">
                <i>Note that these files are translation JSON files rather than language INI files, which are used by REDCap. JSON files contain additional metadata. INI files can be converted to JSON files on the <em>Tools</em> tab.</i>
            </p>
            <form class="ml-2">
                <div class="custom-file" data-uploader="translation-json">
                    <input type="file" class="custom-file-input" id="upload-lang-json" accept=".json" />
                    <label class="custom-file-label" for="upload-lang-json">
                        <span class="processing-file hide"><i class="fas fa-cog fa-spin"></i> Processing file (<span data-upload-progress></span>%):</span>
                        <span class="filename">Choose or drop JSON file&hellip;</span>
                    </label>
                    <div class="invalid-feedback">This is not a valid translation JSON file.</div>
                </div>
            </form>
            <p>
                or <b>create</b> a new file, with the following parameters:
                <div class="form-inline mt-2 ml-2" data-form="create-new-translation">
                    <div class="form-group">
                        <label class="sr-only" for="create-lang-name">Name (must be unique)</label>
                        <input data-em-para="create-lang-name" type="text" maxlength="100" id="create-lang-name" class="form-control form-control-sm mr-2 mb-2" placeholder="Name" required>
                    </div>
                    <div class="form-group">
                        <label class="sr-only" for="create-lang-localizedname">Name (must be unique)</label>
                        <input data-em-para="create-lang-localizedname" type="text" maxlength="100" id="create-lang-localizedname" class="form-control form-control-sm mr-2 mb-2" placeholder="Localized name" required>
                    </div>
                    <div class="form-group">
                        <label class="sr-only" for="create-lang-iso">ISO code (such as, e.g. en-US)</label>
                        <input data-em-para="create-lang-iso" type="text" style="max-width:8em;" maxlength="10" id="create-lang-iso" class="form-control form-control-sm mr-2 mb-2" placeholder="ISO (optional)">
                    </div>
                    <br>
                    <button data-action="create-new-translation" class="btn btn-primary btn-sm mb-2">Create</button>
                    <div class="invalid-feedback">Invalid input. <i>Name</i> and <i>Localized name</i> are required. <i>Name</i> must only contain letter, hyphen, and underscore characters.</div>
                </div>
            </p>
            <h3 class="mt-2">
                Available translations
            </h3>
            <p>
                <div class="form-inline ml-2">
                    <label class="mr-2" for="create-lang-based-on">Base actions on REDCap version </label>
                    <select id="create-lang-based-on" class="form-control mr-2" data-em-para="translation-based-on"></select>
                    <span class="ml-2">metadata.</span>
                </div>
            </p>
            <table class="table table-responsive table-md">
                <thead>
                    <tr>
                        <th scope="col">Name</th>
                        <th scope="col">Localized Name</th>
                        <th scope="col">ISO</th>
                        <th scope="col">Coverage</th>
                        <th scope="col">Last Updated</th>
                        <th scope="col">Actions</th>
                    </tr>
                </thead>
                <tbody class="translations-body"></tbody>
            </table>
            <template data-template="translations-empty">
                <tr><td colspan="4"><i>There are not currently any translations.</i></td>
            </template>
            <template data-template="translations-row">
                <tr data-version="">
                    <th scope="row">
                        <div class="text-cell">
                            <span data-key="name"></span>
                        </div>
                    </th>
                    <td>
                        <div class="text-cell">
                            <span data-key="localized-name"></span>
                        </div>
                    </td>
                    <td>
                        <div class="text-cell">
                            <span data-key="iso"></span>
                        </div>
                    </td>
                    <td>
                        <div class="text-cell">
                            <span data-key="coverage"></span>
                        </div>
                    </td>
                    <td>
                        <div class="text-cell">
                            <span data-key="updated"></span>
                        </div>
                    </td>
                    <td>
                        <button data-action="translation-get-in-screen-ini" class="btn btn-light btn-sm" title="Download an INI file for in-screen translation based on this translation"><i class="fas fa-desktop"></i></button>
                        |
                        <button data-action="translation-get-ini" class="btn btn-light btn-sm" title="Download the INI file for this translation"><i class="fas fa-file-alt text-info"></i></button>
                        <button data-action="translation-get-json" class="btn btn-light btn-sm" title="Download the JSON file for this translation"><i class="fas fa-file-code"></i></button>
                        |
                        <button data-action="translation-delete" class="btn btn-light btn-sm" title="Delete this translation from the server"><i class="far fa-trash-alt text-danger"></i></button>
                    </td>
                </tr>
            </template>
        </div>
        <?php #endregion 
        ?>
        <?php #region Metadata 
        ?>
        <div data-nav-tab="metadata" class="d-none">
            <p>
                On this tab, ...
            </p>
            <h2>Manage REDCap strings metadata &amp; annotations files</h2>
            <p>
                Upload an <b>existing</b> file:
            </p>
            <form class="ml-2">
                <div class="custom-file" data-uploader="metadata-json">
                    <input type="file" class="custom-file-input" id="upload-metadata-json" accept=".json" />
                    <label class="custom-file-label" for="upload-metadata-json">
                        <span class="processing-file hide"><i class="fas fa-cog fa-spin"></i> Processing file (<span data-upload-progress></span>%):</span>
                        <span class="filename">Choose or drop a metadata file&hellip;</span>
                    </label>
                    <div class="invalid-feedback">This is not a valid REDCap strings metadata &amp; annotations file.</div>
                </div>
                <div class="mr-2 mt-2">In case a metadata file for this version already exists, then</div>
                <div class="form-inline ml-2">
                    <div class="form-check form-check-inline">
                        <input class="form-check-input" type="radio" name="upload-metadata-option" id="upload-metadata-option-keep" value="keep" checked>
                        <label class="form-check-label" for="upload-metadata-option-keep"><b>keep</b></label>
                    </div>
                    <p class="mr-2">or</p>
                    <div class="form-check form-check-inline">
                        <input class="form-check-input" type="radio" name="upload-metadata-option" id="upload-metadata-option-overwrite" value="overwrite">
                        <label class="form-check-label" for="upload-metadata-option-overwrite"><b>overwrite</b></label>
                    </div>
                    <p>existing modifications.</p>
                </div>
            </form>
            <p>or <b>create a new</b> file:</p>
            <div class="form-inline ml-2">
                <button data-action="gen-metadata-json" class="btn btn-primary btn-sm mt-1"><i class="fas fa-file-code"></i> Generate</button>
                <label class="mr-2 ml-2 mt-1" for="gen-metadata-based-on">based on REDCap</label>
                <span class="mt-1">
                    <select id="gen-metadata-based-on" class="form-control mr-2" data-em-para="gen-metadata-based-on"></select>
                </span>
                <label class="mr-2 ml-2 mt-1" for="gen-metadata-merge-from">and stored metadata for </label>
                <span class="mt-1">
                    <select id="gen-metadata-merge-from" class="form-control mr-2" data-em-para="gen-metadata-merge-from"></select>
                </span>
            </div>
            <div class="ml-4 mt-2">
                <div class="custom-control custom-switch" style="margin-top:-2px !important;">
                    <input type="checkbox" class="custom-control-input" id="add-code-locations" data-em-para="gen-metadata-add-code">
                    <label class="custom-control-label" style="padding-top: 2px;" for="add-code-locations">Add code locations (this is slow!)</label>
                </div>
            </div>
            <p class="mt-4">
                Available strings metadata &amp; annotations files:
            </p>
            <table class="table table-responsive table-md">
                <thead>
                    <tr>
                        <th scope="col">REDCap</th>
                        <th scope="col">Last Updated</th>
                        <th scope="col">Strings</th>
                        <th scope="col">Annotations</th>
                        <th scope="col">Code</th>
                        <th scope="col">Actions</th>
                    </tr>
                </thead>
                <tbody class="metadata-body"></tbody>
            </table>
            <template data-template="metadata-empty">
                <tr><td colspan="4"><i>There are not currently any items to show.</i></td>
            </template>
            <template data-template="metadata-row">
                <tr data-version="">
                    <th scope="row">
                        <div class="text-cell">
                            <span data-key="version"></span>
                        </div>
                    </th>
                    <td>
                        <div class="text-cell">
                            <span data-key="updated"></span>
                        </div>
                    </td>
                    <td>
                        <div class="text-cell">
                            <span data-key="strings"></span>
                        </div>
                    </td>
                    <td>
                        <div class="text-cell">
                            <span data-key="annotations"></span>
                        </div>
                    </td>
                    <td>
                        <div class="text-cell">
                            <span data-key="code"></span>
                        </div>
                    </td>
                    <td>
                        <button data-action="metadata-download" class="btn btn-light btn-sm" title="Download this strings metadata &amp; annotations file"><i class="fas fa-file-download"></i></button>
                        |
                        <button data-action="metadata-delete" class="btn btn-light btn-sm" title="Delete this strings metadata &amp; annotations file"><i class="far fa-trash-alt text-danger"></i></button>
                    </td>
                </tr>
            </template>
        </div>
        <?php #endregion 
        ?>
        <?php #region Packages 
        ?>
        <div data-nav-tab="packages" class="d-none">
            <p>
                On this tab, ...
            </p>
            <h2>Manage and upload REDCap install or update packages</h2>
            <p class="small">
                <i>Note that the filename must be as downloaded from the REDCap Consortium site, i.e. <b>redcapX.Y.Z.zip</b> or <b>redcapX.Y.Z_upgrade.zip</b>.</i>
            </p>
            <form>
                <div class="custom-file" data-uploader="package-zip">
                    <input type="file" class="custom-file-input" id="upload-package-zip" accept=".zip" />
                    <label class="custom-file-label" for="upload-package-zip">
                        <span class="processing-file hide"><i class="fas fa-cog fa-spin"></i> Processing file (<span data-upload-progress></span>%):</span>
                        <span class="filename">Choose or drop ZIP file&hellip;</span>
                    </label>
                    <div class="invalid-feedback">This is not a valid REDCap package.</div>
                </div>
            </form>
            <p>
                Available REDCap packages:
            </p>
            <table class="table table-responsive table-md">
                <thead>
                    <tr>
                        <th scope="col">REDCap</th>
                        <th scope="col">Type</th>
                        <th scope="col">Size</th>
                        <th scope="col">Actions</th>
                    </tr>
                </thead>
                <tbody class="packages-body"></tbody>
            </table>
            <template data-template="packages-empty">
                <tr><td colspan="4"><i>There are not currently any packages.</i></td>
            </template>
            <template data-template="packages-row">
                <tr data-version="">
                    <th scope="row">
                        <div class="text-cell">
                            <span data-key="version"></span>
                        </div>
                    </th>
                    <td>
                        <div class="text-cell">
                            <span data-key="type"></span>
                        </div>
                    </td>
                    <td>
                        <div class="text-cell">
                            <span data-key="size"></span>
                        </div>
                    </td>
                    <td>
                        <button data-action="package-get-strings" class="btn btn-light btn-sm" title="Get English.ini from this version (including EM strings)"><i class="fas fa-file-alt text-info"></i></button>
                        <button data-action="package-get-zip" class="btn btn-light btn-sm" title="Download ZIP file"><i class="fas fa-file-archive"></i></button>
                        |
                        <button data-action="package-delete" class="btn btn-light btn-sm" title="Delete this version from the server"><i class="far fa-trash-alt text-danger"></i></button>
                    </td>
                </tr>
            </template>
        </div>
        <?php #endregion 
        ?>
        <?php #region Tools 
        ?>
        <div data-nav-tab="tools" class="d-none">
            <p>
                On this tab, ...
            </p>
            <h2>Convert a language INI file to a translation JSON file</h2>
            <p>
                This tool allows to convert a REDCap language INI file as obtained from the <i>Language File Creater/Updater</i> page or the <i>REDCap Language Library</i> to be used as the basis for further translation and managment in the <i>REDCap Translation Assistant</i>.
            </p>
            <form class="ml-2">
                <div class="custom-file" data-uploader="convert-ini-to-json">
                    <input type="file" class="custom-file-input" id="upload-lang-ini" accept=".ini" />
                    <label class="custom-file-label" for="upload-lang-ini">
                        <span class="processing-file hide"><i class="fas fa-cog fa-spin"></i> Processing file (<span data-upload-progress></span>%):</span>
                        <span class="filename">Choose or drop INI file&hellip;</span>
                    </label>
                    <div class="invalid-feedback">This is not a valid language INI file.</div>
                </div>
            </form>
            <p class="small">
                Once uploaded, the converted file will start to download immediately. Any error messages are contained within the downloaded file.
            </p>
            <hr>
            <h2>Convert a Multi-Language Management JSON file to a translation JSON file</h2>
            <p>
                This tool allows to convert a REDCap Multi-Language Management language file to be used as the basis for further translation and managment in the <i>REDCap Translation Assistant</i>.
            </p>
            <form class="ml-2">
                <div class="custom-file" data-uploader="convert-mlm-to-json">
                    <input type="file" class="custom-file-input" id="upload-lang-mlm" accept=".json" />
                    <label class="custom-file-label" for="upload-lang-mlm">
                        <span class="processing-file hide"><i class="fas fa-cog fa-spin"></i> Processing file (<span data-upload-progress></span>%):</span>
                        <span class="filename">Choose or drop MLM JSON file&hellip;</span>
                    </label>
                    <div class="invalid-feedback">This is not a valid Multi-Language Management JSON file.</div>
                </div>
            </form>
            <p class="small">
                Once uploaded, the converted file will start to download immediately. Any error messages are contained within the downloaded file.
            </p>
        </div>
        <?php #endregion 
        ?>
        <?php #region Settings 
        ?>
        <div data-nav-tab="settings" class="d-none">
            <p>
                On this tab, ...
            </p>
            <div class="em-option">
                <p class="em-description">
                    <label for="option-debug">
                        <span class="switch switch-xs switch-inline">
                            <input type="checkbox" class="switch" data-type="setting" data-setting="debug" id="option-debug">
                            <label for="option-debug"></label>
                        </span>
                        Debug mode (status messages will be output to the browser console)
                    </label>
                </p>
            </div>
            <div class="em-option">
                <div class="form-inline">
                    <label class="mr-2" for="option-password">Password for non-authenticated pages:</label>
                    <input class="form-control form-control-sm" type="text" minlength="10" data-type="setting" data-setting="password" />

                </div>
                <p class="small">
                    <b>Password rules:</b> The password must be at least 10 characters long and include at least one upper and lower case letter and one digit.
                </p>
            </div>
        </div>
        <?php #endregion 
        ?>
    </div>
    <?php require dirname(__FILE__)."/../toasts.php"; ?>
</div>
<script>
    window.REDCap.EM.RUB.REDCapTranslator.init(<?= REDCapTranslatorPlugin::get_settings() ?>);
</script>
