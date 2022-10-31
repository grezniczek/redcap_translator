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
 *  codeLens: boolean
 *  auth: boolean
 *  jsmoName: string
 *  name: string
 *  basedOn: string
 *  codeStart: string
 *  stringTerminator: string
 *  code0: string
 *  code1: string
 *  codeRegex: RegExp
 *  stringRegex: RegExp
 *  metadata: Metadata
 *  translation: Translation
 *  keys: string[]
 *  dialogPosition: DialogPosition
 * }}
 */



/**
 * @typedef Metadata
 * @type {{
 *  'based-on': string
 *  generator: Generator
 *  version: string
 *  'missing-strings': string[]
 *  'new-strings': string[]
 *  'removed-strings': string[]
 *  'unused-strings': string[]
 *  stats: Stats
 *  strings: Object<string,StringMetadata>
 *  timestamp: string
 * }}
 */

/**
 * @typedef StringMetadata
 * @type {{
 *  key: string
 *  text: string
 *  hash: string
 *  html: boolean|null
 *  'length-restricted': boolean|null
 *  changed: boolean
 *  new: boolean
 *  translate: boolean
 *  interpolated: Number
 *  'interpolation-hints': InterpolationData[]
 *  annotation: string
 *  split: boolean
 * }}
 */

/**
 * @typedef InterpolationData
 * @type {{
 *  id: string
 *  hint: string
 * }}
 */

/**
 * @typedef TranslatedString
 * @type {{
 *  text: string
 *  isMatch: boolean
 * }}
 */

/**
 * @typedef DialogData
 * @type {{
 *  translationText: string
 *  translationDoNotTranslate: boolean
 *  translationAnnotation: string
 *  metadataHTMLSupport: boolean|null
 *  metadataLengthRestricted: boolean|null
 * metadataLengthRestrictedPx: string
 * metadataAnnotation: string
 * metadataSplit: boolean
 * metadataDoNotTranslate: boolean
 * metadataInterpolationHints: InterpolationData[]
 * }}
 */




/**
 * @typedef Generator
 * @type {{
 *  name: string
 *  version: string
 *  author: string
 *  url: string
 * }}
 */

/**
 * @typedef Stats
 * @type {{
 *  'n-strings': Number
 *  'n-new-strings': Number
 *  'n-missing-strings': Number
 *  'n-removed-strings': Number
 *  'n-unused-strings': Number
 * }}
 */

/**
 * @typedef Translation
 * @type {{
 *  name: string
 *  'localized-name': string
 *  iso: string 
 *  'maintained-by': Maintainer[]
 *  timestamp: string
 *  filename: string
 *  url: string
 *  strings: Object<string, StringTranslation>
 *  'help-content': Object
 * }}
 */

/**
 * @typedef StringTranslation
 * @type {{
 *  key: string
 *  'do-not-translate': boolean|null
 *  annotation: string
 *  translations: Object<string,string>
 * }}
 */

/**
 * @typedef Maintainer
 * @type {{
 *  name: string
 *  institution: string
 *  email: string 
 * }}
 */

/**
 * @typedef TranslationState
 * @type {{
 *  translate: boolean
 *  outdated: boolean
 *  'do-not-translate': boolean
 *  translated: boolean
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
