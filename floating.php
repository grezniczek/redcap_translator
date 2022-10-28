<div id="in-screen-translation-editor" style="display:none;" data-translation-widget="in-screen-editor">
    <div class="in-screen-translation-container">
        <div class="in-screen-top">
            <div class="form-inline">
                <select data-translator-item="current-key" id="translator-current-key" class="form-control mr-2"></select>
                <button data-action="filter-items" class="btn btn-light btn-xs ml-2"><i class="fas fa-filter"></i> Filter items</button>
                <button data-action="clear-filter" class="btn btn-xs btn-light ml-1"><i class="fas fa-times"></i></button>
            </div>
            <div class="form-inline">
                <button data-action="save-changes" class="btn btn-xs btn-light"><i class="fas fa-save"></i> Save Changes</button>
            </div>
        </div>
        <div data-inscreen-visibility="no-item-selected" class="in-screen-no-item">
            <p>
                Please select an item to start translating!
            </p>
        </div>
        <div data-inscreen-visibility="item-selected" class="in-screen-translation-items">
            <!-- Translation -->
            <div class="in-screen-translation-title">
                <div class="flex-h-left">
                    <h2>Translation</h2>
                    <a href="#" data-action="copy-translation" class="copy-button"><i class="far fa-copy"></i></a>
                </div>
                <div style="display:inline-block" class="custom-control custom-switch">
                    <input type="checkbox" class="custom-control-input" id="show-original" data-inscreen-toggle="show-original">
                    <label class="custom-control-label" style="padding-top: 2px;" for="show-original">Show original</label>
                </div>
            </div>
            <textarea class="form-control textarea-autosize" data-inscreen-content="translation" rows="2" placeholder="Enter translation"></textarea>
            <div class="form-check ml-1">
                <input data-inscreen-content="do-not-translate" class="form-check-input" type="checkbox" value="" id="check-do-not-translate">
                <label class="form-check-label" style="margin-top:2px;" for="check-do-not-translate">
                    Marked as <small><b><i>DO NOT TRANSLATE</i></b></small>
                </label>
            </div>
            <div class="v-spacer"></div>
            <!-- Original -->
            <div class="flex-h-left">
                <h2>Original</h2>
                <a href="#" data-action="copy-metadata-text" class="copy-button"><i class="far fa-copy"></i></a>
            </div>
            <div data-inscreen-content="metadata-text" class="original-text"></div>
            <div class="v-spacer"></div>
            <!-- Annotation -->
            <div class="flex-h-left">
                <h3>Annotation</h3>
                <a href="#" data-action="copy-translation-annotation" class="copy-button"><i class="far fa-copy"></i></a>
            </div>
            <textarea class="form-control textarea-autosize" data-inscreen-content="translation-annotation" rows="1" placeholder="Enter an annotation (optional)"></textarea>
        </div>
        <div data-inscreen-visibility="item-selected" class="in-screen-metadata-items">
            <h2>Metadata</h2>
            <!-- Info badges -->
            <div class="in-screen-metadata-badges">
                <span data-inscreen-badge="untranslated" class="badge badge-danger">UNTRANSLATED</span>
                <span data-inscreen-badge="outdated" class="badge badge-warning">OUTDATED</span>
                <span data-inscreen-badge="new" class="badge badge-info">NEW</span>
                <span data-inscreen-badge="changed" class="badge badge-warning">CHANGED</span>
                <span data-inscreen-badge="interpolated" class="badge badge-dark">{ INTERPOLATED }</span>
            </div>
            <div class="v-spacer"></div>
            <!-- HTML support -->
            <div class="flex-h-left">
                <h3>HTML Support</h3>
                <div data-inscreen-visibility="html-support">
                    &nbsp;&mdash;<a href="#" data-action="reset-html-support" class="copy-button"><i class="fas fa-times"></i> Reset</a>
                </div>
            </div>
            <div class="in-screen-metadata-badges">
                <div class="form-check form-check-inline">
                    <input data-inscreen-content="html-supported" class="form-check-input" type="radio" name="html-support" id="html-support-1" value="1">
                    <label class="form-check-label" for="html-support-1">Yes</label>
                </div>
                <div class="form-check form-check-inline">
                    <input data-inscreen-content="html-not-supported" class="form-check-input" type="radio" name="html-support" id="html-support-0" value="0">
                    <label class="form-check-label" for="html-support-0">Plain text only</label>
                </div>
            </div>
            <div class="v-spacer"></div>
            <!-- Length restriction -->
            <div class="flex-h-left">
                <h3>Length Restriction</h3>
                <div data-inscreen-visibility="length-restriction">
                    &nbsp;&mdash;<a href="#" data-action="reset-length-restricted" class="copy-button"><i class="fas fa-times"></i> Reset</a>
                </div>
            </div>
            <div class="in-screen-metadata-badges">
                <div class="form-check form-check-inline">
                    <input data-inscreen-content="length-restricted-no" class="form-check-input" type="radio" name="length-restricted" id="length-restricted-0" value="0">
                    <label class="form-check-label" for="length-restricted-0">No</label>
                </div>
                <div class="form-check form-check-inline">
                    <input data-inscreen-content="length-restricted-yes" class="form-check-input" type="radio" name="length-restricted" id="length-restricted-1" value="1">
                    <label class="form-check-label" for="length-restricted-1">Yes</label>
                </div>
                <div data-inscreen-visibility="length-restricted">
                    <input style="max-width:70px;" type="number" min="0" class="form-control form-control-sm" data-inscreen-content="length-restricted-px">
                </div>
                <div data-inscreen-visibility="length-restricted">
                    px
                </div>
            </div>
            <!-- Interpolations -->
            <div data-inscreen-visibility="interpolated">
                <div class="v-spacer"></div>
                <div class="flex-h-left">
                    <h3>Interpolations</h3>
                </div>
                <div data-inscreen-container="interpolations" class="in-screen-metadata-badges">
                </div>
                <template data-template="interpolation-hint">
                    <div class="form-inline">
                        <div class="form-group">
                            <label for=""></label>
                            <textarea data-inscreen-content="interpolation-hint" data-inscreen-index="" class="form-control ml-2 textarea-autosize" rows="1" id=""></textarea>
                        </div>
                    </div>
                </template>
            </div>
            <div class="v-spacer"></div>
            <!-- Annotation -->
            <div class="flex-h-left">
                <h3>Annotation</h3>
                <a href="#" data-action="copy-metadata-annotation" class="copy-button"><i class="far fa-copy"></i></a>
            </div>
            <textarea class="form-control textarea-autosize" data-inscreen-content="metadata-annotation" rows="1" placeholder="Enter an annotation (optional)"></textarea>
            <div class="form-check ml-1">
                <input data-inscreen-content="metadata-split" class="form-check-input" type="checkbox" value="" id="check-metadata-split">
                <label class="form-check-label" style="margin-top:2px;" for="check-metadata-split">
                    Split string <small>(please note part ids in <i>Annotation</i>)</small>
                </label>
            </div>
            <div class="form-check ml-1">
                <input data-inscreen-content="metadata-do-not-translate" class="form-check-input" type="checkbox" value="" id="check-metadata-do-not-translate">
                <label class="form-check-label" style="margin-top:2px;" for="check-metadata-do-not-translate">
                    This item should <b class="small">NOT</b> be translated
                </label>
            </div>
        </div>
        <div class="in-screen-footer">
            <div class="form-inline">
                <button data-action="refresh-translation" class="btn btn-primaryrc btn-xs"><i class="fas fa-redo-alt"></i> Refresh translation</button>
                <div class="custom-control custom-switch ml-2">
                    <input type="checkbox" class="custom-control-input" id="highlight-translation-status" data-inscreen-toggle="highlight-translation-status">
                    <label class="custom-control-label" style="padding-top: 2px;" for="highlight-translation-status">Show translation status</label>
                </div>
                <div class="custom-control custom-switch ml-2">
                    <input type="checkbox" class="custom-control-input" id="highlight-current" data-inscreen-toggle="highlight-current" checked>
                    <label class="custom-control-label" style="padding-top: 2px;" for="highlight-current">Highlight selected</label>
                </div>
            </div>
        </div>
    </div>
</div>
<!-- Items Selector Popup -->
<div id="in-screen-items-selector-popup">

</div>
