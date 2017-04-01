var czrapp = czrapp || {};

/************************************************
* USER EXPERIENCE SUB CLASS
*************************************************/
(function($, czrapp) {
  var _methods =  {
        /*  Sidebar stick and collapse
        /* ------------------------------------ */
        //What does sidebarLife ?
        //Its job is to listen to both user actions and czrapp events and react :
        //1) toggle sidebar expansion/collapse on user click, on resize
        //2) make sidebars stick on scroll on user scroll
        //3) translate vertically when czrapp sticky menu (desktop or mobile) gets animated
        //
        //For performance reasons, the scroll event is bound with a minimal and throttled ( 10 ms ) function that does extremely simple maths.
        //=> the scroll action modifies each sidebar stickyness state independently ( @see _setStickyness method ). Then this state is listened to in each sb instance.
        //Each sb is an observable instance, holding various observable state values.
        //
        //A sidebar instance can take two states : expanded or collapsed : czrapp.sidebars('s1')() = 'collapsed' or 'expanded'
        //Each sidebar instance holds a stickyness state that can take 3 values :
        // 'top' ( before main wrapper), => the sidebar scroll like the page
        // 'between' ( after main wrapper but before the bottom break point, this is when the sidebar position is 'fixed'), => the sidebar is fixed
        // 'bottom' ( after bottom break point ) => the sidebar scroll again like the page
        //
        //Each sidebar is instantiated with a set of properties written as 'data-...' selectors
        //
        //Due to the specificity of the Hueman theme sidebars, which are expandable and candidates to various positionning option ( like content right + 2 sidebars left ), the fixed left positionning is a bit complex to calculate and is highly tied to the CSS part
        //=> @see how the negative margin are defined in particular.
        //
        //Browser Hack : transitionning to a fixed position is not well handled by ios devices @see => https://stanko.github.io/ios-safari-scoll-position-fixed/ */
        //That's why we add the translateZ(0px) dynamically in js and statically in the css
        sidebarLife : function() {
              var self = this;
              self.sidebars = new czrapp.Values();
              self.sidebars.stickyness = new czrapp.Value( {} );

              //@param state = { s1 : state, s2 : state }
              //Listen to the global stickyness state to set the oveflow of the main content.
              //=> the goal here is to avoid the sidebar content being displayed outside of the main wrapper container when scrolled after top and expanded
              //=> the overflow must be reset in all other case, if not it will hide the social tooltips on tops when hovering the social links
              //Each sb stickyness can take the following state : 'top', 'bottom', 'between'
              self.sidebars.stickyness.bind( function( state ) {
                    var _isAfterTop = true;
                    self.sidebars.each( function( _sb_ ) {
                        _isAfterTop = 'top' != _sb_.stickyness() && _isAfterTop;
                    });
                    czrapp.$_mainWrapper.css({ overflow : _isAfterTop ? 'hidden' : '' });
              });

              //DOM aware sidebar instantiation
              $( '.s1, .s2', '#wrapper .main' ).each( function( index ) {
                    if ( 1 != $(this).length )
                      return;

                    var $container = $(this),
                        _id = $container.attr( 'data-sb-id'),
                        _position = $container.attr( 'data-position'),
                        _userLayout = $container.attr( 'data-layout'),
                        ctor;

                    if ( ! _.isString( _position ) || ! _.isString( _userLayout ) || ! _.isString( _id ) ) {
                          throw new Error( 'Missing id, position or layout for sidebar ' + _id );
                    }

                    ctor = czrapp.Value.extend( self.SidebarCTOR );

                    //do instantiate
                    self.sidebars.add( _id, new ctor( _id, {
                          container : $container,
                          position : _position,//can take left, middle-left, middle-right, right
                          layout : _userLayout,//can take : col-2cr, co-2cl, col-3cr, col-3cm, col-3cl
                          extended_width : 's1' == _id ? 340 : 260//<= hard coded in the base CSS, could be made dynamic in the future
                    }));
              });//$( '.s1, .s2', '#wrapper' ).each()

              //HEADER STICKY MENU REACT
              //Listen to sticky menu => translate the sb vertically
              //=> we listen to animating instead of stickyMenuDown which returns a promise when animation is done, with a 350ms delay
              czrapp.ready.then( function() {
                    czrapp.userXP.stickyHeaderAnimating.bind( function( animating ) {
                          self.sidebars.each( function( _sb_ ) {
                                _sb_._translateSbContent( czrapp.userXP.stickyMenuDown() );
                          });
                    });
              });

        },


        SidebarCTOR : {
              //constructor params :
              //{
              // container : $container,
              // position : _position, <= get from data-position attribute, mandatory
              // layout : col-3cm, col-3cr, etc...
              // extended_width : 's1' == _id ? '340px' : '260px'
              //}
              initialize : function( id, options ) {
                    if ( ! $.isReady ) {
                          throw new Error( 'Sidebars must be instantiated on DOM ready' );
                    }
                    var sb = this;
                    /////////////////////////////////////////////////////////////////////////
                    /// SETUP PROPERTIES AND OBSERVABLE OBJECTS
                    //assign the id
                    sb.id = id;

                    //write the options as properties
                    $.extend( sb, options || {} );

                    sb.button_selectors = '.sidebar-toggle';
                    sb.button = sb.container.find( sb.button_selectors );

                    czrapp.Value.prototype.initialize.call( sb, null, options );

                    //declare an observable sticky state
                    sb.stickyness = new czrapp.Value();//<= will be set to a string on scroll : 'top', 'between', 'bottom'

                    //store the animation state
                    sb.animating = new czrapp.Value( false );

                    //store the max column height
                    //=> will be updated on dom ready (now), resize, stickify, sidebar expansion
                    sb.maxColumnHeight = new czrapp.Value( sb._getMaxColumnHeight() );


                    /////////////////////////////////////////////////////////////////////////
                    /// SETUP USER ACTIONS LISTENERS
                    //Listen to user actions
                    czrapp.setupDOMListeners(
                          [
                                {
                                      trigger   : 'click keydown',
                                      selector  : sb.button_selectors,
                                      actions   : function() {
                                            var sb = this;
                                            //collapse the other expanded
                                            czrapp.userXP.sidebars.each( function( _sb_ ) {
                                                _sb_( _sb_.id == sb.id ? _sb_() : 'collapsed' );
                                            });
                                            //toggle expansion of this one
                                            sb( 'collapsed' == sb() ? 'expanded' : 'collapsed' );
                                      }
                                },
                                {
                                      trigger   : 'mouseenter',
                                      selector  : sb.button_selectors,
                                      actions   : function() {
                                            this.button.addClass( 'hovering' );
                                      }

                                },
                                {
                                      trigger   : 'mouseleave',
                                      selector  : sb.button_selectors,
                                      actions   : function() {
                                            this.button.removeClass( 'hovering' );
                                      }

                                }
                          ],//actions to execute
                          { dom_el: sb.container },//dom scope
                          sb //instance where to look for the cb methods
                    );


                    /////////////////////////////////////////////////////////////////////////
                    /// INITIAL ACTIONS
                    //set initial sidebar state
                    sb( 'collapsed' );

                    //PREPARE THE SIDEBAR CONTAINER
                    //When a dom element position changes to 'fixed' positioning, ios devices needs the element to be handled faster by the GPU
                    //=> adding translateZ(0) to the element fixes the problem
                    sb.container.css({
                          '-webkit-transform': 'translateZ(0)',    //Safari and Chrome
                          '-moz-transform': 'translateZ(0)',       /* Firefox */
                          '-ms-transform': 'translateZ(0)',        /* IE 9 */
                          '-o-transform': 'translateZ(0)',         /* Opera */
                          transform: 'translateZ(0)'
                    });


                    /////////////////////////////////////////////////////////////////////////
                    /// APP EVENTS
                    //SIDEBAR REACT
                    //Listen to sidebar state ( expandability )
                    //$('body').addClass( id +'-collapse').addClass( id +'-collapse');
                    //the deferred promise() returned value is only here to allow sequential actions in the future
                    //like, expand and then do this or that
                    sb.bind( function( state ) {
                          return $.Deferred( function() {
                                var dfd = this;
                                sb._toggleSidebar()
                                      .done( function( state ){
                                            sb.button.toggleClass( 'hovering', 'expanded' == state );
                                            dfd.resolve();
                                      });
                          }).promise();
                    }, { deferred : true } );


                    //Validate the sb change
                    //animate : make sure we restrict actions when : 'only screen and (min-width: 480px) and (max-width: 1200px)'
                    sb.validate = function( value ) {
                          return this._isExpandable() ? value : 'collapsed';
                    };

                    //STICKY STATE REACT
                    //Listen to stickify state
                    //@param : 'top', 'bottom', 'between'
                    sb.stickyness.bind( function( to, from ) {
                          //Inform the global stickyness of the change
                          _stckness = $.extend( {}, true, _.isObject( czrapp.userXP.sidebars.stickyness() ) ? czrapp.userXP.sidebars.stickyness() : {} );
                          _stckness[ sb.id ] = to;
                          czrapp.userXP.sidebars.stickyness( _stckness );

                          sb._stickify( to  );
                    });


                    //MAX COLUMN HEIGHT REACT
                    //=> refresh the stickyness state here with new maths
                    sb.maxColumnHeight.bind( function() {
                          sb._setStickyness();
                    });

                    /////////////////////////////////////////////////////////////////////////
                    /// BROWSER EVENTS
                    //Set the stickyness state on scroll
                    czrapp.$_window.scroll( _.throttle( function() {
                          sb._setStickyness();
                    }, 10 ) );//window.scroll() throttled

                    //RESIZE
                    //Collapse on resize
                    czrapp.userXP.windowWidth.bind( function( width ) {
                          //update the max column height
                          sb.maxColumnHeight( sb._getMaxColumnHeight() );

                          sb( 'collapsed' ).done( function() {
                                sb._stickify();
                          });
                    });
              },//initialize


              //@return void()
              //update the stickyness state according to the current scroll position and columns height
              _setStickyness : function() {
                    var sb = this;
                    //true === matchMedia( 'only screen and (min-width: 480px)' ).matches
                    if ( ! sb._isStickyfiable() )
                      return;
                    // For contentBottomToTop, we use the maximum column height value
                    // => we can be in a collapsed scenario where a sidebar's height will become higher than the content column height when expanded.
                    var startStickingY      = czrapp.$_mainWrapper.offset().top,
                        contentBottomToTop  = startStickingY + sb.maxColumnHeight(),//sb._getMaxColumnHeight()
                        topSpacing          = 0,//_setTopSpacing();
                        scrollTop           = czrapp.$_window.scrollTop(),
                        stopStickingY       = contentBottomToTop - ( sb.container.outerHeight() + topSpacing );


                    if ( stopStickingY < 0 )
                      return;

                    //When the sidebar is expanded ( can only happen below 1200px viewport ), ot it has to be sticky
                    //=> in this case, we skip this check with ! expanded
                    sb.stickyness( ( function() {
                          if ( scrollTop >= stopStickingY ) {
                                // //the top value can be negative in this case, if the sidebar is content is higher than the sidebar which is higher than the viewport
                                return 'bottom';
                          } else if ( scrollTop >= startStickingY ) {
                                //The sidebar can be expanded, in this case, its height will be adapted on scroll
                                //We are sticky now
                                return 'between';
                          } else if( scrollTop < startStickingY ) {
                                return 'top';
                          }
                    })() );
              },

              //react on stickyness() changes
              //can be called to ajust offset top
              //@return void()
              //@param stickyness : top, between, bottom
              _stickify : function( stickyness ) {
                    var sb = this;
                    stickyness = stickyness ||  sb.stickyness();

                    //update the max column height
                    sb.maxColumnHeight( sb._getMaxColumnHeight(), { silent : true } );//<= we update it silently here to avoid infinite looping => the maxColumnHeight always triggers a _stickify action in other contexts

                    // For contentBottomToTop, we use the maximum column height value
                    // => we can be in a collapsed scenario where a sidebar's height will become higher than the content column height when expanded.
                    var contentBottomToTop  = czrapp.$_mainWrapper.offset().top + sb.maxColumnHeight(),
                        expanded            = 'expanded' == sb();

                    switch( stickyness ) {
                          case 'top' :
                                sb.container.removeClass('sticky');

                                sb._translateSbContent();
                                // $.when( sb.container.removeClass('sticky') ).done( function() {
                                //       sb._translateSbContent();
                                // });
                                sb.container
                                    //.offset( { top: $mainWrapper.offset().top } )
                                    .css({
                                          position : '',
                                          top : '',
                                          left : '',
                                          right : '',
                                          'margin-left' : '',
                                          'margin-right' : '',
                                          'padding-bottom' : '',
                                          height : ''
                                    });
                                //console.log('ONE : scrollTop < sb.container.offset().top');
                          break;

                          case 'between' :
                                sb.container.addClass( 'sticky' );
                                sb._translateSbContent();
                                // $.when( sb.container.addClass( 'sticky' ) ).done( function() {
                                //       sb._translateSbContent();
                                // });
                                sb.container.css({
                                      position : 'fixed',
                                      top : '0px',
                                      //height : expanded ? sb._getExpandedHeight() + 'px' : '',
                                      left : sb._getStickyXOffset(),//<= depdendant of the sidebar position : left, middle-left, middle-right, right
                                      // 'margin-left' : 0,
                                      // 'margin-right' : 0,
                                      'padding-bottom' : expanded ? 0 : '',
                                });

                                //czrapp._printLog('STYLE ? ' + sb.container.attr( 'style' ) );
                                //console.log('TWO STICKY : scrollTop >= $mainWrapper.offset().top ' );
                          break;

                          case 'bottom' :
                                sb.container.removeClass( 'sticky' );
                                sb.container
                                    //.offset( { top: $mainWrapper.offset().top } )
                                    .css({
                                      position : '',
                                      top : '',
                                      left : '',
                                      right : '',
                                      'margin-left' : '',
                                      'margin-right' : '',
                                      'padding-bottom' : '',
                                      height : ''
                                });

                                //the top value can be negative in this case, if the sidebar is content is higher than the sidebar which is higher than the viewport
                                sb.container.offset( { top: contentBottomToTop - sb.container.outerHeight() } );

                                sb._translateSbContent();

                                //console.log('THREE : scrollTop > stopStickingY');
                          break;
                    }//switch()
              },//stickify


              //@react to sb() state change
              //state agnostic method
              //its job is to expand or collapse depending on the current instance state
              //@return promise()
              _toggleSidebar : function() {
                    var sb = this,
                        expanded = 'expanded' == sb();
                    return $.Deferred( function() {
                          var _dfd_ = this;

                          var _transX,
                              _marginRight,
                              _marginLeft,
                              _translate;
                          ( function() {
                                return $.Deferred( function() {
                                      var _dfd = this;

                                      sb.animating( true );
                                      czrapp.$_body
                                          .toggleClass('sidebar-expanded', expanded )
                                          .toggleClass('sidebar-expanding', expanded )
                                          .toggleClass('sidebar-collapsing', ! expanded );
                                      sb.container
                                          .toggleClass( 'expanding', expanded )
                                          .toggleClass( 'collapsing', ! expanded );

                                      //PREPARE SB CONTAINER CSS
                                      //If the sidebar is sticky, we need to translate it while setting the width
                                      //Set Horizontal left position when 'fixed'
                                      switch( sb.position ) {
                                            case 'right' :
                                                _transX = - ( sb.extended_width - 50 );
                                                if ( 'col-3cl' == sb.layout ) {
                                                    _marginRight = expanded ? - sb.extended_width - 50 : -100;
                                                } else {
                                                    _marginRight = expanded ? - sb.extended_width : -50;
                                                }
                                            break;
                                            case 'middle-right' :
                                                _transX = - ( sb.extended_width - 50 );
                                                _marginRight = expanded ? - sb.extended_width  : -50;
                                                // if ( 'col-3cl' == sb.layout ) {
                                                //     _marginLeft = expanded ? - sb.extended_width - 50 : -100;
                                                // } else {

                                                // }
                                            break;
                                            case 'middle-left' :
                                                _transX = sb.extended_width - 50;
                                                _marginLeft = expanded ? - sb.extended_width : -50;
                                            break;
                                            case 'left' :
                                                _transX = sb.extended_width - 50;
                                                if ( 'col-3cr' == sb.layout ) {
                                                    _marginLeft = expanded ? - sb.extended_width - 50 : -100;
                                                } else {
                                                    _marginLeft = expanded ? - sb.extended_width : -50;
                                                }
                                            break;
                                      }

                                      _transX = expanded ? _transX : 0;
                                      _translate = 'translate3d(' + _transX + 'px,0px,0px)';

                                      //APPLY SB CONTAINER CSS
                                      sb.container.css({
                                            width : expanded ? sb.extended_width + 'px' : '50px',
                                            'margin-right' : _.isEmpty( _marginRight + '' ) ? '' : _marginRight + 'px',
                                            'margin-left' : _.isEmpty( _marginLeft + '' ) ? '' : _marginLeft + 'px',
                                            height : expanded ? sb._getExpandedHeight() + 'px' : sb.container.height() + 'px',
                                            '-webkit-transform': _translate,   /* Safari and Chrome */
                                            '-moz-transform': _translate,       /* Firefox */
                                            '-ms-transform': _translate,        /* IE 9 */
                                            '-o-transform': _translate,         /* Opera */
                                            transform: _translate
                                      });

                                      czrapp.$_mainContent.css({
                                            '-webkit-transform': _translate,   /* Safari and Chrome */
                                            '-moz-transform': _translate,       /* Firefox */
                                            '-ms-transform': _translate,        /* IE 9 */
                                            '-o-transform': _translate,         /* Opera */
                                            transform: _translate,
                                      });

                                      //OPACITY
                                      sb.container.find('.sidebar-content').css('opacity', expanded ? 0 : 1 );
                                      sb.container.find('.icon-sidebar-toggle').css('opacity', 0);

                                      //DO
                                      _.delay( function() {
                                            _dfd.resolve();
                                      }, 350 );//transition: width .35s ease-in-out;
                                }).promise();
                          })().done( function() {
                                sb.container.toggleClass( 'expanded', expanded ).toggleClass('collapsed', ! expanded );
                                sb.container
                                      .removeClass( 'expanding')
                                      .removeClass( 'collapsing')
                                      .css({
                                            width : expanded ? sb.extended_width + 'px' : '',
                                            'margin-right' : '',
                                            'margin-left' : '',
                                            height : '',
                                      });

                                //END SIDEBAR ANIMATION + CLEAN CLASSES
                                sb.container.find('.icon-sidebar-toggle').css('opacity', 1);

                                //sidebar content
                                sb.container.find('.sidebar-content')
                                    .css({
                                          opacity : '',
                                          //height : expanded ? 'calc( 100% - 60px )' : ''//<= 60px is the height of the toggle arrow bar
                                    });
                                sb.animating( false );
                                //Clean body classes
                                czrapp.$_body.removeClass('sidebar-expanding').removeClass('sidebar-collapsing');


                                //PUSH THE CONTENT ON THE LEFT OR ON THE RIGHT
                                ( function() {
                                      return $.Deferred( function() {
                                            var _dfd = this,
                                                _pushDirection = -1 == sb.position.indexOf( 'right' ) ? 'right' : 'left';
                                            //Make sure the content column looks good when pushed left or right
                                            czrapp.$_mainContent.css({ width: expanded ? 'calc( 100% - ' + ( Math.abs( _transX ) - 1 ) + 'px )' : ''} );
                                            czrapp.$_mainContent.css( 'padding-' + _pushDirection , expanded ? ( Math.abs( _transX ) - 1 ) : '' );
                                            _.delay( function() {
                                                  _dfd.resolve();
                                            }, 350 );//transition: transform, .35s ease;
                                      }).promise();
                                } )().done( function() {
                                      //update the max column height
                                      sb.maxColumnHeight( sb._getMaxColumnHeight() );

                                      //adjust offset top if expanded when sticky and close to bottom:
                                      if ( sb._isStickyfiable() ) {
                                            sb._setStickyness();
                                      }
                                      _dfd_.resolve();
                                });
                          });
                    }).promise();
              },//toggleSidebar



              //translate content vertically to follow the sticky menu animation
              _translateSbContent : function( stickyMenuDown ) {
                    stickyMenuDown = stickyMenuDown || czrapp.userXP.stickyMenuDown();
                    var sb = this,
                        translateYUp = 0,
                        translateYDown = 0,
                        _translate = '';

                    //Handle the specific case of user logged in ( wpadmin bar length not false ) and previewing website with a mobile device < 600 px
                    //=> @media screen and (max-width: 600px)
                    // admin-bar.css?ver=4.7.3:1097
                    // #wpadminbar {
                    //     position: absolute;
                    // }
                    if ( 'between' == sb.stickyness() ) {
                          if ( 1 == czrapp.$_wpadminbar.length ) {
                                translateYUp = translateYUp + czrapp.$_wpadminbar.outerHeight();
                                translateYDown = translateYDown + czrapp.$_wpadminbar.outerHeight();
                          }
                          if ( stickyMenuDown && _.isFunction( window.matchMedia ) && ! matchMedia( 'screen and (max-width: 600px)' ).matches ) {
                                translateYUp = translateYUp + 50;
                          }
                    }

                    _translate = ( stickyMenuDown && 'between' == sb.stickyness() ) ? 'translate(0px, ' + translateYUp + 'px)' : 'translate(0px, ' + translateYDown + 'px)';

                    sb.container.find('.sidebar-content, .sidebar-toggle').css({
                          //transform: 'up' == args.direction ? 'translate3d(0px, -' + _height + 'px, 0px)' : 'translate3d(0px, 0px, 0px)'
                          '-webkit-transform': _translate,   /* Safari and Chrome */
                          '-moz-transform': _translate,       /* Firefox */
                          '-ms-transform': _translate,        /* IE 9 */
                          '-o-transform': _translate,         /* Opera */
                          transform: _translate
                    });
              },



              //@return a string '' or number + 'px'
              //invoked when sb is sticky
              //only used when sticky;
              _getStickyXOffset : function() {
                    var sb = this,
                        expanded = 'expanded' == sb(),
                        $mainWrapper = $('.main', '#wrapper'),
                        $mainContent = $mainWrapper.find('.content'),
                        xFixedOffset = '';

                    if ( 'between' != sb.stickyness() )
                      return '';

                    //Set Horizontal left position when 'fixed'
                    switch( sb.position ) {
                          case 'left' :
                              if ( expanded ) {
                                    xFixedOffset = $mainWrapper.offset().left + 50;
                              } else {
                                    xFixedOffset = $mainWrapper.offset().left + sb.container.width();
                              }
                              if ( 'col-3cr' == sb.layout ) {
                                    if ( expanded ) {
                                          xFixedOffset = $mainWrapper.offset().left + czrapp.userXP.sidebars('s2').container.width() + 50;
                                    } else {
                                          xFixedOffset = '';
                                    }
                              }
                          break;
                          case 'middle-left' :
                              xFixedOffset = czrapp.userXP.sidebars('s1').container.width() + $mainWrapper.offset().left + 50;
                              if ( 'col-3cr' == sb.layout ) {
                                    if ( expanded ) {
                                    } else {
                                          xFixedOffset = '';
                                    }
                              }
                          break;
                          case 'middle-right' :
                              xFixedOffset = $mainWrapper.offset().left + $mainContent.outerWidth();
                          break;
                          case 'right' :
                              if ( expanded ) {
                                    xFixedOffset = $mainWrapper.offset().left + $mainWrapper.outerWidth() - 50;
                              } else {
                                    xFixedOffset = $mainWrapper.offset().left + $mainWrapper.outerWidth() - sb.container.width();
                              }
                          break;
                    }
                    return _.isEmpty( xFixedOffset ) ? xFixedOffset : xFixedOffset + 'px';
              },

              //invoked in a scenario of sidebar expanded in mobile view : toggle and scroll
              //@return number
              _getExpandedHeight : function() {
                    var sb = this,
                        _winHeight = czrapp.$_window.height(),
                        _sbHeight = this.container.find('.sidebar-content').height(),
                        _maxColHeight = sb.maxColumnHeight();

                    //When the sidebar is sticky and expanded
                    if ( 'between' == sb.stickyness() ) {
                          //if sticky we want the height to be the part that we see from top to bottom of the viewport
                          return czrapp.$_mainWrapper.offset().top + czrapp.$_mainWrapper.find('.content').outerHeight() - sb.container.offset().top;
                    } else {
                          //return _winHeight > _sbHeight ? _winHeight : _sbHeight;
                          //if not sticky, then make sure we are not smaller than the viewport's height
                          return Math.max( _winHeight, _sbHeight > _maxColHeight ? _maxColHeight : _sbHeight );
                    }
                    return Math.max( _winHeight, _sbHeight > _maxColHeight ? _maxColHeight : _sbHeight );


              },

              //@return number
              _getMaxColumnHeight : function() {
                    var _hs = [];
                    //loop on the sb instances to get their container height
                    //skip the sb sticky and expanded => those will inherit the height of the content or the other sb
                    czrapp.userXP.sidebars.each( function( _sb_ ) {
                          _hs.push( _sb_.container.outerHeight() );
                    });
                    $('.content', '#wrapper .main').each( function() {
                          if ( 1 == $(this).length )
                            _hs.push( $(this).outerHeight() );
                    });
                    return Math.max.apply(null, _hs );
              },


              //@return bool
              _isExpandable : function() {
                    return _.isFunction( window.matchMedia ) && matchMedia( 'only screen and (min-width: 480px) and (max-width: 1200px)' ).matches;
              },

              //we can stickify if :
              //1) we have a mainWrapper and a mainContent container. //$('.main', '#wrapper') && $('.main', '#wrapper').find('.content')
              //2) the view port is wider than 480px
              _isStickyfiable : function() {
                    return 1 == czrapp.$_mainWrapper.length && 1 == czrapp.$_mainContent.length && _.isFunction( window.matchMedia ) && matchMedia( 'only screen and (min-width: 480px)' ).matches;
              }
        },//SidebarCTOR

  };//_methods{}

  czrapp.methods.UserXP = czrapp.methods.UserXP || {};
  $.extend( czrapp.methods.UserXP , _methods );

})(jQuery, czrapp);