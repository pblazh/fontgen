(function fontgen(){
	"use strict";

	var process = require("process");
	var fs = require("fs");

	var CANNOT_READ_CONFIG_FILE = 1;
	var CANNOT_PARSE_CONFIG_FILE = 2;
	var CANNOT_READ_FONT_FILE = 3;

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

	function drawGlyphs(width, height, bounds, config){
		var Canvas = require("canvas")
		, canvas = new Canvas(width, height)
		, ctx = canvas.getContext("2d");

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
				var gradient;
				if(config.fill.type === "linear"){
					gradient = ctx.createLinearGradient(
						glyphBound.x + config.fill.x0 * glyphBound.bounds.width,
					   	glyphBound.y + config.fill.y0 * glyphBound.bounds.height,
					   	glyphBound.x + config.fill.x1 * glyphBound.bounds.width,
					   	glyphBound.y + config.fill.y1 * glyphBound.bounds.height
					);
				}else if(config.fill.type === "radial"){
					gradient = ctx.createRadialGradient(
						glyphBound.x + config.fill.x0 * glyphBound.bounds.width,
					   	glyphBound.y + config.fill.y0 * glyphBound.bounds.height,
					   	config.fill.r0 * glyphBound.bounds.height,
						glyphBound.x + config.fill.x1 * glyphBound.bounds.width,
						glyphBound.y + config.fill.y1 * glyphBound.bounds.height,
						config.fill.r1 * glyphBound.bounds.height
				   	);
				}

				config.fill.colors.forEach(function(color){
					gradient.addColorStop.apply(gradient, color);
				});

				ctx.fillStyle = gradient;
			}

			applyStyle(ctx, config);
			path.draw(ctx);
			if(config.fill){
				ctx.fill();
			}
			if(config.lineStyle){
				ctx.stroke();
			}
		});

		return canvas;
	}

	function applyStyle(ctx, style){
		["lineStyle", "lineWidth", "lineCap", "lineJoin"].forEach(function(property){
			ctx[property] = style[property] ? style[property] : null;
		});

		if(style.lineDash){
			ctx.setLineDash(style.lineDash);
		}
	}

	function getFontdata(path, chars){
		var opentype = require("opentype.js");
		try{
			var font = opentype.loadSync(path);
			return {
				fontFamily: font.names.fontFamily.en,
				bold: /bold/i.test(font.names.fontSubfamily.en),
				italic: /italic/i.test(font.names.fontSubfamily.en),
				glyphs: font.stringToGlyphs(chars)
			};
		}catch(err){
			if (err.code === "ENOENT") {
				console.error(path + ' does not exist');
				require("process").exit(CANNOT_READ_FONT_FILE);
			} else {
				throw err;
			}
		}
	}

	function generate(config){
		var font = config.font;
		var chars = prepareChars(config.glyphs, config.uppercase);

		var size = config.size;
		var width = config.width;
		var height = config.height;

		var fontData = getFontdata(font, chars);
		if(fontData){
			fontData.size = size;

			var bounds = getGlyphBounds(fontData.glyphs, size);
			bounds = orderBounds(width, height, config.padding, bounds);

			var canvas = drawGlyphs(width, height, bounds, config);
			savePng(canvas, config.out + ".png");

			var description = describeBounds(width, height, fontData, config, bounds);
			saveFnt(description, config.out + ".fnt");
		}
	}

	function parseConfig(config){
		if(config){
			var conf;
			try{
				conf = fs.readFileSync(config, "utf8");
			}catch(err){
				if (err.code === "ENOENT") {
					console.error(config + ' does not exist');
					process.exit(CANNOT_READ_CONFIG_FILE)
				} else {
					throw err;
				}
			}
			try{
				return  JSON.parse(conf);
			}catch(err){
				console.error( 'failed to parse', config );
				process.exit(CANNOT_PARSE_CONFIG_FILE)
			}
		}
		return {};
	}

	function main(){
		var GLYPHS = " $лвRCHF¥Kčkr€£nt₪₹Lzłleiบาท₤₺,.-1234567890+:∞%abcdfghjmopqsuvwxyABDEGIJMNOPQSTUVWXYZ!№;?*()_=/|'@#^&{}[]\" ";
		var config = {
			glyphs : GLYPHS,
			out: "font",
			name: "font",
			size : 72,
			width : 256,
			height : 256,
			uppercase : false,
			lineStyle: null,
			fill: "black",
			lineCap: "round",
			lineJoin: "round",
			letterSpacing: 0,
			lineSpacing: 0,
			lineDash: null,
			padding : {
				top: 0,
				right: 0,
				bottom: 0,
				left: 0
			}
		};

		var argv = require("yargs")
			.usage("Usage: $0 [--dump ][--glyphs glyphs] [--size size] [--width width] [--height height] [--name face] [--fill color] [--config config] [--out out] [path_to_font]")
			.example("$0 --glyphs 'abc' font.ttf", "generate bitmap font for abc and store it to the font.png and font.fnt")
			.boolean("dump")
			.help('h')
			.alias('h', 'help')
			.alias("W", "width")
			.alias("H", "height")
			.alias("s", "size")
			.alias("g", "glyphs")
			.alias("c", "config")
			.alias("n", "name")
			.alias("o", "out")
			.alias("f", "fill")
			.default({
				out: config.out,
				name: config.name,
				size : config.size,
				width : config.width,
				height : config.height,
				uppercase : config.uppercase,
				glyphs : GLYPHS
			}).argv;


		Object.assign(config, argv);
		Object.assign(config, parseConfig(config.config));
		//Object.assign(config, argv);

		if(argv._.length){
			config.font = argv._[0];
		}

		if(argv.dump){
			console.log(JSON.stringify(config));
			process.exit(0);
		}

		generate(config);
	}
	main();
}());
