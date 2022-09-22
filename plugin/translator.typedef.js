/* REDCap Translator EM - Type Definitions */

/**
 * @typedef REDCapTranslator
 * @type {{
 *  init?: function(Object):void
 * }}
 */

/**
 * @typedef REDCapTranslator_Config
 * @type {{
 *  debug: boolean
 *  jsmoName: string
 *  uploadUrl: string
 *  downloadUrl: string,
 *  csrfToken: string
 *  metadataFiles: object<string,MetadataFileData>
 *  packages: object<string,PackageData>
 *  translations: object<string, TranslationData>
 * }}
 */

/**
 * @typedef PackageData
 * @type {{
 *  version: string
 *  upgrade: boolean
 *  size: Number
 * }}
 */

/**
 * @typedef MetadataFileData
 * @type {{
 *  version: string
 *  updated: string
 *  strings: Number
 *  annotations: Number
 *  code: boolean
 * }}
 */

/**
 * @typedef TranslationData
 * @type {{
 *  name: string
 *  'localized-name': string
 *  iso: string
 *  coverage: string
 *  updated: string
 * }}
 */

/**
 * @typedef JavascriptModuleObject
 * @type {{
 *  afterRender: function(function)
 *  ajax: function(string, any):Promise<any>
 *  getUrlParameter: function(string):string
 *  getUrlParameters: function():object<string,string>
 *  log: function(string,object):Number
 *  tt: function(string, ...values):string
 *  tt_add: function(string, any):void
 * }}
 */


