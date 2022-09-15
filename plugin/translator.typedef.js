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
 *  packages: object<string,PackageData>
 *  languages: object<string, LanguageData>
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
 * @typedef LanguageData
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


