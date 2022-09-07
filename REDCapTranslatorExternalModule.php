<?php namespace RUB\REDCapTranslatorExternalModule;

/**
 * ExternalModule class for REDCap Translator.
 */
class REDCapTranslatorExternalModule extends \ExternalModules\AbstractExternalModule {

    function __construct() {
        parent::__construct();
    }

    function redcap_module_link_check_display($project_id, $link) {
        return $link;
    }

}