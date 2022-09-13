<?php

namespace RUB\REDCapTranslatorExternalModule;

/**
 * Using a class here to isolate from the nasty global context
 */
class REDCapTranslatorPlugin
{

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
            "uploadedVersions" => self::$m->get_uploaded_versions(),
            "state" => self::$m->get_state(),
        );
        // Uploads
        $uploads = [];
        $edocs = self::$m->getSystemSetting(REDCapTranslatorExternalModule::UPLOADS_SETTING_NAME);
        foreach ($edocs as $version => $edoc_id) {
            list($name, $size) = \Files::getEdocNameAndSize($edoc_id);
            $uploads[$version] = [
                "version" => $version,
                "size" => $size * 1,
                "upgrade" => strpos($name, "_upgrade") > 0,
            ];
        }
        $settings["uploads"] = $uploads;

        return json_encode($settings, JSON_FORCE_OBJECT);
    }
}
REDCapTranslatorPlugin::init($module);
?>
<div class="translator-em">
    <h4 style="margin-top:0;">REDCap Translation Assistant</h4>
    <?php #region Navigation 
    ?>
    <div id="sub-nav" class="d-sm-block" style="margin-bottom:0.5em !important;">
        <ul>
            <li class="active">
                <a href="javascript:;" data-action="main-nav" data-nav-target="info" style="font-size:13px;color:#393733;padding:7px 9px;"><i class="fas fa-info-circle"></i> Info</a>
            </li>
            <li class="">
                <a href="javascript:;" data-action="main-nav" data-nav-target="translate" style="font-size:13px;color:#393733;padding:7px 9px;"><i class="fas fa-language"></i> Translate</a>
            </li>
            <li class="">
                <a href="javascript:;" data-action="main-nav" data-nav-target="tools" style="font-size:13px;color:#393733;padding:7px 9px;"><i class="fas fa-wrench"></i> Tools</a>
            </li>
            <li class="">
                <a href="javascript:;" data-action="main-nav" data-nav-target="uploads" style="font-size:13px;color:#393733;padding:7px 9px;"><i class="fas fa-folder-open"></i> Uploads</a>
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
                Info tab
            </p>
        </div>
        <?php #endregion 
        ?>
        <?php #region Translate 
        ?>
        <div data-nav-tab="translate" class="d-none">
            <p>
                Translate tab
            </p>
        </div>
        <?php #endregion 
        ?>
        <?php #region Tools 
        ?>
        <div data-nav-tab="tools" class="d-none">
            <p>
                On this tab, ...
            </p>
            <p>Output should be based on REDCap version:</p>
            <p class="">
                <select data-em-para="based-on"></select>
            </p>
            <hr>
            <h2>Generate a REDCap Strings Metadata file</h2>
            <p>
                More stuff for JSON generation...
            </p>
            <div class="form-row align-items-center">
                <div class="col-auto">
                    <button data-action="gen-json" class="btn btn-primary btn-sm mb-2"><i class="fas fa-file-code"></i> Generate</button>
                </div>
                <div class="col-auto">
                    <div class="form-check mb-2">
                        <input class="form-check-input" type="checkbox" id="gen-json-code" data-em-para="gen-json-with-code">
                        <label class="form-check-label" for="gen-json-code">Add code locations</label>
                    </div>
                </div>
                <div class="col-auto">
                    <div class="form-check mb-2">
                        <input class="form-check-input" type="checkbox" id="gen-json-code-brute" data-em-para="gen-json-with-code-brute">
                        <label class="form-check-label" for="gen-json-code-brute">thoroughly (this is slow)</label>
                    </div>
                </div>
            </div>
        </div>
        <?php #endregion 
        ?>
        <?php #region Uploads 
        ?>
        <div data-nav-tab="uploads" class="d-none">
            <p>
                Upload a REDCap install or update package: <br>
                <small><i>Note that the filename must be as downloaded from the REDCap Consortium site, i.e. <b>redcapX.Y.Z.zip</b> or <b>redcapX.Y.Z_upgrade.zip</b>.</i></small>
            </p>
            <form>
                <div class="custom-file">
                    <input type="file" class="custom-file-input" name="upload-zip" id="upload-zip" accept=".zip" />
                    <label class="custom-file-label" for="upload-zip">
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
                <tbody class="uploads-body"></tbody>
            </table>
            <template data-template="uploads-row">
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
                        <button data-action="uploads-get-strings" class="btn btn-light btn-sm" title="Get English.ini from this version (including EM strings)"><i class="fas fa-file-alt text-info"></i></button>
                        <button data-action="uploads-get-zip" class="btn btn-light btn-sm" title="Download ZIP file"><i class="fas fa-file-archive"></i></button>
                        |
                        <button data-action="uploads-delete" class="btn btn-light btn-sm" title="Delete this version from the server"><i class="far fa-trash-alt text-danger"></i></button>
                    </td>
                </tr>
            </template>
        </div>
        <?php #endregion 
        ?>
        <?php #region Settings 
        ?>
        <div data-nav-tab="settings" class="d-none">
            <p>
                Settings tab
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