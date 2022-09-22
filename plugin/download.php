<?php namespace RUB\REDCapTranslatorExternalModule;

class Downloader {

    const err_unsupported = "Unsupported action.";
    const err_nofile = "Failed to locate file on server.";
    const err_nometadata = "Failed to locate the metadata file on the server.";
    const err_invalidzip = "Failed to open ZIP archive (#CODE#). Damaged file?";

    /**
     * Downloads files
     * @param REDCapTranslatorExternalModule $m 
     * @return void 
     */
    public static function start($m) {
        try {
            $mode = $_GET["mode"] ?? "";
            switch ($mode) {
                case "package-get-strings":
                case "package-get-zip":
                    return self::get_package($m, $mode, $_GET["version"] ?? "");
                case "gen-metadata-json":
                    return self::get_metadata($m, $_GET["version"], $_GET["previous"], $_GET["code"] === "1");
                case "translation-get-json":
                case "translation-get-ini":
                case "translation-get-in-screen-ini":
                    return self::get_translation($m, $mode, $_GET["name"], $_GET["based-on"]);
                default:
                    return self::err_unsupported;
            }
        }
        catch(\Throwable $t) {
            print "ERROR while generating downloadable file: ".$t->getMessage();
        }
    }

    private static function get_file_info($m, $doc_id) {
        // Get metadata
        $sql = "SELECT * FROM redcap_edocs_metadata WHERE doc_id = ? AND ISNULL(project_id) AND (delete_date IS NULL OR (delete_date IS NOT NULL AND delete_date > '".NOW."'))";
        $result = $m->query($sql, [$doc_id]);
        return db_fetch_assoc($result);
    }

    private static function get_package($m, $mode, $version) {
        // Verify stored version
        $stored = $m->getSystemSetting(REDCapTranslatorExternalModule::PACKAGES_SETTING_NAME) ?? [];
        if (!array_key_exists($version, $stored)) return self::err_nofile;
        $doc_id = $stored[$version];
        $file_info = self::get_file_info($m, $doc_id);
        if (empty($file_info) || $file_info["doc_id"] != $doc_id) return self::err_nofile;
        // Download ZIP package
        if ($mode == "package-get-zip") {
            // Copy file and serve, then delete
            $local_file = \Files::copyEdocToTemp($doc_id);
            header('Content-Type: '.$file_info['mime_type'].'; name="'.$file_info['doc_name'].'"');
            header('Content-Disposition: attachment; filename="'.$file_info['doc_name'].'"');
            readfile_chunked($local_file);
            unlink($local_file);
            exit;
        }
        // Get the strings
        if ($mode == "package-get-strings") {
            $result = REDCapTranslatorExternalModule::get_strings_from_zip($doc_id, $version);
            if (is_array($result)) {
                $ini_name = "English_v$version.ini";
                header('Content-Type: text/plain; name="'.$ini_name.'"');
                header('Content-Disposition: attachment; filename="'.$ini_name.'"');
                print REDCapTranslatorExternalModule::strings_to_ini($result, "; English.ini - REDCap v$version [generated by REDCap Translation Assistant EM]");
            }
            else {
                print str_replace("#CODE#", $result, self::err_invalidzip);
            }
            exit;
        }
    }

    private static function get_translation($m, $mode, $name, $based_on) {
        // Verify stored version
        $stored = $m->getSystemSetting(REDCapTranslatorExternalModule::TRANSLATIONS_SETTING_NAME) ?? [];
        if (!array_key_exists($name, $stored)) return self::err_nofile;
        $lang = $stored[$name];
        // Download JSON file
        if ($mode == "translation-get-json") {
            // Build and serve JSON 
            $json = REDCapTranslatorExternalModule::sanitize_translation($lang);
            $json["strings"] = $m->getSystemSetting(REDCapTranslatorExternalModule::TRANSLATIONS_SETTING_STRINGS_PREFIX.$name);
            if (empty($json["strings"])) $json["strings"] = new \stdClass;
            $json["annotations"] = $m->getSystemSetting(REDCapTranslatorExternalModule::TRANSLATIONS_SETTING_ANNOTATION_PREFIX.$name);
            if (empty($json["annotations"])) $json["annotations"] = new \stdClass;
            header('Content-Type: application/json; name="'.$lang["filename"].'"');
            header('Content-Disposition: attachment; filename="'.$lang["filename"].'"');
            print json_encode($json, JSON_PRETTY_PRINT);
            exit;
        }
        if ($mode == "translation-get-ini") {
            $ini_name = $lang["name"].".ini";
            $localized_name = $lang["localized-name"];
            $strings = $m->getSystemSetting(REDCapTranslatorExternalModule::TRANSLATIONS_SETTING_STRINGS_PREFIX.$name);
            if (empty($strings)) {
                print "Failed to parse JSON: " . json_last_error_msg();
                exit;
            }
            $result = [];
            // TODO - consider metadata file!
            foreach ($strings as $key => $item) {
                $result[$key] = "$key"; // TODO
            }
            header('Content-Type: text/plain; name="'.$ini_name.'"');
            header('Content-Disposition: attachment; filename="'.$ini_name.'"');
            print REDCapTranslatorExternalModule::strings_to_ini($result, "; $name.ini - $localized_name [generated by REDCap Translation Assistant EM]");
        }
    }

    private static function get_metadata($m, $version, $based_on, $add_code) {
        // Verify stored version
        $packages = $m->getSystemSetting(REDCapTranslatorExternalModule::PACKAGES_SETTING_NAME) ?? [];
        if (!array_key_exists($version, $packages)) return self::err_nofile;
        $metadata_files = $m->getSystemSetting(REDCapTranslatorExternalModule::METADATAFILES_SETTING_NAME) ?? [];
        if (!array_key_exists($based_on, $metadata_files)) return self::err_nometadata;
        $doc_id = $packages[$version];
        $result = REDCapTranslatorExternalModule::generate_metadata($doc_id, $version, $based_on, $add_code, $m->VERSION);
        $json_name = "REDCap_v{$version}_Strings_Metadata.json";
        header('Content-Type: application/json; name="'.$json_name.'"');
        header('Content-Disposition: attachment; filename="'.$json_name.'"');
        print json_encode($result, JSON_PRETTY_PRINT);
        exit;
    }
}
print Downloader::start($module);
