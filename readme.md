#generate bitmap font from the ttf

```sh
Usage: index.js [--chars chars] [--size size] [--width width] [--height height]
[--name face] [--fill color] [--style style] [--out out] path_to_font

Options:
  -o, --out                                                    [default: "font"]
  -n, --name                                                   [default: "font"]
  -s, --size                                                       [default: 72]
  -w, --width                                                     [default: 256]
  -h, --height                                                    [default: 256]
  -u, --uppercase                                     [boolean] [default: false]
  -c, --chars                                                        [default: "
  $лвRCHF¥Kčkr€£nt₪₹Lzłleiบาท₤₺,.-1234567890+:∞%abcdfghjmopqsuvwxyABDEGIJMNOPQST
                                                 UVWXYZ!№;?*()_=/|'@#^&{}[]\" "]

Examples:
  index.js --chars 'abc' --uppercase        generate bitmap font for abcABC and
  font.ttf                                  store it to font.png and font.fnt
```
