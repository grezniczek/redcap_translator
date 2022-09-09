<?php namespace RUB\REDCapTranslatorExternalModule;

class REDCapZipUploader {

    /**
     * Uploads a REDCap install or upgrade file
     * @param REDCapTranslatorExternalModule $m 
     * @return void 
     */
    public static function upload($m) {
        $re = '/^redcap(?<version>\d+\.\d+\.\d+)(_upgrade){0,1}\.zip$/m';
        $file = $_FILES["redcap_zip"] ?? "";
        if (!preg_match($re, $file["name"], $matches)) {
            return [
                "success" => false,
                "error" => "Invalid file name. Must follow the 'redcapX.Y.Z[_upgrade].zip' pattern."
            ];
        }
        $version = $matches["version"];
        $stored = $m->getSystemSetting(REDCapTranslatorExternalModule::UPLOADS_SETTING_NAME) ?? [];
        if (array_key_exists($version, $stored)) {
            return [
                "success" => false,
                "error" => "This version has already been uploaded (full install or upgrade). To replace, first delete the existing version."
            ];
        }
        $edoc_id = \Files::uploadFile($file, null);
        if (!$edoc_id) {
            return [
                "success" => false,
                "error" => "Failed to store the uploaded file."
            ];
        }
        $stored[$version] = $edoc_id;
        $m->setSystemSetting(REDCapTranslatorExternalModule::UPLOADS_SETTING_NAME, $stored);
        $name = \Files::getEdocName($edoc_id);

        $m->log("Uploaded REDCap package '$name' ({$file["size"]} bytes) into edoc id $edoc_id.");

        return [
            "success" => true,
            "version" => $version,
            "upgrade" => strpos($name, "_upgrade") > 0,
            "size" => $file["size"] * 1,
        ];
    }
}
print json_encode(REDCapZipUploader::upload($module), JSON_FORCE_OBJECT);
