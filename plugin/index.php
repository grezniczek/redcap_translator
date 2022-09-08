<?php namespace RUB\REDCapTranslatorExternalModule;

class REDCapTranslatorPlugin {

    /**
     * @param REDCapTranslatorExternalModule $m 
     * @return void 
     */
    static function run($m) {
        $m->initializeJavascriptModuleObject();
        $m->ih->css("plugin/translator.css");
        $m->ih->js("plugin/translator.js");
        $settings = array(
            "debug" => true,
            "JSMO" => json_encode($m->getJavascriptModuleObjectName()),
            "uploadUrl" => $m->getUrl("plugin/upload.php"),
            "csrfToken" => $m->getCSRFToken(),
        );

?>
<div class="translator-em">
    <h4 style="margin-top:0;">REDCap Translator</h4>
    <div id="sub-nav" class="d-sm-block" style="margin-bottom:0.5em !important;">
        <ul>
            <li class="active">
                <a href="javascript:;" data-action="main-nav" data-nav-target="info" style="font-size:13px;color:#393733;padding:7px 9px;"><i class="fa-solid fa-circle-info"></i> Info</a>
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
    <div class="sub-tabs">
        <div data-nav-tab="info">
            <p>
                Info tab
            </p>
        </div>
        <div data-nav-tab="translate" class="d-none">
            <p>
                Translate tab
            </p>
        </div>
        <div data-nav-tab="tools" class="d-none">
            <p>
                Tools tab
            </p>
        </div>
        <div data-nav-tab="uploads" class="d-none">
            <p>
                Upload a REDCap install or update package: <br>
                <small><i>Note that the filename must be as downloaded from the REDCap Consortium site.</i></small>
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
        </div>
        <div data-nav-tab="settings" class="d-none">
            <p>
                Settings tab
            </p>
        </div>
    
    </div>
    <!-- Success toast -->
    <div class="position-fixed bottom-0 right-0 p-3" style="z-index: 99999; right: 0; bottom: 0;">
        <div id="translator-successToast" class="toast hide" role="alert" aria-live="assertive" aria-atomic="true" data-delay="2000" data-animation="true" data-autohide="true">
            <div class="toast-header">
                <svg class="bd-placeholder-img rounded mr-2" width="20" height="20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" preserveAspectRatio="xMidYMid slice" focusable="false"><rect width="100%" height="100%" fill="#28a745"></rect></svg>
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
                <svg class="bd-placeholder-img rounded mr-2" width="20" height="20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" preserveAspectRatio="xMidYMid slice" focusable="false"><rect width="100%" height="100%" fill="#dc3545"></rect></svg>
                <strong class="mr-auto">ERROR</strong>
                <button type="button" class="ml-2 mb-1 close" data-dismiss="toast" aria-label="Close">
                    <span aria-hidden="true">&times;</span>
                </button>
            </div>
            <div class="toast-body" data-content="toast"></div>
        </div>
    </div>
</div>
<script>
    window.REDCap.EM.RUB.REDCapTranslator.init(<?=json_encode($settings, JSON_FORCE_OBJECT)?>);
</script>
<?php
    }
}
REDCapTranslatorPlugin::run($module);