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
 *  JSMO: JavascriptModuleObject
 *  uploadUrl: string
 *  csrfToken: string
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


