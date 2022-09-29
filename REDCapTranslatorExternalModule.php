<?php namespace RUB\REDCapTranslatorExternalModule;

require_once "classes/InjectionHelper.php";

/**
 * ExternalModule class for REDCap Translator.
 */
class REDCapTranslatorExternalModule extends \ExternalModules\AbstractExternalModule {

    // Constants
    public const PACKAGES_SETTING_NAME = "packages";
    public const PASSWORD_SETTING_NAME = "no-auth-password";
    public const METADATAFILES_SETTING_NAME = "metadata-files";
    public const METADATAFILE_STORAGE_SETTING_PREFIX = "metadata-file-";
    public const TRANSLATIONS_SETTING_NAME = "translations";
    public const TRANSLATIONS_SETTING_STRINGS_PREFIX = "strings-";
    public const TRANSLATIONS_SETTING_ANNOTATION_PREFIX = "annotation-";
    public const CURRENT_TRANSLATION_SETTING_NAME = "current-translate";
    public const INSCREEN_ENABLED_SETTING_NAME = "inscreen-enabled";
    public const CURRENT_TRANSLATION_BASEDON_SETTING_NAME = "current-translate-basedon";
    public const DEBUG_SETTING_NAME = "debug-mode";
    public const INVISIBLE_CHAR_1 = "‌"; // U+200C Zero-width non-joiner
    public const INVISIBLE_CHAR_2 = "‍"; // U+200D Zero-width joiner
    public const IN_SCREEN_VERSION_INI_KEY = "redcap_translation_assistant_version";
    public const IN_SCREEN_KEYS_INI_KEY = "redcap_translation_assistant_keys";

    /**
     * @var InjectionHelper
     */
    public $ih = null;
 
    function __construct() {
        parent::__construct();
        $this->ih = InjectionHelper::init($this);
    }

    function redcap_module_link_check_display($project_id, $link) {
        if ($link["tt_name"] == "module_link_plugin") {
            return $link;
        }
        if ($link["tt_name"] == "module_link_translate") {
            // TODO - suppress on plugin page
            return $this->getSystemSetting(self::INSCREEN_ENABLED_SETTING_NAME) === true ? $link : null;
        }
        return $link;
    }

    function redcap_every_page_top($project_id = null) {
        $page = defined("PAGE_FULL") ? PAGE_FULL : "";
        if ($page == "") return; // Should never be the case
        $this->inject_in_screen_code($page);
    }
    
