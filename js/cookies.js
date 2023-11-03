window.gdprAppliesGlobally = !0;
(function () {
  function l(a) {
    if (!window.frames[a])
      if (document.body && document.body.firstChild) {
        var b = document.body,
          d = document.createElement('iframe');
        d.style.display = 'none';
        d.name = a;
        d.title = a;
        b.insertBefore(d, b.firstChild);
      } else
        setTimeout(function () {
          l(a);
        }, 5);
  }
  function q(a, b, d, r, m) {
    function n(c, g, e, f) {
      if ('function' === typeof e) {
        window[b] || (window[b] = []);
        var h = !1;
        m && (h = m(c, g, e));
        h || window[b].push({ command: c, parameter: g, callback: e, version: f });
      }
    }
    function p(c) {
      if (window[a] && !0 === window[a].stub && c.data) {
        var g = 'string' === typeof c.data;
        try {
          var e = g ? JSON.parse(c.data) : c.data;
        } catch (h) {
          return;
        }
        if (e[d]) {
          var f = e[d];
          window[a](
            f.command,
            f.parameter,
            function (h, t) {
              var k = {};
              k[r] = { returnValue: h, success: t, callId: f.callId };
              c.source.postMessage(g ? JSON.stringify(k) : k, '*');
            },
            f.version
          );
        }
      }
    }
    n.stub = !0;
    'function' !== typeof window[a] &&
      ((window[a] = n),
      window.addEventListener ? window.addEventListener('message', p, !1) : window.attachEvent('onmessage', p));
  }
  q('__tcfapi', '__tcfapiBuffer', '__tcfapiCall', '__tcfapiReturn');
  l('__tcfapiLocator');
  (function (a) {
    var b = document.createElement('script');
    b.id = 'spcloader';
    b.type = 'text/javascript';
    b.async = !0;
    b.src = 'https://sdk.privacy-center.org/' + a + '/loader.js?target\x3d' + document.location.hostname;
    b.charset = 'utf-8';
    a = document.getElementsByTagName('script')[0];
    a.parentNode.insertBefore(b, a);
  })('bd59e68f-f9d4-46ea-926b-64f7924e137d');
})();
