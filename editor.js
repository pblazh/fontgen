(function editor() {
    "use strict";
    var fontgen = require("./fontgen");
	var generator = fontgen(loadImage);

    var canvas = document.getElementById("canvas");
    var buttonLoad = document.getElementById("load");
    var buttonApply = document.getElementById("apply");
    var stdout = document.getElementById("stdout");

    function loadImage(path, done) {
        var img = new Image();
        img.src = path;
		img.addEventListener("load", function(){
			done(img);
		});
    };

    function generate(config) {
        canvas.width = config.width;
        canvas.height = config.height;
        generator(canvas, config, function(fnt) {
			stdout.value = fnt;
        });
    }

    function loadConfig(e) {
        var file = e.target.files[0];
        if (!file) {
            return;
        }
        var reader = new FileReader();
        reader.onload = function(e) {
			if(e.type === "error"){
				exit(CANNOT_READ_CONFIG_FILE)
			}
			parseConfig(e.target.result);
        };
        reader.readAsText(file);
    }

    function applyConfig() {
		parseConfig(stdin.value);
	}

    function parseConfig(text) {
		var config;
		try{
			stdin.value = text;
			config = JSON.parse(text);
		}catch(err){
			exit(CANNOT_PARSE_CONFIG_FILE)
		}
		Object.assign(defaultConfig, config);
		generate(config);
    }

    function exit(reason) {
        switch (reason) {
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
    }


    var defaultConfig = {
        glyphs: "abc",
        font: "Roboto-Bold.ttf",
        out: "font",
        name: "font",
        size: 72,
        width: 256,
        height: 256,
        uppercase: false,
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
        padding: {
            top: 0,
            right: 0,
            bottom: 0,
            left: 0
        }
    };
    generate(defaultConfig);

    buttonLoad.addEventListener("change", loadConfig);
    buttonApply.addEventListener("click", applyConfig);
}())
