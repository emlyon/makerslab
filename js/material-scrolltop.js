/**
 * Material-scrollTop
 *
 * Author: Bartholomej
 * Website: https://github.com/bartholomej/material-scrollTop
 * Docs: https://github.com/bartholomej/material-scrollTop
 * Repo: https://github.com/bartholomej/material-scrollTop
 * Issues: https://github.com/bartholomej/material-scrollTop/issues
 */
(function($) {
    function mScrollTop(element, settings) {

        var _ = this,
            breakpoint;
        var scrollTo = 0;

        _.btnClass = '.material-scrolltop';
        _.revealClass = 'reveal';
        _.btnElement = $(_.btnClass);
        _.footerElement = $('footer').first();
        _.baseOffset = 25;

        _.initial = {
            revealElement: 'body',
            revealPosition: 'top',
            padding: 0,
            duration: 600,
            easing: 'swing',
            onScrollEnd: false
        }

        _.options = $.extend({}, _.initial, settings);

        _.revealElement = $(_.options.revealElement);
        breakpoint = _.options.revealPosition !== 'bottom' ? _.revealElement.offset().top : _.revealElement.offset().top + _.revealElement.height();
        scrollTo = element.offsetTop + _.options.padding;

        _.updateButtonPosition = function() {
            var bottom = _.baseOffset;

            if (_.footerElement.length) {
                var footerTop = _.footerElement[0].getBoundingClientRect().top;
                var overlap = $(window).height() - footerTop;

                if (overlap > 0) {
                    bottom = overlap + _.baseOffset;
                }
            }

            _.btnElement.css('bottom', bottom + 'px');
        };

        $(document).scroll(function() {
            if (breakpoint < $(document).scrollTop()) {
                _.btnElement.addClass(_.revealClass);
            } else {
                _.btnElement.removeClass(_.revealClass);
            }

            _.updateButtonPosition();
        });

        $(window).on('resize orientationchange', _.updateButtonPosition);
        _.updateButtonPosition();

        _.btnElement.click(function() {
            var trigger = true;
            $('html, body').animate({
                scrollTop: scrollTo
            }, _.options.duration, _.options.easing, function() {
                if (trigger) { // Fix callback triggering twice on chromium
                    trigger = false;
                    var callback = _.options.onScrollEnd;
                    if (typeof callback === "function") {
                        callback();
                    }
                }
            });
            return false;
        });
    }

    $.fn.materialScrollTop = function() {
        var _ = this,
            opt = arguments[0],
            l = _.length,
            i = 0;
        if (typeof opt == 'object' || typeof opt == 'undefined') {
            _[i].materialScrollTop = new mScrollTop(_[i], opt);
        }
        return _;
    };
}(jQuery));
