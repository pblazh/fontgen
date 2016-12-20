#! /usr/bin/env node
(function main(){
	"use strict";

	var process = require("process");
	var fs = require("fs");
	var Canvas = require("canvas");
	var fontgen = require("./fontgen");

	var CANNOT_PARSE_CONFIG_FILE = 2;
	var CANNOT_READ_FONT_FILE = 3;
	var CANNOT_FIT_BOUNDS = 4;

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

	function loadImage(path, done){
		var imageData = fs.readFileSync(path);
		var img = new Canvas.Image();
		img.src = imageData;
		done(img);
	};

	function generate(config){
		var generate = fontgen(loadImage);
		var canvas = new Canvas(config.width, config.height);
		try{
			generate(canvas, config, function(fnt){
				savePng(canvas, config.png);
				saveFnt(fnt, config.fnt);
			});
		}catch(err){
			console.log( err);
		}
	}

	function parseConfig(config){
		if(config){
			var conf;
			try{
				conf = fs.readFileSync(config, "utf8");
			}catch(err){
				if (err.code === "ENOENT") {
					exit(CANNOT_READ_CONFIG_FILE)
				} else {
					throw err;
				}
			}
			try{
				return  JSON.parse(conf);
			}catch(err){
				exit(CANNOT_PARSE_CONFIG_FILE)
			}

		}
		return {};
	}
	function exit(reason){
		switch(reason){
			case CANNOT_READ_CONFIG_FILE:
				console.error('config does not exist');
				break;
			case CANNOT_READ_FONT_FILE:
				console.error('font does not exist');
				break;
			case CANNOT_FIT_BOUNDS:
				console.error('can not fit all glyphs');
				break;
		}
		process.exit(0);
	}

	var GLYPHS = " $лвRCHF¥Kčkr€£nt₪₹Lzłleiบาท₤₺,.-1234567890+:∞%abcdfghjmopqsuvwxyABDEGIJMNOPQSTUVWXYZ!№;?*()_=/|'@#^&{}[]\" ";
	var config = {
		glyphs : GLYPHS,
		png: "font.png",
		fnt: "font.fnt",
		name: "font",
		size : 72,
		width : 256,
		height : 256,
		uppercase : false,
		lineStyle: null,
		lineWidth: null,
		fill: "black",
		lineCap: "round",
		lineJoin: "round",
		letterSpacing: 0,
		lineSpacing: 0,
		lineDash: null,
		pattern: null,
		strokeStyle: null,
		padding : {
			top: 0,
			right: 0,
			bottom: 0,
			left: 0
		}
	};

	var argv = require("yargs")
		.usage("Usage: $0 [--dump ][--glyphs glyphs] [--size size] [--width width] [--height height] [--name face] [--fill color] [--config config] [--out-fnt fnt] [--out-png png] [path_to_font]")
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
		.alias("f", "fill")
		.argv;


	Object.assign(config, argv);
	Object.assign(config, parseConfig(config.config));
	Object.assign(config, argv);

	if(argv._.length){
		config.font = argv._[0];
	}

	if(argv.dump){
		console.log(JSON.stringify(config));
		exit(0);
		return;
	}
	generate(config);

}());
