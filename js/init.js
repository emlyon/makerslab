(function($) {
    const split = location.href.split('/');
    let href = split[split.length - 1];
    if (split.includes('dww') || split.includes('pwai') || split.includes('pwf')) href = 'courses.html'
    document.querySelector(`.navbar-fixed li>a[href="/${href}"]`).classList.add('active');
    $(function() {
        $('.button-collapse').sideNav();
        $('.parallax').parallax();
        $('.collapsible').collapsible();

        [].forEach.call(document.querySelectorAll('#index-banner a'), a => {
            a.addEventListener('click', e => {
                e.preventDefault();
                // console.log(a.dataset.to);
                $(window).scrollTo($(a.dataset.to), 500, { offset: -150 });
            });
        });
    }); // end of document ready
})(jQuery); // end of jQuery name space
