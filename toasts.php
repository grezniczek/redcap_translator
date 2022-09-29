<?php

?>
<!-- Success toast -->
<div class="position-fixed bottom-0 right-0 p-3" style="z-index: 99999; right: 0; bottom: 0;">
    <div id="translator-successToast" class="toast hide" role="alert" aria-live="assertive" aria-atomic="true" data-delay="2000" data-animation="true" data-autohide="true">
        <div class="toast-header">
            <svg class="bd-placeholder-img rounded mr-2" width="20" height="20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" preserveAspectRatio="xMidYMid slice" focusable="false">
                <rect width="100%" height="100%" fill="#28a745"></rect>
            </svg>
            <strong class="mr-auto">Success</strong>
            <button type="button" class="ml-2 mb-1 close" data-dismiss="toast" aria-label="Close">
                <span aria-hidden="true">&times;</span>
            </button>
        </div>
        <div class="toast-body" data-content="toast"></div>
    </div>
</div>
<!-- Error toast -->
<div class="position-fixed bottom-0 right-0 p-3" style="z-index: 99999; right: 0; bottom: 0;">
    <div id="translator-errorToast" class="toast hide" role="alert" aria-live="assertive" aria-atomic="true" data-delay="2000" data-animation="true" data-autohide="false">
        <div class="toast-header">
            <svg class="bd-placeholder-img rounded mr-2" width="20" height="20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" preserveAspectRatio="xMidYMid slice" focusable="false">
                <rect width="100%" height="100%" fill="#dc3545"></rect>
            </svg>
            <strong class="mr-auto">ERROR</strong>
            <button type="button" class="ml-2 mb-1 close" data-dismiss="toast" aria-label="Close">
                <span aria-hidden="true">&times;</span>
            </button>
        </div>
        <div class="toast-body" data-content="toast"></div>
    </div>
</div>
