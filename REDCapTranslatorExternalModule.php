<?php namespace RUB\REDCapTranslatorExternalModule;

use MicrosoftAzure\Storage\Common\Exceptions\InvalidArgumentTypeException;
use LogicException;
use RuntimeException;

require_once "classes/InjectionHelper.php";

/**
 * ExternalModule class for REDCap Translator.
 */
class REDCapTranslatorExternalModule extends \ExternalModules\AbstractExternalModule {


    public const PACKAGES_SETTING_NAME = "packages";
    public const METADATAFILES_SETTING_NAME = "metadata-files";
    public const TRANSLATIONS_SETTING_NAME = "translations";
    public const TRANSLATIONS_SETTING_STRINGS_PREFIX = "strings-";
    public const TRANSLATIONS_SETTING_ANNOTATION_PREFIX = "annotation-";
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

    public static function validateCreateNewLang($data) {
        if (empty($data["name"])) {
            return "Missing required item 'name'.";
        }
        $re = '/^[A-Za-z_-]+$/m';
        if (!preg_match($re, $data["name"])) {
            return "Item 'name' must consist of letters, hyphen, and underscore only.";
        }
        if (mb_strlen($data["name"]) > 100) {
            return "Item 'name' exceeds the maximum length of 100 characters.";
        }
        if (empty($data["localized-name"])) {
            return "Missing required item 'localized-name'.";
        }
        if (mb_strlen($data["localized-name"]) > 100) {
            return "Item 'localized-name' exceeds the maximum length of 100 characters.";
        }
        if (mb_strlen($data["iso"]) > 10) {
            return "Item 'iso' exceeds the maximum length of 10 characters.";
        }
        if (!is_array($data["strings"])) {
            return "Missing or invalid required item 'strings'.";
        }
        return "";
    }

