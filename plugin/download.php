<?php namespace RUB\REDCapTranslatorExternalModule;

class Downloader {

    const err_unsupported = "Unsupported action.";
    const err_nofile = "Failed to locate file on server.";
    const err_nometadata = "Failed to locate the metadata file on the server.";
    const err_invalidzip = "Failed to open ZIP archive (#CODE#). Damaged file?";

    /** @var REDCapTranslatorExternalModule */
    private static $m = null;

    /**
     * Downloads files
     * @param REDCapTranslatorExternalModule $m 
     * @return void 
     */
    public static function start($m) {
        self::$m = $m;
        try {
            $mode = $_GET["mode"] ?? "";
            switch ($mode) {
                case "package-get-strings":
                case "package-get-zip":
                    return self::get_package($mode, $_GET["version"] ?? "");
                case "gen-metadata-json":
                    return self::get_metadata($_GET["version"], $_GET["previous"], $_GET["code"] === "1");
                case "metadata-download":
                    return self::download_metadata($_GET["version"]);
                case "translation-get-json":
                case "translation-get-ini":
                case "translation-get-in-screen-ini":
                    return self::get_translation($mode, $_GET["name"], $_GET["based-on"]);
                default:
                    return self::err_unsupported;
            }
        }
        catch(\Throwable $t) {
            print "ERROR while generating downloadable file: ".$t->getMessage();
        }
    }

    private static function get_file_info($doc_id) {
        // Get metadata
        $sql = "SELECT * FROM redcap_edocs_metadata WHERE doc_id = ? AND ISNULL(project_id) AND (delete_date IS NULL OR (delete_date IS NOT NULL AND delete_date > '".NOW."'))";
        $result = self::$m->query($sql, [$doc_id]);
        return db_fetch_assoc($result);
    }

    private static function get_package($mode, $version) {
        // Verify stored version
        $stored = self::$m->getSystemSetting(REDCapTranslatorExternalModule::PACKAGES_SETTING_NAME) ?? [];
        if (!array_key_exists($version, $stored)) return self::err_nofile;
        $doc_id = $stored[$version];
        $file_info = self::get_file_info($doc_id);
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
            $result = self::$m->get_strings_from_zip($doc_id, $version);
            if (is_array($result)) {
                $ini_name = "English_v$version.ini";
                header('Content-Type: text/plain; name="'.$ini_name.'"');
                header('Content-Disposition: attachment; filename="'.$ini_name.'"');
                print self::$m->strings_to_ini($result, "; English.ini - REDCap v$version [generated by REDCap Translation Assistant EM]");
            }
            else {
                print str_replace("#CODE#", $result, self::err_invalidzip);
            }
            exit;
        }
    }

    private static function get_translation($mode, $name, $based_on) {
        // Verify stored version
        $translation = self::$m->get_translation($name);
        if ($translation == null) return self::err_nofile;
        // Download JSON file
        if ($mode == "translation-get-json") {
            header('Content-Type: application/json; name="'.$translation["filename"].'"');
            header('Content-Disposition: attachment; filename="'.$translation["filename"].'"');
            print json_encode($translation, JSON_PRETTY_PRINT);
            exit;
        }
        if ($mode == "translation-get-ini") {
            $ini_name = $translation["name"].".ini";
            $localized_name = $translation["localized-name"];
            $result = [];
            // TODO - consider metadata file!
            foreach ($translation["strings"] as $key => $item) {
                $result[$key] = "$key"; // TODO
            }
            header('Content-Type: text/plain; name="'.$ini_name.'"');
            header('Content-Disposition: attachment; filename="'.$ini_name.'"');
            print self::$m->strings_to_ini($result, "; $name.ini - $localized_name [generated by REDCap Translation Assistant EM]");
            exit;
        }
        if ($mode == "translation-get-in-screen-ini") {
            $ini_name = $translation["name"]."-In-Screen-$based_on.ini";
            $localized_name = $translation["localized-name"];
            $metafile = self::$m->get_metadata_file($based_on);
            if (!$metafile) {
                die(self::err_nometadata);
            }
            $result = [];
            $idx = 0;
            foreach ($metafile["strings"] as $key => $meta) {
                $item = $translation_strings[$key] ?? null;
                $text = $meta["text"]; // Default to text from metadata file
                if ($item) {
                    if (($item["do-not-translate"] ?? null) !== true) {
                        // Try to find translation matching hash
                        if (isset($item["translations"][$meta["hash"]])) {
                            $text = $item["translations"][$meta["hash"]];
                        }
                        // Or use non-hashed translation, if available
                        else if (isset($item["translations"][""])) {
                            $text = $item["translations"][""];
                        }
                    }
                }
                $result[$key] = self::$m->encode_invisible($idx) . $text . REDCapTranslatorExternalModule::STRING_TERMINATOR;
                $idx++;
            }
            $result[REDCapTranslatorExternalModule::IN_SCREEN_VERSION_INI_KEY] = $based_on;
            $result[REDCapTranslatorExternalModule::IN_SCREEN_KEYS_INI_KEY] = join(",", array_keys($metafile["strings"]));
            header('Content-Type: text/plain; name="'.$ini_name.'"');
            header('Content-Disposition: attachment; filename="'.$ini_name.'"');
            print self::$m->strings_to_ini($result, "; $name.ini (In-Screen) - $localized_name [generated by REDCap Translation Assistant EM]");
            exit;
        }
    }

    private static function get_metadata($version, $based_on, $add_code) {
        // Verify stored version
        $packages = self::$m->getSystemSetting(REDCapTranslatorExternalModule::PACKAGES_SETTING_NAME) ?? [];
        if (!array_key_exists($version, $packages)) return self::err_nofile;
        $metadata_files = self::$m->getSystemSetting(REDCapTranslatorExternalModule::METADATAFILES_SETTING_NAME) ?? [];
        if (!empty($based_on) && !array_key_exists($based_on, $metadata_files)) return self::err_nometadata;
        $doc_id = $packages[$version];
        $result = self::$m->generate_metadata($doc_id, $version, $based_on, $add_code);
        $json_name = "REDCap_v{$version}_Strings_Metadata.json";
        header('Content-Type: application/json; name="'.$json_name.'"');
        header('Content-Disposition: attachment; filename="'.$json_name.'"');
        print json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        exit;
    }

    private static function download_metadata($version) {
        $metadata_files = self::$m->getSystemSetting(REDCapTranslatorExternalModule::METADATAFILES_SETTING_NAME) ?? [];
        if (!array_key_exists($version, $metadata_files)) {
            return self::err_nometadata;
        }
        $info = $metadata_files[$version];
        $filename = "REDCap Strings Metadata - {$info["updated"]}.json";
        $content = self::$m->getSystemSetting(REDCapTranslatorExternalModule::METADATAFILE_STORAGE_SETTING_PREFIX.$version) ?? null;
        if (!$content) {
            return self::err_nometadata;
        }
        header('Content-Type: application/json; name="'.$filename.'"');
        header('Content-Disposition: attachment; filename="'.$filename.'"');
        print $content;
        exit;
        
    }
}
print Downloader::start($module);
