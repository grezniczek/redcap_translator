<?php namespace RUB\REDCapTranslatorExternalModule;

use MicrosoftAzure\Storage\Common\Exceptions\InvalidArgumentTypeException;
use LogicException;
use RuntimeException;

require_once "classes/InjectionHelper.php";

/**
 * ExternalModule class for REDCap Translator.
 */
class REDCapTranslatorExternalModule extends \ExternalModules\AbstractExternalModule {


    public const UPLOADS_SETTING_NAME = "upload";
    public const DEBUG_SETTING_NAME = "debug-mode";
    public const INVISIBLE_CHAR = "‌";

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
        switch($action) {
            case "uploads-delete":
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
                break;
            case "uploads-get-zip":
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
                break;
            case "settings-update":
                $setting = $payload["setting"] ?? "";
                $value = $payload["value"];
                if ($setting == "debug") {
                    $this->setSystemSetting(self::DEBUG_SETTING_NAME, $value === true);
                    return ["success" => true];
                }
                return [
                    "success" => false,
                    "error" => "Unknown setting '$setting'."
                ];
                break;
        }
    }



    public static function get_strings_from_zip($edoc_id, $version) {
        // Copy archive to local temp
        $local_file = \Files::copyEdocToTemp($edoc_id);
        // Extract and merge languages
        $zip = new \ZipArchive;
        $result = $zip->open($local_file);
        if ($result === true) {
            $rc_strings = self::read_ini($zip, "redcap/redcap_v$version/LanguageUpdater/English.ini");
            $em_strings = self::read_ini($zip, "redcap/redcap_v$version/ExternalModules/classes/English.ini");
            $result = array_merge($rc_strings, $em_strings);
            $zip->close();
        }
        // Delete the archive
        unlink($local_file);
        return $result;
    }

    public static function get_strings_from_current() {
        $rc_strings = parse_ini_file(APP_PATH_DOCROOT . "LanguageUpdater/English.ini");
        $em_strings = parse_ini_file(APP_PATH_EXTMOD."classes/English.ini");
        $result = array_merge($rc_strings, $em_strings);
        return $result;
    }

    public static function strings_to_ini($strings, $header = "") {
        $lines = empty($header) ? [] : ["$header"];
        foreach ($strings as $key => $text) {
            $lines[] = $key . ' = "' . self::convert_ini_whitespace($text) . '"';
        }
        return join("\n", $lines);
    }

    private static function convert_ini_whitespace($string) {
        return str_replace(
            array( '"' , "\r\n", "\r", "\n", "\t", "  ", "  ", "  ", "  ", "  ", "  " ), 
            array( '\"', ' '   , ' ' , ' ' , ' ' , ' ' , ' ' , ' ' , ' ' , ' ' , ' '  ), 
            $string);
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

    public function get_uploaded_versions() {
        $versions = [];
        $uploads = $this->getSystemSetting(self::UPLOADS_SETTING_NAME);
        foreach ($uploads as $version => $_) {
            $versions[$version] = "$version";
        }
        return $versions;
    }

    public static function generate_metadata($edoc_id, $version, $code, $brute, $previous = []) {
        $strings = REDCapTranslatorExternalModule::get_strings_from_zip($edoc_id, $version);
        $json = [
            "version" => $version,
            "strings" => [],
            "new-strings" => [],
            "removed-strings" => [],
            "missing-strings" => [],
        ];

        foreach ($strings as $key => $text) {
            // Normalize string before hashing
            $text = self::convert_ini_whitespace($text);
            $hash = sha1($text);
            $new = false; // TODO - based on prev file
            $changed = false; // TODO - based on prev file
            $html = self::contains_html($text); // TODO - or'ed with prev file
            $length_restricted = null; // TODO - merge prev
            $entry = [
                "text" => $text,
                "hash" => $hash,
                "new" => $new,
                "changed" => $changed,
                "html" => $html,
                "interpolated" => self::num_interpolations($text),
                "length-restricted" => $length_restricted,
            ];
            $json["strings"][$key] = $entry;
        }

        if ($code) {
            self::augment_with_code($json, $edoc_id, $brute, $previous);
        }
        return $json;
    }

    private static function augment_with_code(&$json, $edoc_id, $brute, $previous) {
        // Copy archive to local temp
        $local_file = \Files::copyEdocToTemp($edoc_id);
        // Extract and merge languages
        $zip = new \ZipArchive;
        $result = $zip->open($local_file);
        if ($result !== true) {
            throw new \Exception("Failed to open ZIP file ($result).");
        }
        $code_window_size = 2; // lines above and below

        if ($brute) {

        }
        else {
            // Search for candidates in all files
            $re = '/((::_lang\s*\()|(\$lang\s*\[)|(\$GLOBALS\s*\[\s*(?\'q1\'[\'"])lang(?P=q1)]\s*\[)|(RCView::(tt(fy){0,1}(_[a-z_]+){0,1}\())|(RCView::getLangStringByKey\s*\())\s*(?\'q2\'[\'"])(?\'key\'[a-z0-9_]+)(?P=q2)/m';
            for ($i = 0; $i < $zip->numFiles; $i++) {
                $name = $zip->getNameIndex($i);
                $ext = strtolower(array_pop(explode(".", $name)));
                if (!($ext == "php" || $ext == "js")) continue; // Skip all but .php/.js files
                $content = $zip->getFromIndex($i);
                if (preg_match_all($re, $content, $matches, PREG_OFFSET_CAPTURE)) {
                    $content_lines = explode("\n", $content);
                    $n_lines = count($content_lines);
                    foreach ($matches["key"] as $match) {
                        list($key, $offset) = $match;
                        // Calculate the line number
                        $line_number = substr_count(substr($content, 0, $offset), "\n") + 1;
                        // Generate a context hash
                        $line_start = $line_number - $code_window_size;
                        $line_end = $line_number + $code_window_size;
                        if ($line_start < 1) {
                            $line_end = min($n_lines, $line_end + (1 - $line_start));
                            $line_start = 1;
                        }
                        if ($line_end > $n_lines) {
                            $line_start = max(1, $line_start - ($line_end - $n_lines));
                            $line_end = $n_lines;
                        }
                        $context_lines = [];
                        for ($ci = $line_start - 1; $ci < $line_end; $ci++) {
                            $context_lines[] = $content_lines[$ci];
                        }
                        $context_hash = sha1(join("\n", $context_lines));
                        $source_location = [
                            "file" => str_replace("redcap/redcap_v{$json["version"]}", "", $name),
                            "line" => $line_number,
                            "context-hash" => $context_hash,
                            "new" => false, // TODO - factor in previous
                            "new-context" => false, // TODO - factor in previous
                        ];
                        if (isset($json["strings"][$key])) {
                            if (!isset($json["strings"][$key]["source-locations"])) $json["strings"][$key]["source-locations"] = [];
                            $json["strings"][$key]["source-locations"][] = $source_location;
                        }
                        else {
                            $json["missing-strings"][$key][] = $source_location;
                        }
                    }
                    unset($content); 
                    unset($content_lines);
                }
            }
        }
        // Close and delete the temp file
        $zip->close();
        unlink($local_file);
    }

    private static function contains_html($s) {
        return strcmp($s, strip_tags($s)) != 0;
    }

    private static function num_interpolations($s) {
        $n = preg_match_all('/.*\{\d+(:.+){0,1}\}/m', $s);
        if ($n === false) $n = 0;
        return $n;
    }
}