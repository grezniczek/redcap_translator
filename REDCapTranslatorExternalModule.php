<?php

namespace RUB\REDCapTranslatorExternalModule;

require_once "em-i18n-polyfill/em-i18n-polyfill.php";

use ExternalModules\TranslatableExternalModule;

/**
 * ExternalModule class for REDCap Translator.
 */
class REDCapTranslatorExternalModule extends TranslatableExternalModule {

    function __construct() {
        parent::__construct("English"); 

        if (!$this->hasNativeLocalizationSupport()) {
            // No native support, so we have to take care of language switching ourselves.
            $sysLang = $this->getSystemSetting("system_language");
            $projLang = $this->getProjectId() != null ?  $this->getProjectSetting("project_language") : "";
            $lang = strlen($projLang) ? $projLang : $sysLang;
            if (strlen($lang) && $lang !== "English") {
                // Only switch if set and not default.
                $this->loadLanguage($lang);
            }
        }
    }

}