module.exports = function fontgen(loadImage){
	"use strict";

	var opentype = require("opentype.js");

	function prop(name){
		return function(o){
			var path = name.split(".");
			while(path.length){
				o = o[path.shift()];
			}
			return o;
		};
	}

	function has(name){
		return function(o){
			return o.hasOwnProperty(name);
		};
	}

	function uniq(array, comparator) {
		return array.sort(comparator).filter(function(item, pos, ary) {
			return !pos || item != ary[pos - 1];
		});
	}

	function compareNumbers (a,b) {
		return a - b;
	}

	function dump(data){
		var out = "";
		for (var prop in data){
			out += prop + "='" + data[prop] + "' ";
		}
		return out;
	}

	function getBounds(path){
		var xs = path.commands
			.filter(has("x"))
			.map(prop("x"))
			.sort(compareNumbers);

		var ys = path.commands
			.filter(has("y"))
			.map(prop("y"))
			.sort(compareNumbers);

		return xs.length && ys.length
			? {
				x: xs[0],
				y: ys[0],
				width: xs[xs.length - 1] - xs[0],
				height: ys[ys.length - 1] - ys[0]
			}
			: {x: 0, y:0, width:0, height:0};
	}

	function getGlyphBounds(glyphs, size){
		return glyphs.map(function(glyph){
			return{
				glyph: glyph,
				size: size,
				bounds: getBounds(glyph.getPath(0, 0, size ))
			};
		});
	}

	function orderBounds(width, height, padding, glyphBounds){
		var x = 0;
		var y = 0;
		var lineHeight = 0;
		var margin = 2;

		glyphBounds.sort(function(a,b) { return b.bounds.height - a.bounds.height; });

		glyphBounds.map(function(glyphBound){
			glyphBound.padding = padding;
			glyphBound.margin = margin;
			glyphBound.bounds.x -= padding.left;
			glyphBound.bounds.y -= padding.right;
			glyphBound.bounds.width += padding.left + padding.right;
			glyphBound.bounds.height += padding.top + padding.bottom;

			if((glyphBound.bounds.width + x) > width){
				x = 0;
				y += lineHeight;
				glyphBound.x = x;
				glyphBound.y = y;
				lineHeight = 0;
				x += glyphBound.bounds.width + margin * 2;
			}else{
				glyphBound.x = x;
				glyphBound.y = y;
				x += glyphBound.bounds.width + margin * 2;
				lineHeight = Math.max(lineHeight, glyphBound.bounds.height + margin * 2);
			}
			if((glyphBound.x + glyphBound.bounds.width > width ) || (glyphBound.y + glyphBound.bounds.height > height )){
				throw "can not fit bounds";
			}
			return glyphBound;
		});


		return glyphBounds;
	}

	function describeBounds(width, height, fontData, config, bounds){
		var data = bounds.map(function(glyphBound){
			return {
				id: glyphBound.glyph.unicode,
				letter: glyphBound.glyph.name,
				x: Math.round(glyphBound.x),
				y: Math.round(glyphBound.y),
				xoffset: Math.round(glyphBound.bounds.x),
				yoffset: Math.round(glyphBound.bounds.y),
				width: Math.round(glyphBound.bounds.width),
				height: Math.round(glyphBound.bounds.height),
				xadvance: Math.round(((glyphBound.bounds.x + glyphBound.bounds.width - glyphBound.padding.right) / glyphBound.glyph.xMax) * glyphBound.glyph.advanceWidth) + config.letterSpacing,
				page: 0,
				chnl: 15
			};
		});

		var baseLine = -Math.round(bounds.map(prop("bounds.y")).sort(compareNumbers).shift());

		return [
			"<font>",
			"    <info face='" + config.name + "' ",
			"          size='" + fontData.size + "' ",
			"          bold='" + (fontData.bold ? "1" : "0") + "' ",
			"          italic='" + (fontData.italic ? "1" : "0") + "' ",
			"          padding='" + config.padding.top + "," + config.padding.right + "," + config.padding.bottom + "," + config.padding.left + "' ",
			"          charset='' unicode='' stretchH='100' smooth='1' aa='1' spacing='0,0' outline='0'/>",
			"    <common base='" + baseLine + "' ",
			"            scaleW='" + width + "' ",
			"            scaleH='" + height + "' ",
			"            lineHeight='" + (config.size + config.lineSpacing) + "' ",
			"            pages='1' packed='0'/>",
			"    <pages>",
			"        <page id='0' file='font.png'/>",
			"    </pages>",
			"    <chars count='" + bounds.length + "'>",
					data.map(function(dataEntry){ return "        <char " + dump(dataEntry) + "/>"; }).join("\n"),
			"    </chars>",
			"</font>"
		].join("\n");
	}

	function createGradient(ctx, config, bounds, x, y){
		var gradient;
		if(config.type === "linear"){
			gradient = ctx.createLinearGradient(
				x + config.x0 * bounds.width,
				y + config.y0 * bounds.height,
				x + config.x1 * bounds.width,
				y + config.y1 * bounds.height
			);
		}else if(config.type === "radial"){
			gradient = ctx.createRadialGradient(
				x + config.x0 * bounds.width,
				y + config.y0 * bounds.height,
				config.r0 * bounds.height,
				x + config.x1 * bounds.width,
				y + config.y1 * bounds.height,
				config.r1 * bounds.height
			);
		}

		config.colors.forEach(function(color){
			gradient.addColorStop.apply(gradient, color);
		});

		return gradient;
	}

	function drawGlyphs(canvas, width, height, bounds, config, pattern){
		var ctx = canvas.getContext("2d");

		ctx.shadowColor = config.shadowColor;
		ctx.shadowBlur = config.shadowBlur;
		ctx.shadowOffsetX = config.shadowOffsetX;
		ctx.shadowOffsetY = config.shadowOffsetY;

		if(config.shadowColor){
			bounds.forEach(function(glyphBound){
				var path = glyphBound.glyph.getPath(glyphBound.x - glyphBound.bounds.x, glyphBound.y - glyphBound.bounds.y, glyphBound.size);
				Object.assign(path, config);
				path.stroke = null;
				ctx.lineWidth = 0;
				ctx.lineStyle = null;
				path.fill = config.shadowColor;
				path.draw(ctx);
			});
		}

		ctx.shadowColor = null;
		ctx.shadowBlur = null;
		ctx.shadowOffsetX = null;
		ctx.shadowOffsetY = null;

		bounds.forEach(function(glyphBound){
			var path = glyphBound.glyph.getPath(glyphBound.x - glyphBound.bounds.x, glyphBound.y - glyphBound.bounds.y, glyphBound.size);
			Object.assign(path, config);
			path.fill = null;
			path.stroke = null;

			if(typeof config.fill === "string"){
				applyStyle(ctx, config);
			}else{
				ctx.fillStyle = createGradient(ctx, config.fill, glyphBound.bounds, glyphBound.x, glyphBound.y);
			}

			applyStyle(ctx, config);
			path.draw(ctx);
			if(pattern){
				ctx.fillStyle = ctx.createPattern(pattern, 'repeat');
			}
			if(config.fill || config.pattern){
				ctx.fill();
			}
			if(config.strokeStyle){
				if(typeof config.strokeStyle === "string"){
					ctx.strokeStyle = config.strokeStyle;
				}else{
					ctx.strokeStyle = createGradient(ctx, config.strokeStyle, glyphBound.bounds, glyphBound.x, glyphBound.y);
				}
				ctx.lineWidth = config.lineWidth;
				ctx.stroke();
			}
		});
	}

	function applyStyle(ctx, style){
		["lineStyle", "lineWidth", "lineCap", "lineJoin"].forEach(function(property){
			ctx[property] = style[property] ? style[property] : null;
		});

		if(style.lineDash){
			ctx.setLineDash(style.lineDash);
		}
	}

	function getFontdata(path, chars, done){
		var font = opentype.load(path, function(err, font){
			if(err){
				throw err;
			}
			done({
				fontFamily: font.names.fontFamily.en,
				bold: /bold/i.test(font.names.fontSubfamily.en),
				italic: /italic/i.test(font.names.fontSubfamily.en),
				glyphs: font.stringToGlyphs(chars)
			});
		});
	}

	function generate(canvas, config, done){
		 getFontdata(config.font, config.glyphs, function(fontData){
			fontData.size = config.size;

			var bounds = getGlyphBounds(fontData.glyphs, config.size);
			bounds = orderBounds(config.width, config.height, config.padding, bounds);

			var description = describeBounds(config.width, config.height, fontData, config, bounds);

			if(config.pattern){
				loadImage(config.pattern, function(image){
					drawGlyphs(canvas, config.width, config.height, bounds, config, image);
					done(description);
				})
			}else{
				drawGlyphs(canvas, config.width, config.height, bounds, config);
				done(description);
			}
		});
	}

	return generate;
}