// ==UserScript==
// @name        NRS Readability
// @namespace   com.maltera
// @match       *://www.leg.state.nv.us/nrs/*
// @version     1
// @grant       none
// ==/UserScript==

try {
(function(){
  /** Normalizes the whitespace in a string.
   * The site likes to use non-breaking spaces and other nonsense to
   * do their formatting. Since we impose actual structure we need
   * to get rid of them or it looks awful.
   */
  function normSpace (text) {
    return text
      .replace(/\u00A0/g, " ") // non-breaking space
      .replace(/\t/g, " ");
  }


  function visitNode (node) {
    if (node instanceof CharacterData && !(node instanceof Comment)) {
      return document.createTextNode( normSpace( node.data ) );
    } else if (node instanceof Element) {
      return visitElement( node );
    } else {
      return node;
    }
  }

  function visitElement (elem) {
    filterChildren( elem );
    return elem;
  }

  function filterChildren (elem) {
    for (let child of elem.childNodes) {
      let result = visitNode( child );
      if (result !== child) {
        elem.replaceChild( result, child );
      }
    }
  }

  function moveChildren (source, dest) {
    while (source.childNodes.length > 0) {
      let child = source.childNodes[ 0 ];
      child.remove();
      dest.appendChild( visitNode( child ) );
    }
  }


  function stripPrefix (node, prefix) {
    let text = node.childNodes[ 0 ];
    if (!(text instanceof CharacterData)) return;

    let value = normSpace( text.textContent ).trimLeft();
    if (value.startsWith( prefix )) {
      node.replaceChild( document.createTextNode(
        value.substring( prefix.length ).trimLeft()
      ), text );
    }
  }

  let root = document.querySelector(".WordSection1");
  root.remove();

  let parent = document.createElement( 'div' );
  let section = null;
  let numbers = null;
  let letters = null;
  let subnumbers = null;
  let container = parent;

  while (root.childNodes.length > 0) {
    let part = root.childNodes[ 0 ];
    part.remove();
    if (!( part instanceof Element )) continue;

    if (part.classList.contains( 'SectBody' )) {
      // p.SectBody is nearly all content


      // if this paragraph contans a span.Section it's a section heading
      // start an new section and convert this paragraph to an h3
      if (part.querySelector( ".Section" )) {
        numbers = null;
        letters = null;
        subnumbers = null;

        section = document.createElement( 'section' );
        parent.appendChild( section );
        container = section;

        let heading = document.createElement( 'h3' );
        section.appendChild( heading );

        let paragraph = document.createElement( 'p' );

        // first move all known header elements to the new h3
        while (part.childNodes.length > 0) {
          let child = part.childNodes[ 0 ];

          if (!(child instanceof Element) || (
              !child.classList.contains('Empty')
              && !child.classList.contains('Section')
              && !child.classList.contains('Leadline'))) {
            break;
          }

          child.remove();
          filterChildren( child );
          heading.appendChild( child );
        }

        // then move everything else to a new paragraph
        // this is necessary because when the body of a section is not an outline
        // the first body paragraph follows the heading in the same <p> tag
        moveChildren( part, paragraph );
        if (paragraph.childNodes.length > 0) {
          section.appendChild( paragraph );
        }


        let anchor = heading.querySelector( 'a[name]' );
        if (anchor) {
          anchor.remove();
          section.id = anchor.name;
        }

      // if this is not a section header but we're in a section
      // handle the current paragraph as body content and detect outline level
      } else if (section) {
        let text = normSpace( part.textContent ).trimLeft();
        let match;

        if (match = /^([0-9]+)\./.exec( text )) {
          if (!numbers) {
            numbers = document.createElement( 'ol' );
            numbers.setAttribute( 'type', '1' );
            section.appendChild( numbers );
          }

          letters = null;
          subnumbers = null;

          let item = document.createElement( 'li' );
          item.setAttribute( 'value', parseInt( match[1] ) );
          numbers.appendChild( item );
          container = item;

          let paragraph = document.createElement( 'p' );
          moveChildren( part, paragraph );
          stripPrefix( paragraph, match[0] );
          item.appendChild( paragraph );
        } else if (match = /^\(([a-z]+)\)/.exec( text )) {
          if (!letters) {
            letters = document.createElement( 'ol' );
            letters.setAttribute( 'type', 'a' );
            container.appendChild( letters );
          }

          subnumbers = null;

          let item = document.createElement( 'li' );
          item.setAttribute( 'value', match[1] );
          letters.appendChild( item );
          container = item;

          let paragraph = document.createElement( 'p' );
          moveChildren( part, paragraph );
          stripPrefix( paragraph, match[0] );
          item.appendChild( paragraph );
        } else if (match = /^\(([0-9]+)\)/.exec( text )) {
          if (!subnumbers) {
            subnumbers = document.createElement( 'ol' );
            subnumbers.setAttribute( 'type', '1' );
            container.appendChild( subnumbers );
          }

          let item = document.createElement( 'li' );
          item.setAttribute( 'value', parseInt( match[1] ) );
          subnumbers.appendChild( item );
          container = item;

          let paragraph = document.createElement( 'p' );
          moveChildren( part, paragraph );
          stripPrefix( paragraph, match[0] );
          item.appendChild( paragraph );
        } else {
          let paragraph = document.createElement( 'p' );
          moveChildren( part, paragraph );
          container.appendChild( paragraph );
        }

      // if we don't have a current section and this isn't a section header
      // treat it as general body conent and move it over unchanged
      } else {
        container.appendChild( part );
      }
    } else if (part.classList.contains( 'SourceNote' ) && section) {
      section.appendChild( part );
    } else if (part.classList.contains( 'DocHeading' ) || part.classList.contains( 'COHead2' )) {
      let heading = document.createElement( 'h2' );
      moveChildren( part, heading );

      let anchor = heading.querySelector( 'a[name]' );
      if (anchor) {
        anchor.remove();
        heading.id = anchor.name;
      }

      parent.appendChild( heading );
    } else {
      section = null;
      numbers = null;
      letters = null;
      subnumbers = null;
      container = parent;

      parent.appendChild( part );
    }
  }


  (function(){
    // remove all existing stylesheets; they just make everything awful
    for (let style of document.getElementsByTagName( 'style' )) {
      style.remove();
    }

    let style = document.createElement( 'style' );
    style.type = "text/css";
    style.textContent = "p { max-width: 78ex; }";
    document.head.appendChild( style );
  })();

  document.body.appendChild( parent );
  console.info( "NRS Readability finished" );
})();
} catch (caught) {
  console.error( "NRS Readability failed", caught );
}
