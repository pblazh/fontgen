#generate bitmap font from the ttf

```sh
Usage: fontgen [--glyphs glyphs] [--size size] [--width width] [--height
height] [--name face] [--fill color] [--config config] [--out out]
[path_to_font]

Options:
  -h, --help, --height  Show help                       [boolean] [default: 256]
  -o, --out                                                    [default: "font"]
  -n, --name                                                   [default: "font"]
  -s, --size                                                       [default: 72]
  -w, --width                                                     [default: 256]
  -u, --uppercase                                     [boolean] [default: false]
  -g, --glyphs                                                       [default: "
  $лвRCHF¥Kčkr€£nt₪₹Lzłleiบาท₤₺,.-1234567890+:∞%abcdfghjmopqsuvwxyABDEGIJMNOPQST
                                                 UVWXYZ!№;?*()_=/|'@#^&{}[]\" "]

Examples:
  ../index.js --glyphs 'abc' --uppercase    generate bitmap font for abcABC and
  font.ttf                                  store it to the font.png and
                                            font.fnt
```
