<div id="in-screen-translation-editor" style="display:none;" data-translation-widget="in-screen-editor">
    <div class="in-screen-top">
        <div class="form-inline">
            <label class="mr-2" for="current-translation-file"><i class="fas fa-exchange-alt"></i></label>
            <select data-translator-item="current-key" id="translator-current-key" class="form-control mr-2"></select>
            <button data-action="filter-items" class="btn btn-light btn-xs ml-2"><i class="fa-solid fa-filter"></i> Filter items</button>
            <button data-action="clear-filter" class="btn btn-xs btn-light ml-1"><i class="fa-solid fa-filter-circle-xmark"></i></button>
        </div>
        <div class="form-inline">
            <button data-action="save-changes" class="btn btn-xs btn-light"><i class="fa-solid fa-floppy-disk"></i> Save Changes</button>
        </div>
    </div>
    <div class="in-screen-body">
        <div class="custom-control custom-switch">
            <input type="checkbox" class="custom-control-input" id="show-original" data-inscreen-toggle="show-original">
            <label class="custom-control-label" style="padding-top: 2px;" for="show-original">Show original</label>
        </div>
        <p>Some Text</p>

    </div>




    <div class="in-screen-footer">
        <div class="form-inline">
            <button data-action="refresh-translation" class="btn btn-primaryrc btn-xs"><i class="fa-solid fa-arrow-rotate-right"></i> Refresh translation</button>
            <div class="custom-control custom-switch ml-2">
                <input type="checkbox" class="custom-control-input" id="highlight-translation-status" data-inscreen-toggle="highlight-translation-status">
                <label class="custom-control-label" style="padding-top: 2px;" for="highlight-translation-status">Show translation status</label>
            </div>
            <div class="custom-control custom-switch ml-2">
                <input type="checkbox" class="custom-control-input" id="highlight-current" data-inscreen-toggle="highlight-current">
                <label class="custom-control-label" style="padding-top: 2px;" for="highlight-current">Highlight selected</label>
            </div>
        </div>
    </div>
</div>
<!-- Items Selector Popup -->
<div id="in-screen-items-selector-popup">

</div>
