/**
 * @typedef REDCapInScreenTranslator
 * @type {{
 *  init: function(Object):void
 *  translate: function():void
 * }}
 */

/**
 * @typedef REDCapInScreenTranslator_Config
 * @type {{
 *  debug: boolean
 *  jsmoName: string
 *  name: string
 *  basedOn: string
 *  codeStart: string
 *  stringTerminator: string
 *  code0: string
 *  code1: string
 *  metadata: Object
 *  translation: Object
 *  keys: string[]
 *  dialogPosition: DialogPosition
 * }}
 */

/**
 * @typedef DialogPosition
 * @type {{
 *  sizeUpdated: boolean
 *  positionUpdated: boolean
 *  left: Number
 *  top: Number
 *  width: Number
 *  height: Number
 * }}
 */

/**
 * @typedef InvisiCode
 * @type {{
 *  binary: string
 *  int: Number
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
