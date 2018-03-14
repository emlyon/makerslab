(function($){
  $(function(){

    $('.parallax').parallax();

    [].forEach.call( document.querySelectorAll('#index-banner a'), a => {
        a.addEventListener( 'click', e => {
            e.preventDefault();
            // console.log( a.dataset.to );
            $( window ).scrollTo( $( a.dataset.to ), 500, { offset: -150 }  );
        } )
    } )

    $('.button-collapse').sideNav();
  }); // end of document ready
})(jQuery); // end of jQuery name space