    function redcap_module_ajax($action, $payload, $project_id, $record, $instrument, $event_id, $repeat_instance, $survey_hash, $response_id, $survey_queue_hash, $page, $page_full, $user_id, $group_id) {
        switch($action) {
            case "create-new-translation":
                $error = $this->validateCreateNewLang($payload);
                if (empty($error)) {
                    $store = $this->getSystemSetting(self::TRANSLATIONS_SETTING_NAME) ?? [];
                    if (isset($store[$payload["name"]])) {
                        $error = "A language named '{$payload["name"]}' already exists.";
                    }
                    else {
                        unset($payload["strings"]);
                        $payload["coverage"] = "TBD";
                        $payload["timestamp"] = $this->get_current_timestamp();
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
            case "metadata-delete": 
                $version = $payload;
                $this->delete_metadata_file($version);
                return [
                    "success" => true,
                ];
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
                $error = "";
                switch ($setting) {
                    case "debug":
                        $this->setSystemSetting(self::DEBUG_SETTING_NAME, $value === true);
                        break;
                    case "inScreenEnabled":
                        $this->setSystemSetting(self::INSCREEN_ENABLED_SETTING_NAME, $value === true);
                        break;
                    case "currentTranslation":
                        $translations = $this->get_translations();
                        if (array_key_exists($value, $translations)) {
                            $this->setSystemSetting(self::CURRENT_TRANSLATION_SETTING_NAME, $value);
                        }
                        else {
                            $error = "There is no translation named '$value'.";
                        }
                        break;
                    case "currentTranslationBasedOn":
                        $metadata_files = $this->get_metadata_files();
                        if (array_key_exists($value, $metadata_files)) {
                            $this->setSystemSetting(self::CURRENT_TRANSLATION_BASEDON_SETTING_NAME, $value);
                        }
                        else {
                            $error = "There is no metadata file for '$value'.";
                        }
                        break;
                    default:
                        $error = "Unknown setting '$setting'.";
                        break;
                }
                return [
                    "success" => empty($error),
                    "error" => $error,
                ];
            default:
                return [
                    "success" => false,
                    "error" => "Invalid action '$action'."
                ];
        }
    }
    

    public function get_password() {
        $pwd = $this->getSystemSetting(self::PASSWORD_SETTING_NAME) ?? null;
        if (empty($pwd)) {
            // Generate a random password
            $pwd = "random"; // TODO
            $this->setSystemSetting(self::PASSWORD_SETTING_NAME, $pwd);
        }
        return $pwd;
    }

    public function set_password($new_password) {
        // Some checks
        if (mb_strlen($new_password) < 10) {
            return "The password must consist of at least 10 characters.";
        }
        if (!preg_match('/[A-Z]/', $new_password)) {
            return "The password must include at least one upper case letter (A-Z).";
        }
        if (!preg_match('/[a-z]/', $new_password)) {
            return "The password must include at least one lower case letter (a-z).";
        }
        if (!preg_match('/[0-9]/', $new_password)) {
            return "The password must include at least one digit (0-9).";
        }
        $this->setSystemSetting(self::PASSWORD_SETTING_NAME, $new_password);
        return "";
    }

    private function inject_in_screen_code($page) {
        // Skip this module's plugin page
        if ($page == APP_URL_EXTMOD_RELATIVE."index.php" && $_REQUEST["prefix"] == $this->PREFIX) return;
        // Do nothing if in-screen translation is disabled
        if ($this->getSystemSetting(self::INSCREEN_ENABLED_SETTING_NAME) !== true) return;
        // Check if translation and metadata are valid
        $current_translation = $this->get_current_translation();
        if (empty($current_translation["name"]) || empty($current_translation["based-on"])) return;

        $this->initializeJavascriptModuleObject();
        $this->ih->js("in-screen/translator.js");
        // Prepare initialization object
        $settings = array(
            "debug" => $this->getSystemSetting(REDCapTranslatorExternalModule::DEBUG_SETTING_NAME) === true,
            "jsmoName" => $this->getJavascriptModuleObjectName(),
            "name" => $current_translation["name"],
            "basedOn" => $current_translation["based-on"],
        );
        $json = json_encode($settings, JSON_FORCE_OBJECT);
        print "<script>\n\twindow.REDCap.EM.RUB.REDCapInScreenTranslator.init($json);\n</script>\n";
        require dirname(__FILE__)."/toasts.php";

    }

    public function store_translation($info, $strings, $annotations) {
        // Purge all parts that should not be stored
        $translation = $this->sanitize_translation($info);
        // Store the file, in parts
        $stored = $this->getSystemSetting(REDCapTranslatorExternalModule::TRANSLATIONS_SETTING_NAME) ?? [];
        // Created or updated?
        $verb = isset($stored[$info["name"]]) ? "Updated" : "Created";
        // Update storage
        $translation["coverage"] = "TBD";
        if (!isset($translation["iso"])) $translation["iso"] = "";
        if (!isset($translation["timestamp"])) $translation["timestamp"] = "(???)";
        $stored[$translation["name"]] = $translation;
        $this->setSystemSetting(REDCapTranslatorExternalModule::TRANSLATIONS_SETTING_NAME, $stored);
        $this->setSystemSetting(REDCapTranslatorExternalModule::TRANSLATIONS_SETTING_STRINGS_PREFIX.$translation["name"], $strings);
        $this->setSystemSetting(REDCapTranslatorExternalModule::TRANSLATIONS_SETTING_ANNOTATION_PREFIX.$translation["name"], $annotations);
        $this->log("$verb translation file '{$translation["name"]}' ({$translation["filename"]}).");
    }

    public function get_translations() {
        $translations = [];
        $stored = $this->getSystemSetting(REDCapTranslatorExternalModule::TRANSLATIONS_SETTING_NAME);
        foreach ($stored as $name => $entry) {
            $translations[$name] = [
                "name" => $entry["name"],
                "localized-name" => $entry["localized-name"],
                "iso" => $entry["iso"],
                "coverage" => $entry["coverage"],
                "updated" => $entry["timestamp"],
            ];
        }
        return $translations;
    }

    public function get_translation($name) {
        $stored = $this->getSystemSetting(REDCapTranslatorExternalModule::TRANSLATIONS_SETTING_NAME) ?? [];
        if (!array_key_exists($name, $stored)) return null;
        $translation = $this->sanitize_translation($stored[$name]);
        $strings = $this->getSystemSetting(REDCapTranslatorExternalModule::TRANSLATIONS_SETTING_STRINGS_PREFIX.$name) ?? null;
        $translation["strings"] = empty($strings) ? new \stdClass : $strings;
        $annotations = $this->getSystemSetting(REDCapTranslatorExternalModule::TRANSLATIONS_SETTING_ANNOTATION_PREFIX.$name) ?? null;
        $translation["annotations"] = empty($annotations) ? new \stdClass : $annotations;
        return $translation;
    }

    public function validateCreateNewLang($data) {
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

    // Purge all parts that should not be stored
    public function sanitize_translation($json) {
        foreach (array_keys($json) as $key) {
            if (!in_array($key, ["name","localized-name","iso","timestamp","maintained-by","url","filename"], true)) {
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


    public function get_strings_from_zip($doc_id, $version) {
        // Copy archive to local temp
        $local_file = \Files::copyEdocToTemp($doc_id);
        // Extract and merge languages
        $zip = new \ZipArchive;
        $result = $zip->open($local_file);
        if ($result === true) {
            $rc_strings = $this->read_ini($zip, "redcap/redcap_v$version/LanguageUpdater/English.ini");
            $em_strings = $this->read_ini($zip, "redcap/redcap_v$version/ExternalModules/classes/English.ini");
            $result = array_merge($rc_strings, $em_strings);
            $zip->close();
        }
        // Delete the archive
        unlink($local_file);
        return $result;
    }

    public function get_strings_from_current() {
        $rc_strings = parse_ini_file(APP_PATH_DOCROOT . "LanguageUpdater/English.ini");
        $em_strings = parse_ini_file(APP_PATH_EXTMOD."classes/English.ini");
        $result = array_merge($rc_strings, $em_strings);
        return $result;
    }

    public function strings_to_ini($strings, $header = "") {
        $lines = empty($header) ? [] : ["$header"];
        foreach ($strings as $key => $text) {
            $lines[] = $key . ' = "' . $this->convert_ini_whitespace($text) . '"';
        }
        return join("\n", $lines);
    }

    private function convert_ini_whitespace($string) {
        return str_replace(
            array( '"' , "\r\n", "\r", "\n", "\t", "  ", "  ", "  ", "  ", "  ", "  " ), 
            array( '\"', ' '   , ' ' , ' ' , ' ' , ' ' , ' ' , ' ' , ' ' , ' ' , ' '  ), 
            $string);
    }

    private function read_ini($zip, $path) {
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
    public function get_hash($text) {
        return substr(sha1($text), 0, 6);
    }

    /**
     * Gets the 'generator' content for metadata files
     * @return array 
     */
    private function get_generator() {
        return [
            "name" => "REDCap Translation Assistant",
            "version" => $this->VERSION,
            "author" => "Dr. Günther Rezniczek",
            "url" => "https://github.com/grezniczek/redcap_translator",
        ];
    }

    /**
     * Gets the current time formatted as YYYY-MM-DD HH:MM:SS
     * @return string
     */
    public function get_current_timestamp() {
        return date("Y-m-d H:i:s");
    }

    public function validate_and_sanitize_metadata(&$meta) {
        // TODO

        return true;
    }

    public function generate_metadata($doc_id, $version, $previous_version, $add_code) {
        $strings = $this->get_strings_from_zip($doc_id, $version);
        $json = [
            "version" => $version,
            "based-on" => $previous_version,
            "generator" => $this->get_generator(),
            "timestamp" => $this->get_current_timestamp(),
            "strings" => [],
            "new-strings" => [],
            "removed-strings" => [],
            "unused-strings" => [],
            "missing-strings" => [],
            "stats" => [],
        ];

        foreach ($strings as $key => $text) {
            // Normalize string before hashing
            $annotation = ""; // TODO - merge from prev
            $hash = $this->get_hash($text);
            $new = false; // TODO - based on prev file
            $changed = false; // TODO - based on prev file
            $html = $this->contains_html($text); // TODO - or'ed with prev file - if unknown: null
            $length_restricted = null; // TODO - merge prev, null = unknown, 0 = unrestricted, n = restricted to n
            $entry = [
                "text" => $text,
                "annotation" => $annotation,
                "hash" => $hash,
                "new" => $new,
                "changed" => $changed,
                "html" => $html,
                "interpolated" => $this->num_interpolations($text),
                "length-restricted" => $length_restricted,
            ];
            $json["strings"][$key] = $entry;
        }
        // Stats
        $json["stats"]["n-strings"] = count($json["strings"]);
        // TODO - new, changed - from prev file
        // Code lens
        if ($add_code) {
            $this->augment_with_code($json, $doc_id, $previous_version);
        }
        $json["stats"]["n-new-strings"] = count($json["new-strings"]);
        $json["stats"]["n-removed-strings"] = count($json["removed-strings"]);
        $json["stats"]["n-unused-strings"] = count($json["unused-strings"]);
        $json["stats"]["n-missing-strings"] = count($json["missing-strings"]);
        return $json;
    }

    private function augment_with_code(&$json, $doc_id, $previous) {
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
                $hash = $this->get_hash(join("\n", $lines));
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

    private function contains_html($s) {
        return strcmp($s, strip_tags($s)) != 0;
    }

    private function num_interpolations($s) {
        $n = preg_match_all('/.*\{\d+(:.+){0,1}\}/m', $s);
        if ($n === false) $n = 0;
        return $n;
    }


    public function get_current_translation() {
        $translations = $this->get_translations();
        $metadata_files = $this->get_metadata_files();
        $current_translation = $this->getSystemSetting(REDCapTranslatorExternalModule::CURRENT_TRANSLATION_SETTING_NAME) ?? "";
        if (!array_key_exists($current_translation, $translations)) {
            $current_translation = count($translations) ? array_key_first($translations) : "";
        }
        $current_translation_based_on = $this->getSystemSetting(REDCapTranslatorExternalModule::CURRENT_TRANSLATION_BASEDON_SETTING_NAME) ?? "";
        if (!array_key_exists($current_translation_based_on, $metadata_files)) {
            $current_translation_based_on = count($metadata_files) ? array_key_first($metadata_files) : "";
        }
        return [ 
            "name" => $current_translation, 
            "based-on" => $current_translation_based_on 
        ];
    }


    public function get_metadata_files() {
        $stored = $this->getSystemSetting(self::METADATAFILES_SETTING_NAME) ?? [];
        return $stored;
    }

    public function get_metadata_file($version) {
        $file = $this->getSystemSetting(self::METADATAFILE_STORAGE_SETTING_PREFIX.$version) ?? null;
        if ($file) {
            return json_decode($file, true);
        }
        return null;
    }

    public function store_metadata_file($meta) {
        $version = $meta["version"];
        // Store data
        $file = json_encode($meta, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        $size = strlen($file);
        $this->setSystemSetting(self::METADATAFILE_STORAGE_SETTING_PREFIX.$version, $file);
        unset($file);
        // Store info in directory
        $n_strings = count($meta["strings"] ?? []);
        $n_annotations = count($meta["annotations"] ?? []);
        $code = isset($meta["stats"]["n-php-files"]);
        $info = [
            "version" => $meta["version"],
            "updated" => $meta["timestamp"],
            "strings" => $n_strings,
            "annotations" => $n_annotations,
            "code" => $code,
            "size" => $size,
        ];
        $stored = $this->getSystemSetting(self::METADATAFILES_SETTING_NAME) ?? [];
        $stored[$version] = $info;
        $this->setSystemSetting(self::METADATAFILES_SETTING_NAME, $stored);
        return $info;
    }

    public function delete_metadata_file($version) {
        $stored = $this->getSystemSetting(self::METADATAFILES_SETTING_NAME) ?? [];
        if (!array_key_exists($version, $stored)) {
            throw new \Exception("Metadata file for version '$version' does not exist.");
        }
        unset($stored[$version]);
        $this->setSystemSetting(self::METADATAFILES_SETTING_NAME, $stored);
        $this->setSystemSetting(self::METADATAFILE_STORAGE_SETTING_PREFIX.$version, null);
    }

    public function encode_invisible($idx) {
        $binary = substr("0000000000000000".decbin($idx), -16);
        $invisible = str_replace(["0","1"], [self::INVISIBLE_CHAR_1,self::INVISIBLE_CHAR_2], $binary);
        return $invisible;
    }


    #region Crons

    function code_lens_cron($cron_info) {
        // TODO
        // This is some dummy action
        $state = $this->get_state();
        $state["counter"]++;
        $state["last-updated"] = $this->get_current_timestamp();
        $this->setSystemSetting("state", $state);
    }

    #endregion

}