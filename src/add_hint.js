function set_important(element, item, value) {
    try {
	// jquery .css(-,-)  does not handle !important correctly:
	element[0].style.setProperty(item, value, "important");
	//element[0].style.setProperty(item, value);
    } catch (e) {
	// fallback for XML files:
	var style = element.attr("style");
	if (style)
	    style += " ";
	else
	    style = "";
	element.attr("style",  style + item + ": "+value+" !important;");
    }
}


function build_base_element() {
    var element = $("<span></span>");
    // mark our inserted elements so we can distinguish them:
    element.attr("CBV_hint_element", "true"); 
    return element;
}

function add_text(element, text) {
    element.attr("CBV_add_text", "true");  // activate style rules
    if (option("c"))
	element.attr("CBV_high_contrast", "true");
    element.append(text);
    return element;
}

function build_hint(element, hint_number, use_overlay) {
    var outer = build_base_element();
    outer.attr("CBV_hint_tag", hint_number);

    if (use_overlay) {
	outer.attr("CBV_outer_overlay", "true");

	var inner = build_base_element();
	outer.append(inner);

	inner.attr("CBV_inner_overlay", "true");
	add_text(inner, hint_number);

	// IMPORTANT: need to have top, left set so offset(-[,-])
	//            works correctly on this element:
	set_important(inner, "top",  "0");
	set_important(inner, "left", "0");

	// try and allow some opacity:
	var opacity = element.css("opacity");
	if (opacity && opacity < .5)
	    set_important(inner, "opacity",  "1");
	else
	    set_important(inner, "opacity", opacity);

	// experiment: try and beat hinted element's z-index by one:
	var zindex = element.css("z-index");
	if (zindex && zindex > 0)
	    set_important(inner, "z-index", zindex+1);

    } else {
	outer.attr("CBV_outer_inline", "true");
	add_text(outer, hint_number);
    }

    return outer;
}


function can_put_span_inside(element) {
    // unconditionally _empty elements_ that cannot have any child
    // nodes (text or nested elements):
    if (element.is("area, base, br, col, command, embed, hr, img, input, keygen, link, meta, param, source, track, wbr")) 
	return false;

    if (element.is("select, option, textarea")) 
	return false;

    if (element.is("iframe")) 
	// iframe elements are displayed only if browser doesn't support iframe's
	return false;

    if (CBV_inserted_element(element))
	return false;

    if (element.is("div, span, a, button, li, th, td")) 
	return true;

    // above absolutely correct; below is heuristic:

    try {
	if (element.contents().length > 0)
	    return true;
    } catch (e) {}
    return false;
}


function insert_hint_tag(element, hint_tag, put_before, put_inside) {
    if (put_inside) {
	if (put_before)
	    element.prepend(hint_tag);
	else
	    element.append(hint_tag);
    } else {
	if (put_before)
	    element.before(hint_tag);
	else
	    element.after(hint_tag);
    }    
}


function visual_contents(element) {
    if (element.is("iframe"))
	return [];
	
    var indent = element.css("text-indent");
    if (indent && /^-999/.test(indent))
	return [];

    return element.contents().filter(function () {
	if (this.nodeType === Node.COMMENT_NODE)
	    return false;

	// ignore nodes intended solely for screen readers and the like
	if (this.nodeType === Node.ELEMENT_NODE) {
	    if ($(this).css("display") == "none")
		 return false;
//	    if ($(this).width()==0 && $(this).height()==0)
	    if ($(this).css("position")=="absolute"
		|| $(this).css("position")=="fixed")
		return false;
	}

	return true;
    });
}

function is_text_overflow_ellipisis(element) {
    for (;;) {
	if (element.css("text-overflow") != "clip")
	    return true;
	if (element.css("display") != "inline")
	    return false;
	element = element.parent();
    }
}


function CSS_number(element, property_name) {
    var value = element.css(property_name);
    //console.log(property_name + " -> " + value);
    if (value == "none")
	return 0;
    if (/^[0-9]+px$/.test(value))
	return parseFloat(value);
    if (value == "100%")
	return element.parent().width(); // <<<>>>
    return 0;
}
function get_text_overflow_ellipisis_clip(element) {
    for (;;) {
	if (element.css("text-overflow") != "clip") {
	    var clip = {right: element[0].getBoundingClientRect().right};

	    clip.right  -= CSS_number(element,"border-right-width") - 
		           CSS_number(element,"padding-right");
	    var slop = CSS_number(element,"max-width") - element.width();
	    if (slop>0)
		clip.right += slop;

	    if (slop>0)
		clip.top = -slop;
	    // if (slop>0)
	    // 	console.log(clip);
	    // console.log(element[0]);
	    // console.log(element.css("max-width"));
	    // console.log(slop);

	    return clip;
	}
	if (element.css("display") != "inline")
	    return null;
	element = element.parent();
    }
}


