<?php namespace RUB\REDCapTranslatorExternalModule;

require_once "classes/InjectionHelper.php";

/**
 * ExternalModule class for REDCap Translator.
 */
class REDCapTranslatorExternalModule extends \ExternalModules\AbstractExternalModule {


    public const UPLOADS_SETTING_NAME = "upload";

    /**
     * @var InjectionHelper
     */
    public $ih = null;
 
    function __construct() {
        parent::__construct();
        $this->ih = InjectionHelper::init($this);
    }

    function redcap_module_link_check_display($project_id, $link) {
        return $link;
    }


    function redcap_module_ajax($action, $payload, $project_id, $record, $instrument, $event_id, $repeat_instance, $survey_hash, $response_id, $survey_queue_hash, $page, $page_full, $user_id, $group_id) {
        if ($action == "uploads-delete") {
            $version = $payload;
            $uploads = $this->getSystemSetting(self::UPLOADS_SETTING_NAME) ?? [];
            if (array_key_exists($version, $uploads)) {
                $edoc_id = $uploads[$version];
                \Files::deleteFileByDocId($edoc_id);
                unset($uploads[$version]);
                $this->setSystemSetting(self::UPLOADS_SETTING_NAME, $uploads);
                return [
                    "success" => true,
                ];
            }
            else {
                return [
                    "success" => false,
                    "error" => "This version does not exist on the server."
                ];
            }
        }
        else if ($action == "uploads-get-zip") {
            $version = $payload;
            $uploads = $this->getSystemSetting(self::UPLOADS_SETTING_NAME) ?? [];
            if (array_key_exists($version, $uploads)) {
                $edoc_id = $uploads[$version];
                $edoc_hash = \Files::docIdHash($edoc_id);
                $url = APP_PATH_WEBROOT . "DataEntry/file_download.php?doc_id_hash=$edoc_hash";
                return [
                    "success" => true,
                    "url" => $url
                ];
            }
            else {
                return [
                    "success" => false,
                    "error" => "This version does not exist on the server."
                ];
            }
        }
    }



    public static function get_strings_from_zip($edoc_id, $version) {
        $strings = null;
        // Copy archive to local temp
        $local_file = \Files::copyEdocToTemp($edoc_id);
        // Extract and merge languages
        $zip = new \ZipArchive;
        $result = $zip->open($local_file);
        if ($result === true) {
            $rc_strings = self::read_ini($zip, "redcap/redcap_v$version/LanguageUpdater/English.ini");
            $em_strings = self::read_ini($zip, "redcap/redcap_v$version/ExternalModules/classes/English.ini");
            $strings = array_merge($rc_strings, $em_strings);
            $zip->close();
        }
        // Delete the archive
        unlink($local_file);
        return $strings;
    }

    public static function strings_to_ini($strings, $header = "") {
        $lines = empty($header) ? [] : ["$header"];
        foreach ($strings as $key => $text) {
            $lines[] = $key . ' = "' . str_replace(array('"',"\r\n","\r","\n","\t","  ","  "), array('\"',' ',' ',' ',' ',' ',' '), $text) . '"';
        }
        return join("\n", $lines);
    }

    private static function read_ini($zip, $path) {
        $contents = "";
        $fp = $zip->getStream($path);
        while (!feof($fp)) {
            $contents .= fread($fp, 2);
        }
        fclose($fp);
        return parse_ini_string($contents);
    }

}