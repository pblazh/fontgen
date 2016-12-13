(function fontgen(){

	var fs = require("fs");

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

	function prepareChars(chars, upperCase){
		chars = uniq(chars.split("")).join("");
		return upperCase
			? chars.toLowerCase() + chars.toUpperCase()
			: chars;
	}

	function savePng(canvas, outFile){
		var out = fs.createWriteStream(outFile)
		, stream = canvas.pngStream();

		stream.on("data", function(chunk){
			out.write(chunk);
		});
	}

	function saveFnt(text, outFile){
		var fs = require("fs");
		fs.writeFile(outFile, text, function(err) {
			if(err) {
				return console.log(err);
			}
		});
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
			return glyphBound;
		});


		return glyphBounds;
	}

	function describeBounds(width, height, fontData, name, style, bounds){
		var data = bounds.map(function(glyphBound){
			return {
				//id: glyphBound.glyph.index,
				id: glyphBound.glyph.unicode,
				letter: glyphBound.glyph.name,
				x: Math.round(glyphBound.x),
				y: Math.round(glyphBound.y),
				xoffset: Math.round(glyphBound.bounds.x),
				yoffset: Math.round(glyphBound.bounds.y),
				width: Math.round(glyphBound.bounds.width),
				height: Math.round(glyphBound.bounds.height),
				xadvance: Math.round(((glyphBound.bounds.x + glyphBound.bounds.width - glyphBound.padding.right) / glyphBound.glyph.xMax) * glyphBound.glyph.advanceWidth),
				page: 0,
				chnl: 15
			};
		});

		var baseLine = -Math.round(bounds.map(prop("bounds.y")).sort(compareNumbers).shift());

		return [
			"<font>",
			"    <info face='" + name + "' ",
			"          size='" + fontData.size + "' ",
			"          bold='" + (fontData.bold ? "1" : "0") + "' ",
			"          italic='" + (fontData.italic ? "1" : "0") + "' ",
			"          padding='" + style.padding.top + "," + style.padding.right + "," + style.padding.bottom + "," + style.padding.left + "' ",
			"          charset='' unicode='' stretchH='100' smooth='1' aa='1' spacing='0,0' outline='0'/>",
			"    <common lineHeight='95' ",
			"            base='" + baseLine + "' ",
			"            scaleW='" + width + "' ",
			"            scaleH='" + height + "' ",
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

	function drawGlyphs(width, height, bounds, style){
		var Canvas = require("canvas")
		, canvas = new Canvas(width, height)
		, ctx = canvas.getContext("2d");

		ctx.shadowColor = style.shadowColor;
		ctx.shadowBlur = style.shadowBlur;
		ctx.shadowOffsetX = style.shadowOffsetX;
		ctx.shadowOffsetY = style.shadowOffsetY;


		bounds.forEach(function(glyphBound){
			var path = glyphBound.glyph.getPath(glyphBound.x - glyphBound.bounds.x, glyphBound.y - glyphBound.bounds.y, glyphBound.size);
			Object.assign(path, style);
			path.draw(ctx);
		});

		ctx.shadowColor = null;
		ctx.shadowBlur = null;
		ctx.shadowOffsetX = null;
		ctx.shadowOffsetY = null;

		bounds.forEach(function(glyphBound){
			var path = glyphBound.glyph.getPath(glyphBound.x - glyphBound.bounds.x, glyphBound.y - glyphBound.bounds.y, glyphBound.size);
			Object.assign(path, style);

			if(typeof style.fill === "string"){
				path.draw(ctx);
			}else{
				path.fill = null;
				path.stroke = null;

				var gradient;
				if(style.fill.type === "linear"){
					gradient = ctx.createLinearGradient(glyphBound.x + style.fill.x0, glyphBound.y + style.fill.y0, glyphBound.x + style.fill.x1, glyphBound.y + style.fill.y1);
				}else if(style.fill.type === "radial"){
					gradient = ctx.createRadialGradient(glyphBound.x + style.fill.x0, glyphBound.y + style.fill.y0, style.fill.r0, glyphBound.x + style.fill.x1, glyphBound.y + style.fill.y1, style.fill.r1 );
				}

				style.fill.colors.forEach(function(color){
					gradient.addColorStop.apply(gradient, color);
				});
				ctx.fillStyle = gradient;

				path.draw(ctx);
				ctx.fill();
			}
		});
		return canvas;
	}

	function getFontdata(path, chars){
		var opentype = require("opentype.js");

		var font = opentype.loadSync(path);
		return {
			fontFamily: font.names.fontFamily.en,
			bold: /bold/i.test(font.names.fontSubfamily.en),
			italic: /italic/i.test(font.names.fontSubfamily.en),
			glyphs: font.stringToGlyphs(chars)
		};
	}

	function process(argv, style){
		var font = argv._[0];
		var chars = prepareChars(argv.chars, argv.uppercase);

		var size = argv.size;
		var width = argv.width;
		var height = argv.height;

		var fontData = getFontdata(font, chars);
		fontData.size = size;

		var bounds = getGlyphBounds(fontData.glyphs, size);
		bounds = orderBounds(width, height, style.padding, bounds);

		var canvas = drawGlyphs(width, height, bounds, style);
		savePng(canvas, argv.out + ".png");

		var description = describeBounds(width, height, fontData, argv.name, style, bounds);
		saveFnt(description, argv.out + ".fnt");
	}

	function main(){
		var CHARS = " $лвRCHF¥Kčkr€£nt₪₹Lzłleiบาท₤₺,.-1234567890+:∞%abcdfghjmopqsuvwxyABDEGIJMNOPQSTUVWXYZ!№;?*()_=/|'@#^&{}[]\" ";
		var argv = require("yargs")
			.usage("Usage: $0 [--chars chars] [--size size] [--width width] [--height height] [--name face] [--fill color] [--style style] [--out out] path_to_font")
			.example("$0 --chars 'abc' --uppercase font.ttf", "generate bitmap font for abcABC and store it to the font.png and font.fnt")
			.boolean("uppercase")
			.alias("w", "width")
			.alias("h", "height")
			.alias("s", "size")
			.alias("c", "chars")
			.alias("u", "uppercase")
			.alias("n", "name")
			.alias("o", "out")
			.alias("f", "fill")
			.default({
				out: "font",
				name: "font",
				size : 72,
				width : 256,
				height : 256,
				uppercase : false,
				chars : CHARS
			})
			.demand(1).argv;

		var style = {
			fill: argv.fill,
			padding : {
				top: 0,
				right: 0,
				bottom: 0,
				left: 0
			}
		};

		if(argv.style){
			var css = fs.readFileSync(argv.style, "utf8");
			Object.assign(style, JSON.parse(css));
		}
		style.fill = argv.fill ? argv.fill : style.fill;

		process(argv, style);
	}
	main();
}());