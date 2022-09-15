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
        $m->ih->css("plugin/translator.css");
        $m->ih->js("plugin/translator.js");
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
            "invisibleChar" => REDCapTranslatorExternalModule::INVISIBLE_CHAR,
            "state" => self::$m->get_state(),
        );
        // Languages
        $languages = [];
        // TODO
        $settings["languages"] = $languages;

        // Packages
        $packages = [];
        $edocs = self::$m->getSystemSetting(REDCapTranslatorExternalModule::UPLOADS_SETTING_NAME);
        foreach ($edocs as $version => $edoc_id) {
            list($name, $size) = \Files::getEdocNameAndSize($edoc_id);
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
            <li class="active">
                <a href="javascript:;" data-action="main-nav" data-nav-target="info" style="font-size:13px;color:#393733;padding:7px 9px;"><i class="fas fa-info-circle"></i> Info</a>
            </li>
            <li class="">
                <a href="javascript:;" data-action="main-nav" data-nav-target="translate" style="font-size:13px;color:#393733;padding:7px 9px;"><i class="fas fa-exchange-alt"></i> Translate</a>
            </li>
            <li class="">
                <a href="javascript:;" data-action="main-nav" data-nav-target="languages" style="font-size:13px;color:#393733;padding:7px 9px;"><i class="fas fa-globe"></i> Languages</a>
            </li>
            <li class="">
                <a href="javascript:;" data-action="main-nav" data-nav-target="packages" style="font-size:13px;color:#393733;padding:7px 9px;"><i class="fas fa-archive"></i> Packages</a>
            </li>
            <li class="">
                <a href="javascript:;" data-action="main-nav" data-nav-target="tools" style="font-size:13px;color:#393733;padding:7px 9px;"><i class="fas fa-wrench"></i> Tools</a>
            </li>
            <li>
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
        </div>
        <?php #endregion 
        ?>
        <?php #region Languages 
        ?>
        <div data-nav-tab="languages" class="d-none">
            <p>
                On this tab, ...
            </p>
            <h2>Manage and upload language files</h2>
            <p class="small ml-2">
                <i>Note that these files are language JSON files rather than INI files, which are used by REDCap. JSON files contain additional metadata. INI files can be converted to JSON files on the <em>Tools</em> tab.</i>
            </p>
            <form class="ml-2">
                <div class="custom-file" data-uploader="lang-json">
                    <input type="file" class="custom-file-input" name="upload-lang-json" id="upload-lang-json" accept=".json" />
                    <label class="custom-file-label" for="upload-lang-json">
                        <span class="processing-file hide"><i class="fas fa-cog fa-spin"></i> Processing file (<span data-upload-progress></span>%):</span>
                        <span class="filename">Choose or drop JSON file&hellip;</span>
                    </label>
                    <div class="invalid-feedback">This is not a valid language JSON file.</div>
                </div>
            </form>
            <p>
                or <b>create</b> a new file, 
                <div class="form-inline ml-2">
                    <label class="mr-2" for="create-lang-based-on">based on REDCap</label>
                    <select id="create-lang-based-on" class="form-control mr-2" data-em-para="create-lang-basedon"></select>
                    <span class="ml-2">and the following parameters:</span>
                </div>
                <div class="form-inline mt-2 ml-2">
                    <div class="form-group">
                        <label class="sr-only" for="create-lang-name">Name (must be unique)</label>
                        <input data-em-para="create-lang-name" type="text" id="create-lang-name" class="form-control form-control-sm mr-2" placeholder="Name" required>
                    </div>
                    <div class="form-group">
                        <label class="sr-only" for="create-lang-localizedname">Name (must be unique)</label>
                        <input data-em-para="create-lang-localizedname" type="text" id="create-lang-localizedname" class="form-control form-control-sm mr-2" placeholder="Localized name" required>
                    </div>
                    <div class="form-group">
                        <label class="sr-only" for="create-lang-iso">ISO code (such as, e.g. en-US)</label>
                        <input data-em-para="create-lang-iso" type="text" id="create-lang-iso" class="form-control form-control-sm mr-2" placeholder="ISO (optional)">
                    </div>
                    <button data-action="create-new-lang" class="btn btn-primary btn-sm">Create</button>
                </div>
            </p>
            <h3 class="mt-2">
                Available languages
            </h3>
            <table class="table table-responsive table-md">
                <thead>
                    <tr>
                        <th scope="col">Name</th>
                        <th scope="col">Localized Name</th>
                        <th scope="col">Coverage</th>
                        <th scope="col">Actions</th>
                    </tr>
                </thead>
                <tbody class="languages-body"></tbody>
            </table>
            <template data-template="languages-empty">
                <tr><td colspan="4"><i>There are not currently any languages.</i></td>
            </template>
            <template data-template="languages-row">
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
                            <span data-key="coverage"></span>
                        </div>
                    </td>
                    <td>
                        <button data-action="language-get-ini" class="btn btn-light btn-sm" title="Download the INI file for this language"><i class="fas fa-file-alt text-info"></i></button>
                        <button data-action="language-get-json" class="btn btn-light btn-sm" title="Download the JSON file for this language"><i class="fas fa-file-archive"></i></button>
                        |
                        <button data-action="langauge-delete" class="btn btn-light btn-sm" title="Delete this language from the server"><i class="far fa-trash-alt text-danger"></i></button>
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
            <h2>Manage and upload a REDCap install or update packages</h2>
            <p class="small">
                <i>Note that the filename must be as downloaded from the REDCap Consortium site, i.e. <b>redcapX.Y.Z.zip</b> or <b>redcapX.Y.Z_upgrade.zip</b>.</i>
            </p>
            </h2>
            <form>
                <div class="custom-file" data-uploader="package-zip">
                    <input type="file" class="custom-file-input" name="package-zip" id="package-zip" accept=".zip" />
                    <label class="custom-file-label" for="package-zip">
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
            <h2>Generate a REDCap Strings Metadata &amp; Annotation file</h2>
            <p>
                More stuff for JSON generation...
            </p>
            <div class="form-inline">
                <label class="mr-2" for="gen-json-based-on">Based on REDCap</label>
                <select id="gen-json-based-on" class="form-control mr-2" data-em-para="based-on"></select>
                <div class="custom-control custom-switch ml-4 mt-2" style="margin-top:-2px !important;">
                    <input type="checkbox" class="custom-control-input" id="base-on-prev" data-em-para="gen-json-merge-prev">
                    <label class="custom-control-label" style="padding-top: 2px;" for="base-on-prev">Merge in previous metadata</label>
                </div>
                <div class="custom-control custom-switch ml-4 mt-2" style="margin-top:-2px !important;">
                    <input type="checkbox" class="custom-control-input" id="add-code-locations" data-em-para="gen-json-with-code">
                    <label class="custom-control-label" style="padding-top: 2px;" for="add-code-locations">Add code locations (this is slow!)</label>
                </div>
            </div>
            <p>
                <button data-action="gen-metadata-json" class="btn btn-primary btn-sm mb-2"><i class="fas fa-file-code"></i> Generate</button>
            </p>
            <hr>
            <h2>Generate a REDCap language file for In-Screen translation</h2>
            <p>
                Provide way to upload a Language.ini or Language.json file.
                When no file is provided, English will be output.
                
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
                    <label for="switch-debug">
                        <span class="switch switch-xs switch-inline">
                            <input type="checkbox" class="switch" data-type="setting" data-setting="debug" id="switch-debug">
                            <label for="switch-debug"></label>
                        </span>
                        Debug mode (status messages will be output to the browser console)
                    </label>
                </p>
            </div>
        </div>
        <?php #endregion 
        ?>
    </div>
    <?php #region Misc 
    ?>
    <!-- Success toast -->
    <div class="position-fixed bottom-0 right-0 p-3" style="z-index: 99999; right: 0; bottom: 0;">
        <div id="translator-successToast" class="toast hide" role="alert" aria-live="assertive" aria-atomic="true" data-delay="2000" data-animation="true" data-autohide="true">
            <div class="toast-header">
                <svg class="bd-placeholder-img rounded mr-2" width="20" height="20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" preserveAspectRatio="xMidYMid slice" focusable="false">
                    <rect width="100%" height="100%" fill="#28a745"></rect>
                </svg>
                <strong class="mr-auto">Success</strong>
                <button type="button" class="ml-2 mb-1 close" data-dismiss="toast" aria-label="Close">
                    <span aria-hidden="true">&times;</span>
                </button>
            </div>
            <div class="toast-body" data-content="toast"></div>
        </div>
    </div>
    <!-- Error toast -->
    <div class="position-fixed bottom-0 right-0 p-3" style="z-index: 99999; right: 0; bottom: 0;">
        <div id="translator-errorToast" class="toast hide" role="alert" aria-live="assertive" aria-atomic="true" data-delay="2000" data-animation="true" data-autohide="false">
            <div class="toast-header">
                <svg class="bd-placeholder-img rounded mr-2" width="20" height="20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" preserveAspectRatio="xMidYMid slice" focusable="false">
                    <rect width="100%" height="100%" fill="#dc3545"></rect>
                </svg>
                <strong class="mr-auto">ERROR</strong>
                <button type="button" class="ml-2 mb-1 close" data-dismiss="toast" aria-label="Close">
                    <span aria-hidden="true">&times;</span>
                </button>
            </div>
            <div class="toast-body" data-content="toast"></div>
        </div>
    </div>
    <?php #endregion 
    ?>
</div>
<script>
    window.REDCap.EM.RUB.REDCapTranslator.init(<?= REDCapTranslatorPlugin::get_settings() ?>);
</script>