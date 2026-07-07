(function ($) {
  const normalizedPath =
    typeof window.stripAppBasePrefix === 'function' ? window.stripAppBasePrefix(location.pathname) : location.pathname;
  const split = normalizedPath.split('/');
  let href = split[split.length - 1];
  if (split.includes('dww') || split.includes('pwai') || split.includes('pwf')) href = 'courses.html';

  const toAppPath = (value) => (typeof window.appPath === 'function' ? window.appPath(value) : value);

  if (normalizedPath.includes('/fr/')) {
    if (document.querySelector(`.navbar-fixed li.lang-fr > a`))
      document.querySelector(`.navbar-fixed li.lang-fr > a`).classList.add('active');

    const frHref = toAppPath(`/fr/${href}`);
    if (document.querySelector(`.navbar-fixed li > a[href="${frHref}"]`))
      document.querySelector(`.navbar-fixed li:not([class*="lang"]) > a[href="${frHref}"]`).classList.add('active');
  } else {
    if (document.querySelector(`.navbar-fixed li.lang-en > a`))
      document.querySelector(`.navbar-fixed li.lang-en > a`).classList.add('active');

    const enHref = toAppPath(`/${href}`);
    if (document.querySelector(`.navbar-fixed li > a[href="${enHref}"]`))
      document.querySelector(`.navbar-fixed li:not([class*="lang"]) > a[href="${enHref}"]`).classList.add('active');
  }

  $(function () {
    $('.sidenav').sidenav();
    $('.parallax').parallax();
    $('.collapsible').collapsible();
    $('.modal').modal();
    $('#noticeModal').modal('open');

    $('#index-banner').on('click', 'a[data-to]:not(.link)', function (e) {
      const target = document.querySelector(this.dataset.to || '');
      if (!target) {
        return;
      }

      e.preventDefault();
      $(window).scrollTo($(target), 500, { offset: -150 });
    });
  }); // end of document ready
})(jQuery); // end of jQuery name space
