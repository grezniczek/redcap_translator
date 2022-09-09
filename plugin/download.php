<?php namespace RUB\REDCapTranslatorExternalModule;

class Downloader {

    /**
     * Downloads files
     * @param REDCapTranslatorExternalModule $m 
     * @return void 
     */
    public static function start($m) {
        $version = $_GET["version"];
        $mode = $_GET["mode"];
        if (!in_array($mode, ["strings", "zip"], true)) return;
        $stored = $m->getSystemSetting(REDCapTranslatorExternalModule::UPLOADS_SETTING_NAME) ?? [];
        if (!array_key_exists($version, $stored)) return;
        $edoc_id = $stored[$version];

        // Get metadata
        $sql = "SELECT * FROM redcap_edocs_metadata WHERE doc_id = ? AND ISNULL(project_id) AND (delete_date IS NULL OR (delete_date IS NOT NULL AND delete_date > '".NOW."'))";
        $result = $m->query($sql, [$edoc_id]);
        $file_info = db_fetch_assoc($result);

        if (!empty($file_info) && $file_info["doc_id"] == $edoc_id) {
            // Copy file
            $local_file = \Files::copyEdocToTemp($edoc_id);
            if ($mode == "zip") {
                header('Content-Type: '.$file_info['mime_type'].'; name="'.$file_info['doc_name'].'"');
                header('Content-Disposition: attachment; filename="'.$file_info['doc_name'].'"');
                readfile_chunked($local_file);
            }
            else if ($mode == "strings") {
                $ini_name = "English_v$version.ini";
                header('Content-Type: text/plain; name="'.$ini_name.'"');
                header('Content-Disposition: attachment; filename="'.$ini_name.'"');
                // Extract and merge languages
                print "TODO";
            }
            unlink($local_file);
        }
        else {
            print "Failed to locate file on server.";
        }
        exit;
    }
}
Downloader::start($module);
