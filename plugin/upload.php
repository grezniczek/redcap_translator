<?php namespace RUB\REDCapTranslatorExternalModule;

class REDCapTranslatorFileUploader {

    /**
     * Uploads a REDCap install or upgrade file
     * @param REDCapTranslatorExternalModule $m 
     * @return void 
     */
    public static function upload($m) {
        $mode = $_POST["mode"] ?? "";
        $file = $_FILES["file"] ?? [ "name" => "" ];
        switch ($mode) {
            case "package-zip":
                return self::uploadPackage($file, $m);
            case "translation-json":
                return self::uploadTranslation($file, $m);
            case "metadata-json":
                return self::uploadMetadataFile($file, $_POST["merge"], $m);
            case "ini-to-json":
                return self::convertIniToJson($file, $m);
            case "mlm-to-json":
                return self::convertMlmToJson($file, $m);
        }
        throw new \Exception("Invalid operation.");
    }

    /**
     * @param array $file 
     * @param REDCapTranslatorExternalModule $m 
     */
    private static function convertMlmToJson($file, $m) {
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
            "timestamp" => $mlm["timestamp"] ?? $m->get_current_timestamp(),
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
                    "do-not-translate" => false,
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
     * @param REDCapTranslatorExternalModule $m 
     */
    private static function convertIniToJson($file, $m) {
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
            "timestamp" => $m->get_current_timestamp(),
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
            $json["strings"][$key] = $text;
        }
        return [
            "success" => true,
            "filename" => "$filename.json",
            "json" => json_encode($json, JSON_PRETTY_PRINT)
        ];
    }

    /**
     * @param array $file 
     * @param REDCapTranslatorExternalModule $m 
     */
    private static function uploadTranslation($file, $m) {
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
        // Extract strings and annotations for separate storage
        $strings = $json["strings"] ?? null;
        $annotations = $json["annotations"] ?? [];
        $error = $m->validateCreateNewLang($json);
        if (!empty($error)) {
            return [
                "success" => false,
                "error" => "Invalid translation file. $error"
            ];
        }
        // Purge all parts that should not be stored
        $json = $m->sanitize_translation($json);
        // Store the file, in parts
        $stored = $m->getSystemSetting(REDCapTranslatorExternalModule::TRANSLATIONS_SETTING_NAME) ?? [];
        // Created or updated?
        $verb = isset($stored[$name]) ? "Updated" : "Created";
        // Update storage
        $json["coverage"] = "TBD";
        if (!isset($json["iso"])) $json["iso"] = "";
        if (!isset($json["timestamp"])) $json["timestamp"] = "(???)";
        $json["filename"] = $file["name"];
        $stored[$name] = $json;
        $m->setSystemSetting(REDCapTranslatorExternalModule::TRANSLATIONS_SETTING_NAME, $stored);
        $m->setSystemSetting(REDCapTranslatorExternalModule::TRANSLATIONS_SETTING_STRINGS_PREFIX.$name, $strings);
        $m->setSystemSetting(REDCapTranslatorExternalModule::TRANSLATIONS_SETTING_ANNOTATION_PREFIX.$name, $annotations);
        $m->log("$verb translation file '{$name}' ({$file["name"]}).");
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
     * @param REDCapTranslatorExternalModule $m 
     */
    private static function uploadMetadataFile($file, $merge, $m) {
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
        if (!$m->validate_and_sanitize_metadata($meta)) {
            return self::fail("This does not appear to be a valid metadata file.");
        }
        // Merge if this version is already present
        $previous = $m->get_metadata_file($version);
        if ($previous) {
            // TODO - Merge
        }
        // Store and send response
        $meta_info = $m->store_metadata_file($meta);
        return self::ok($meta_info);
    }

    /**
     * @param array $file 
     * @param REDCapTranslatorExternalModule $m 
     */
    private static function uploadPackage($file, $m) {
        // Check file name
        $re = '/^redcap(?<version>\d+\.\d+\.\d+)(_upgrade){0,1}\.zip$/m';
        if (!preg_match($re, $file["name"], $matches)) {
            return [
                "success" => false,
                "error" => "Invalid file name. Must follow the 'redcapX.Y.Z[_upgrade].zip' pattern."
            ];
        }
        $version = $matches["version"];
        $stored = $m->getSystemSetting(REDCapTranslatorExternalModule::PACKAGES_SETTING_NAME) ?? [];
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
        $m->setSystemSetting(REDCapTranslatorExternalModule::PACKAGES_SETTING_NAME, $stored);
        $name = \Files::getEdocName($doc_id);

        $m->log("Uploaded REDCap package '$name' ({$file["size"]} bytes) (doc_id = $doc_id).");

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
