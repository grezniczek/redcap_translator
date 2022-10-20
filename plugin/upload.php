<?php namespace RUB\REDCapTranslatorExternalModule;

class REDCapTranslatorFileUploader {

    /** @var REDCapTranslatorExternalModule */
    private static $m = null;
    /**
     * Uploads a REDCap install or upgrade file
     * @param REDCapTranslatorExternalModule $m 
     * @return void 
     */
    public static function upload($m) {
        self::$m = $m;
        $mode = $_POST["mode"] ?? "";
        $file = $_FILES["file"] ?? [ "name" => "" ];
        switch ($mode) {
            case "package-zip":
                return self::uploadPackage($file);
            case "translation-json":
                return self::uploadTranslation($file);
            case "metadata-json":
                return self::uploadMetadataFile($file, $_POST["merge"]);
            case "ini-to-json":
                return self::convertIniToJson($file);
            case "mlm-to-json":
                return self::convertMlmToJson($file);
        }
        throw new \Exception("Invalid operation.");
    }

    /**
     * @param array $file 
     */
    private static function convertMlmToJson($file) {
        // Check file name
        $re = '/^.*\.[jJ][sS][oO][nN]$/m';
        if (!preg_match($re, $file["name"])) {
            return [
                "success" => false,
                "error" => "Invalid file name. It must have a JSON extension."
            ];
        }
        // Can it be parsed?
        $content = file_get_contents($file["tmp_name"]);
        $mlm = json_decode($content, true);
        if (!$mlm) {
            return [
                "success" => false,
                "error" => "Invalid JSON. The file could not be parsed."
            ];
        }
        if (!isset($mlm["key"]) || !isset($mlm["display"]) || !isset($mlm["uiTranslations"]) || !is_array($mlm["uiTranslations"])) {
            return [
                "success" => false,
                "error" => "This is not a valid MLM language file. Missing one or more of the required items 'display', 'key', and 'uiTranslations'."
            ];
        }
        $filter = function($in) {
            $out = [];
            foreach (mb_str_split($in) as $char) {
                if (preg_match('/[A-Za-z-_]/', $char)) {
                    $out[] = $char;
                }
            }
            return join("", $out);
        };
        $name = $filter($mlm["display"]);
        $json = [
            "name" => $name,
            "localized-name" => $mlm["display"],
            "iso" => mb_substr($mlm["key"], 0, 10),
            "timestamp" => $mlm["timestamp"] ?? self::$m->get_current_timestamp(),
            "maintained-by" => [
                [
                    "name" => "Name",
                    "email" => "Email",
                    "institution" => "Institution"
                ]
            ],
            "url" => "",
            "strings" => count($mlm["uiTranslations"]) ? [] : new \stdClass,
            "annotations" => new \stdClass
        ];
        foreach ($mlm["uiTranslations"] as $item) {
            if (isset($item["id"]) && !starts_with($item["id"], "_valtype_") && isset($item["translation"])) {
                $json["strings"][$item["id"]] = [
                    "key" => $item["id"],
                    "do-not-translate" => false,
                    "annotation" => "",
                    "translations" => [
                        ($item["hash"] ?? "") => $item["translation"]
                    ]
                ];
            }
        }
        return [
            "success" => true,
            "filename" => "$name.json",
            "json" => json_encode($json, JSON_PRETTY_PRINT)
        ];
    }

    /**
     * @param array $file 
     */
    private static function convertIniToJson($file) {
        // Check file name
        $re = '/^(?\'name\'.*)\.[iI][nN][iI]$/m';
        if (!preg_match($re, $file["name"], $matches)) {
            return [
                "success" => false,
                "error" => "Invalid file name. It must have an INI extension."
            ];
        }
        $filename = $matches["name"];
        // Can it be parsed?
        $ini = parse_ini_file($file["tmp_name"]);
        if (!$ini) {
            return [
                "success" => false,
                "error" => "Invalid INI. The file could not be parsed."
            ];
        }
        $json = [
            "name" => $filename,
            "localized-name" => $filename,
            "iso" => "",
            "timestamp" => self::$m->get_current_timestamp(),
            "maintained-by" => [
                [
                    "name" => "Name",
                    "email" => "Email",
                    "institution" => "Institution"
                ]
            ],
            "url" => "",
            "strings" => count($ini) ? [] : new \stdClass,
            "annotations" => new \stdClass
        ];
        foreach ($ini as $key => $text) {
            $json["strings"][$key] = [
                "key" => $key,
                "do-not-translate" => null,
                "annotation" => "",
                "translations" => [
                    "" => str_replace([
                            REDCapTranslatorExternalModule::CODE_START_ENCODING,
                            REDCapTranslatorExternalModule::CODE_ZERO_ENCODING,
                            REDCapTranslatorExternalModule::CODE_ONE_ENCODING,
                            REDCapTranslatorExternalModule::STRING_TERMINATOR
                        ], "", $text)
                ]
            ];
        }
        return [
            "success" => true,
            "filename" => "$filename.json",
            "json" => json_encode($json, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)
        ];
    }