    function redcap_module_ajax($action, $payload, $project_id, $record, $instrument, $event_id, $repeat_instance, $survey_hash, $response_id, $survey_queue_hash, $page, $page_full, $user_id, $group_id) {
        switch($action) {
            case "create-new-translation":
                $error = self::validateCreateNewLang($payload);
                if (empty($error)) {
                    $store = $this->getSystemSetting(self::TRANSLATIONS_SETTING_NAME) ?? [];
                    if (isset($store[$payload["name"]])) {
                        $error = "A language named '{$payload["name"]}' already exists.";
                    }
                    else {
                        unset($payload["strings"]);
                        $payload["coverage"] = "TBD";
                        $payload["timestamp"] = self::get_current_timestamp();
                        $payload["filename"] = $payload["name"].".json";
                        $store[$payload["name"]] = $payload;
                        $this->setSystemSetting(self::TRANSLATIONS_SETTING_NAME, $store);
                        return [
                            "success" => true,
                            "data" => $payload
                        ];
                    }
                }
                return [
                    "success" => false,
                    "error" => $error
                ];
                break;
            case "translation-delete": 
                $name = $payload;
                $store = $this->getSystemSetting(self::TRANSLATIONS_SETTING_NAME) ?? [];
                if (array_key_exists($name, $store)) {
                    $this->setSystemSetting(self::TRANSLATIONS_SETTING_STRINGS_PREFIX.$name, null);
                    $this->setSystemSetting(self::TRANSLATIONS_SETTING_ANNOTATION_PREFIX.$name, null);
                    unset($store[$name]);
                    $this->setSystemSetting(self::TRANSLATIONS_SETTING_NAME, $store);
                    $this->log("Deleted language '{$name}'.");
                    return [
                        "success" => true,
                    ];
                }
                else {
                    return [
                        "success" => false,
                        "error" => "This language does not exist on the server."
                    ];
                }
                break;
            case "package-delete":
                $version = $payload;
                $store = $this->getSystemSetting(self::PACKAGES_SETTING_NAME) ?? [];
                if (array_key_exists($version, $store)) {
                    $doc_id = $store[$version];
                    $this->log("Deleted package version $version (doc_id = $doc_id).");
                    \Files::deleteFileByDocId($doc_id);
                    unset($store[$version]);
                    $this->setSystemSetting(self::PACKAGES_SETTING_NAME, $store);
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
            case "package-get-zip":
                $version = $payload;
                $store = $this->getSystemSetting(self::PACKAGES_SETTING_NAME) ?? [];
                if (array_key_exists($version, $store)) {
                    $doc_id = $store[$version];
                    $doc_hash = \Files::docIdHash($doc_id);
                    $url = APP_PATH_WEBROOT . "DataEntry/file_download.php?doc_id_hash=$doc_hash";
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
            default:
                return [
                    "success" => false,
                    "error" => "Invalid action '$action'."
                ];
        }
    }


    // Purge all parts that should not be stored
    public static function sanitize_translation($json) {
        foreach (array_keys($json) as $key) {
            if (!in_array($key, ["name","localized-name","iso","timestamp","maintained-by","url"], true)) {
                unset($json[$key]);
            }
        }
        return $json;
    }

    public function get_state() {
        $state = $this->getSystemSetting("state") ?? [ 
            "counter" => 0,
            "last-updated" => "never"
        ];
        return $state;
    }


    public static function get_strings_from_zip($doc_id, $version) {
        // Copy archive to local temp
        $local_file = \Files::copyEdocToTemp($doc_id);
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


    /**
     * Generates a hash value of a string that is compatible with MLM
     * @param string $text 
     * @return string 
     */
    public static function get_hash($text) {
        return substr(sha1($text), 0, 6);
    }

    /**
     * Gets the 'generator' content for metadata files
     * @param string $module_version 
     * @return array 
     */
    private static function get_generator($module_version) {
        return [
            "name" => "REDCap Translation Assistant",
            "version" => $module_version,
            "author" => "Dr. Günther Rezniczek",
            "url" => "https://github.com/grezniczek/redcap_translator",
        ];
    }

    /**
     * Gets the current time formatted as YYYY-MM-DD HH:MM:SS
     * @return string
     */
    public static function get_current_timestamp() {
        return date("Y-m-d H:i:s");
    }

    public static function validate_and_sanitize_metadata(&$json, $module_version) {
        // TODO

        return true;
    }

    public static function generate_metadata($doc_id, $version, $previous_version, $add_code, $module_version) {
        $strings = REDCapTranslatorExternalModule::get_strings_from_zip($doc_id, $version);
        $json = [
            "version" => $version,
            "based-on" => $previous_version,
            "generator" => self::get_generator($module_version),
            "timestamp" => self::get_current_timestamp(),
            "strings" => [],
            "new-strings" => [],
            "removed-strings" => [],
            "unused-strings" => [],
            "missing-strings" => [],
            "stats" => [],
        ];

        foreach ($strings as $key => $text) {
            // Normalize string before hashing
            $text = self::convert_ini_whitespace($text);
            $annotation = ""; // TODO - merge from prev
            $hash = self::get_hash($text);
            $new = false; // TODO - based on prev file
            $changed = false; // TODO - based on prev file
            $html = self::contains_html($text); // TODO - or'ed with prev file - if unknown: null
            $length_restricted = null; // TODO - merge prev, null = unknown, 0 = unrestricted, n = restricted to n
            $entry = [
                "text" => $text,
                "annotation" => $annotation,
                "hash" => $hash,
                "new" => $new,
                "changed" => $changed,
                "html" => $html,
                "interpolated" => self::num_interpolations($text),
                "length-restricted" => $length_restricted,
            ];
            $json["strings"][$key] = $entry;
        }
        // Stats
        $json["stats"]["n-strings"] = count($json["strings"]);
        // TODO - new, changed - from prev file
        // Code lens
        if ($add_code) {
            self::augment_with_code($json, $doc_id, $previous_version);
        }
        $json["stats"]["n-new-strings"] = count($json["new-strings"]);
        $json["stats"]["n-removed-strings"] = count($json["removed-strings"]);
        $json["stats"]["n-unused-strings"] = count($json["unused-strings"]);
        $json["stats"]["n-missing-strings"] = count($json["missing-strings"]);
        return $json;
    }

    private static function augment_with_code(&$json, $doc_id, $previous) {
        // Copy archive to local temp
        $local_file = \Files::copyEdocToTemp($doc_id);
        // Extract and merge languages
        $zip = new \ZipArchive;
        $result = $zip->open($local_file);
        if ($result !== true) {
            throw new \Exception("Failed to open ZIP file ($result).");
        }
        $code_window_size = 2; // lines above and below
        $n_js_files = $n_php_files = $n_brute_forced = 0;
        // Search for candidates in all files
        for ($i = 0; $i < $zip->numFiles; $i++) {
            $name = $zip->getNameIndex($i);
            $source_path = str_replace("redcap/redcap_v{$json["version"]}", "", $name);
            $ext = strtolower(array_pop(explode(".", $name)));
            if (!($ext == "php" || $ext == "js")) continue; // Skip all but .php/.js files
            if (strpos($source_path, "/Libraries/vendor/") === 0) continue; // Skip vendor libs
            // Count files
            $n_js_files +=  ($ext == "js" ) ? 1 : 0;
            $n_php_files += ($ext == "php") ? 1 : 0;
            // Get contents and split into lines
            $content = $zip->getFromIndex($i);
            $content_lines = explode("\n", $content);
            $n_lines = count($content_lines);

            // Helper function to get source context info (line number and surrounding hash)
            $get_context = function($offset) use ($content, $content_lines, $n_lines, $code_window_size) {
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
                $lines = [];
                for ($ci = $line_start - 1; $ci < $line_end; $ci++) {
                    $lines[] = $content_lines[$ci];
                }
                $hash = self::get_hash(join("\n", $lines));
                return [ $line_number, $hash ];
            };

            // Regex to find various lang string accessors - see: https://regex101.com/r/6R3tty/4
            $re = '/((::_lang\s*\()|(\$lang\s*\[)|(\$GLOBALS\s*\[\s*(?\'q1\'[\'"])lang(?P=q1)]\s*\[)|(RCView::(tt(fy){0,1}(_[a-z0-9_]+){0,1}\())|(RCView::getLangStringByKey\s*\())\s*(?\'q2\'[\'"]{0,1})(?\'key\'[a-z0-9_]+)(?P=q2)/m';
            if (preg_match_all($re, $content, $matches, PREG_OFFSET_CAPTURE)) {
                foreach ($matches["key"] as $match) {
                    list($key, $offset) = $match;
                    list($line_number, $context_hash) = $get_context($offset);
                    $source_location = [
                        "context-hash" => $context_hash,
                        "new" => false, // TODO - factor in previous
                        "new-context" => false, // TODO - factor in previous
                    ];
                    if (isset($json["strings"][$key])) {
                        $json["strings"][$key]["source-locations"][$source_path][$line_number] = $source_location;
                    }
                    else {
                        $json["missing-strings"][$key]["source-locations"][$source_path][$line_number] = $source_location;
                    }
                }
            }
            // Find additional entries by searching for each defined string
            foreach ($json["strings"] as $key => &$item) {
                $re =  '/(?\'q1\'[\'"])'.$key.'(?P=q1)/m';
                if (preg_match_all($re, $content, $matches, PREG_OFFSET_CAPTURE)) {
                    foreach ($matches[0] as $match) {
                        $offset = $match[1];
                        list($line_number, $context_hash) = $get_context($offset);
                        if (!isset($item["source-locations"][$source_path][$line_number])) {
                            $n_brute_forced++;
                            $source_location = [
                                "context-hash" => $context_hash,
                                "new" => false, // TODO - factor in previous
                                "new-context" => false, // TODO - factor in previous
                                "via-brute" => true,
                            ];
                            $item["source-locations"][$source_path][$line_number] = $source_location;
                        }
                    }
                }
            }
            unset($content); 
            unset($content_lines);
        }
        // Close and delete the temp file
        $zip->close();
        unlink($local_file);
        // Update stats and find missing
        foreach ($json["strings"] as $key => &$item) {
            $item["n-source-files"] = count($item["source-locations"] ?? []);
            $n_locations = 0;
            foreach ($item["source-locations"] ?? [] as $path => $locations) {
                $n_locations += count($locations);
            }
            $item["n-source-locations"] = $n_locations;
            if ($n_locations == 0) {
                $json['unused-strings'][] = $key;
            }
        }

        $json["stats"]["n-php-files"] = $n_php_files;
        $json["stats"]["n-js-files"] = $n_js_files;
        $json["stats"]["n-brute"] = $n_brute_forced;
    }

    private static function contains_html($s) {
        return strcmp($s, strip_tags($s)) != 0;
    }

    private static function num_interpolations($s) {
        $n = preg_match_all('/.*\{\d+(:.+){0,1}\}/m', $s);
        if ($n === false) $n = 0;
        return $n;
    }


    function code_lens_cron($cron_info) {
        $state = $this->get_state();
        $state["counter"]++;
        $state["last-updated"] = self::get_current_timestamp();
        $this->setSystemSetting("state", $state);
    }
}