function prepare_hint (element) {
    var put_inside   = false;
    var put_before   = option("b");
    var use_overlay  = option("v");
    var displacement = 0;
    var offset_end   = option('e');

    if (option("h")) {
	if (element.is("a") && element.text().length > 30) {
	    console.log(element[0]);
	    use_overlay = false;
	    put_before  = false;
	} else {
	    use_overlay = true;
	}
    }

    if (option("y")) {
	if (element.parents().is("p")) {
	    use_overlay = false;
	    put_before = false;
	}
    }

    if (option("Z0")) {
	try {
	    if (element.contents().length == 1 && element.children().length == 0
		&& element.text().length > 0
		&& can_put_span_inside(element)) {
		use_overlay = false;
		put_before = false;
		put_inside = true;
	    } 

	    // first check is to ensure no text or comment direct subnodes
	    if (element.contents().length == 1
		&& element.contents().first().is("div, span, strong, i, b, em, font, abbr")) {
		var candidate = element.children().first();
		if (candidate.contents().length == 1 && candidate.children().length == 0
		    && candidate.text().length > 0
		    && can_put_span_inside(candidate)) {
		    element = candidate;
		    use_overlay = false;
		    put_before = false;
		    put_inside = true;
		} 
	    }
	} catch (e) {}
    }


    if (option("Z1")) {
	var current = element;
	var inside  = visual_contents(current);
	var inner   = false;
	for (;;) {
	    if (can_put_span_inside(current)
		&& inside.length > 0
		&& inside.last()[0].nodeType == Node.ELEMENT_NODE
		&& (!inner || current.is("div, span, strong, em, i, b, font, abbr"))) {
		// console.log(current[0]);
		current = inside.last();
		inside  = visual_contents(current);
		// console.log("> ");
		// console.log(current[0]);
		inner = true;
	    } else
		break;
	}

	if (can_put_span_inside(current)
	    && inside.length > 0
	    && inside.last()[0].nodeType == Node.TEXT_NODE
	    && current.css("display") != "flex"){
	    var okay = true;
	    var force_before = false;

	    if (option (".")) {
		var clip = get_text_overflow_ellipisis_clip(current);
		if (clip) {
		    okay = false;
		    if (option(".."))
//			if (current[0].scrollWidth + 40 < current.width())
			if (current[0].getBoundingClientRect().right + 40 < clip.right)
			    okay = true;
			// if (current[0].scrollWidth>0 &&
			//     (current[0].scrollWidth + 40 < current.width()))
			//     okay = true;

		    console.log(current[0]);
		    // console.log(current[0].scrollWidth);
		    // console.log(current.width());
		    // console.log(current[0].offsetWidth);
		    // console.log(current[0].clientWidth);
		    console.log(current[0].getBoundingClientRect());
		    console.log(clip);
		    if (!okay && option(".<")) {
			okay = true;
			force_before = true;
		    }

		}
	    }

	    if (okay) {
		element = current;
		use_overlay = false;
		put_before = false;
		put_inside = true;
		if (force_before)
		    put_before = true;

	    }
	} else {
	    // console.log("failed: ");
	    // console.log(current[0]);
	    // console.log(inside);
	    // console.log(inside.length);
	    // console.log(inside.last[0]);
	}
    }


    if (use_overlay) {
	put_inside = can_put_span_inside(element);
    } else {
	if (element.is("a") || element.is("button"))
	    put_inside = true;

	if (option("i") 
	    && (element.children().length>0
	        || element.text != ""))
	    put_inside = true;

	if (put_inside && option("ii")) {
	    // first check is to ensure no text or comment direct subnodes
	    if (element.contents().length == 1
		&& element.contents().first().is("div, span")) {
		console.log(">> " + element.text());
		element = element.children().first();
	    }
	}
    }

    // always put hints after tr elements (else messes up table
    // formatting as treats hint tag as first column):
    if (element.is("tr")) 
	put_before = false;


    if (option('E')) {
	if (element.is("a") && element.children ().length == 0) {
//	    displacement = 4;
	    displacement = 3;
	}
    }

    // hard coding reddit entire story link:
    if (/\.reddit\.com/.test(window.location.href)) {
	if (use_overlay && element.is(".thing"))
	    offset_end = false;
    }


    return {use_overlay:    use_overlay,
	    put_before:     put_before,
	    put_inside:     put_inside,
	    offset_end:     offset_end,
	    displacement:   displacement,
	    target_element: element};
}


function add_hint(element, hint_number) {
    var hint_info = prepare_hint(element);
    element = hint_info.target_element;
    var hint_tag  = build_hint(element, hint_number, hint_info.use_overlay);

    if (hint_info.use_overlay) {
	hint_info.overlay_element = hint_tag.children().first();
    }

    insert_hint_tag(element, hint_tag, hint_info.put_before, hint_info.put_inside);
    //$("body").append(hint_tag);

    if (hint_info.use_overlay) {
	return () => {
	    try { // this fails for XML files... <<<>>>
		var offset = hint_info.target_element.offset();
		if (hint_info.offset_end)
		    offset.left += hint_info.target_element .outerWidth() 
		    - hint_info.overlay_element.outerWidth();
		offset.left += hint_info.displacement;
		offset.top  -= hint_info.displacement;
		hint_info.overlay_element.offset(offset);
	    } catch (e) {}
	};
    } else
	return null;
}