    /**
     * @param array $file 
     */
    private static function uploadTranslation($file) {
        // Check file name
        $re = '/^.+\.[jJ][sS][oO][nN]$/m';
        if (!preg_match($re, $file["name"])) {
            return [
                "success" => false,
                "error" => "Invalid file name. It must have a JSON extension."
            ];
        }
        // Can it be parsed?
        $content = file_get_contents($file["tmp_name"]);
        $json = json_decode($content, JSON_OBJECT_AS_ARRAY);
        if (!$json) {
            $err = json_last_error_msg();
            return [
                "success" => false,
                "error" => "Invalid JSON. The file could not be parsed ($err)."
            ];
        }
        // Does it have the required keys?
        $name = $json["name"] ?? "";
        // TODO
        // Extract strings and annotations for separate storage
        $strings = $json["strings"] ?? null;
        $help_content = $json["help-content"] ?? [];
        $error = self::$m->validateCreateNewLang($json);
        if (!empty($error)) {
            return [
                "success" => false,
                "error" => "Invalid translation file. $error"
            ];
        }
        $json["filename"] = $file["name"];
        self::$m->store_translation($json, $strings, $help_content);
        $json["success"] = true;
        return $json;
    }

    private static function fail($msg) {
        return [
            "success" => false,
            "error" => $msg
        ];
    }

    private static function ok($data) {
        return [
            "success" => true,
            "data" => $data
        ];
    }

    /**
     * @param array $file 
     */
    private static function uploadMetadataFile($file, $merge) {
        // Check file name
        $re = '/^.+\.[jJ][sS][oO][nN]$/m';
        if (!preg_match($re, $file["name"])) {
            return self::fail("Invalid file name. It must have a JSON extension.");
        }
        // Check merge mode
        if (!in_array($merge, ["keep","overwrite"], true)) {
            return self::fail("Invalid merge mode.");
        }
        // Can it be parsed?
        $content = file_get_contents($file["tmp_name"]);
        $meta = json_decode($content, JSON_OBJECT_AS_ARRAY);
        if (!$meta) {
            $err = json_last_error_msg();
            return self::fail("Invalid JSON. The file could not be parsed ($err).");
        }
        // Check if this is a valid metadata file
        $version = $meta["version"] ?? "";
        if (!preg_match('/^\d+\.\d+\.\d+$/m', $version)) {
            return self::fail("Missing or invalid item 'version'.");
        }
        if (!self::$m->validate_and_sanitize_metadata($meta)) {
            return self::fail("This does not appear to be a valid metadata file.");
        }
        // Merge if this version is already present
        $previous = self::$m->get_metadata_file($version);
        if ($previous) {
            // TODO - Merge
        }
        // Store and send response
        $meta_info = self::$m->store_metadata_file($meta);
        return self::ok($meta_info);
    }

    /**
     * @param array $file 
     */
    private static function uploadPackage($file) {
        // Check file name
        $re = '/^redcap(?<version>\d+\.\d+\.\d+)(_upgrade){0,1}\.zip$/m';
        if (!preg_match($re, $file["name"], $matches)) {
            return [
                "success" => false,
                "error" => "Invalid file name. Must follow the 'redcapX.Y.Z[_upgrade].zip' pattern."
            ];
        }
        $version = $matches["version"];
        $stored = self::$m->getSystemSetting(REDCapTranslatorExternalModule::PACKAGES_SETTING_NAME) ?? [];
        if (array_key_exists($version, $stored)) {
            return [
                "success" => false,
                "error" => "This version has already been uploaded (full install or upgrade). To replace, first delete the existing version."
            ];
        }
        $zip = new \ZipArchive();
        if(($code = $zip->open($file["tmp_name"])) !== true) {
            return [
                "success" => false,
                "error" => "This appears to not be a valid ZIP archive ($code). Try downloading this file from its original source."
            ];
        }
        $zip->close();
        $doc_id = \Files::uploadFile($file, null);
        if (!$doc_id) {
            return [
                "success" => false,
                "error" => "Failed to store the uploaded file."
            ];
        }
        $stored[$version] = $doc_id;
        self::$m->setSystemSetting(REDCapTranslatorExternalModule::PACKAGES_SETTING_NAME, $stored);
        $name = \Files::getEdocName($doc_id);

        self::$m->log("Uploaded REDCap package '$name' ({$file["size"]} bytes) (doc_id = $doc_id).");

        return [
            "success" => true,
            "version" => $version,
            "upgrade" => strpos($name, "_upgrade") > 0,
            "size" => $file["size"] * 1,
        ];
    }
}
// Upload
try {
    print json_encode(REDCapTranslatorFileUploader::upload($module));
}
catch (\Throwable $t) {
    print json_encode(array(
        "success" => false,
        "error" => "An unexpected error occured: ".$t->getMessage()
    ));
}
