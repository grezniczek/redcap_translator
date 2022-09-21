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
            case "language-json":
                return self::uploadLanguage($file, $m);
            case "ini-to-json":
                return self::convertIniToJson($file, $m);
        }
        throw new \Exception("Invalid operation.");
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
            "timestamp" => date("Y-m-d H:i:s"),
            "maintained-by" => [
                [
                    "name" => "Enter your name",
                    "email" => "Enter your email",
                    "institution" => "Enter your institution"
                ]
            ],
            "url" => "Enter the url to a location where this file can be obtained from",
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
    private static function uploadLanguage($file, $m) {
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
        $error = REDCapTranslatorExternalModule::validateCreateNewLang($json);
        if (!empty($error)) {
            return [
                "success" => false,
                "error" => "Invalid language file. $error"
            ];
        }
        // Purge all parts that should not be stored
        $json = REDCapTranslatorExternalModule::sanitize_language($json);
        // Store the file, in parts
        $stored = $m->getSystemSetting(REDCapTranslatorExternalModule::LANGUAGES_SETTING_NAME) ?? [];
        // Created or updated?
        $verb = isset($stored[$name]) ? "Updated" : "Created";
        // Update storage
        $json["coverage"] = "TBD";
        if (!isset($json["iso"])) $json["iso"] = "";
        if (!isset($json["timestamp"])) $json["timestamp"] = "(???)";
        $json["filename"] = $file["name"];
        $stored[$name] = $json;
        $m->setSystemSetting(REDCapTranslatorExternalModule::LANGUAGES_SETTING_NAME, $stored);
        $m->setSystemSetting(REDCapTranslatorExternalModule::LANGUAGES_SETTING_STRINGS_PREFIX.$name, $strings);
        $m->setSystemSetting(REDCapTranslatorExternalModule::LANGUAGES_SETTING_ANNOTATION_PREFIX.$name, $annotations);
        $m->log("$verb language file '{$name}' ({$file["name"]}).");
        $json["success"] = true;
        return $json;
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
