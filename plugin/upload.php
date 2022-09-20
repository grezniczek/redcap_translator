<?php namespace RUB\REDCapTranslatorExternalModule;

class REDCapTranslatorFileUploader {

    /**
     * Uploads a REDCap install or upgrade file
     * @param REDCapTranslatorExternalModule $m 
     * @return void 
     */
    public static function upload($m) {
        $mode = $_POST["mode"] ?? "";
        if (!in_array($mode, ["package-zip", "language-json"], true)) {
            throw new \Exception("Invalid operation.");
        }
        $file = $_FILES["file"] ?? [ "name" => "" ];
        if ($mode == "package-zip") {
            return self::uploadPackage($file, $m);
        }
        else if ($mode == "language-json") {
            return self::uploadLanguage($file, $m);
        }
    }

    /**
     * @param array $file 
     * @param REDCapTranslatorExternalModule $m 
     */
    private static function uploadLanguage($file, $m) {
        // Check file name
        $re = '/\.[jJ][sS][oO][nN]$/m';
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
        $localized_name = $json["localized-name"] ?? "";
        $iso = $json["iso"] ?? "";
        // Extract strings and annotations for separate storage
        $strings = $json["strings"] ?? null;
        $annotations = $json["annotations"] ?? [];
        if (empty($name)) {
            return [
                "success" => false,
                "error" => "Invalid language file. Missing required entry 'name'."
            ];
        }
        $re = '/^[A-Za-z_-]+$/m';
        if (!preg_match($re, $name)) {
            return [
                "success" => false,
                "error" => "Invalid language name. It must consist of letters, hyphen, and underscore only."
            ];
        }
        if (mb_strlen($name) > 100) {
            return [
                "success" => false,
                "error" => "Invalid language file. Value of 'name' exceeds maximum length of 100 characters."
            ];
        }
        if (empty($localized_name)) {
            return [
                "success" => false,
                "error" => "Invalid language file. Missing required entry 'localized-name'."
            ];
        }
        if (mb_strlen($localized_name) > 100) {
            return [
                "success" => false,
                "error" => "Invalid language file. Value of 'localized-name' exceeds maximum length of 100 characters."
            ];
        }
        if (!is_array($strings)) {
            return [
                "success" => false,
                "error" => "Invalid language file. Missing or invalid required entry 'strings'."
            ];
        }
        if (mb_strlen($iso) > 10) {
            return [
                "success" => false,
                "error" => "Invalid language file. Value of 'iso' exceeds maximum length of 10 characters."
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
    print json_encode(REDCapTranslatorFileUploader::upload($module), JSON_FORCE_OBJECT);
}
catch (\Throwable $t) {
    print json_encode(array(
        "success" => false,
        "error" => "An unexpected error occured: ".$t->getMessage()
    ), JSON_FORCE_OBJECT);
}
