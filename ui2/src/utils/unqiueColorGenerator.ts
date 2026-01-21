enum ColorPaletteEnum {
    Main = "main",
}

// const mainPalette = [
//     "#FF5733",
//     "#33FF57",
//     "#3357FF",
//     "#F333FF",
//     "#33FFF5",
//     "#F5FF33",
// ];

const p1 = ["#ffadad","#ffd6a5","#fdffb6","#caffbf","#9bf6ff","#a0c4ff","#bdb2ff","#ffc6ff","#fffffc"];
// const p2 = ["#f94144","#f3722c","#f8961e","#f9844a","#f9c74f","#90be6d","#43aa8b","#4d908e","#577590","#277da1"]
const p2 = ["#f94144","#f3722c","#f8961e","#f9c74f","#90be6d","#277da1"]
const p3 = ["#1d3e3b","#3f3f2c","#1d2d44","#a64253","#2e005d","#006d77"]

const palettes: Record<
    ColorPaletteEnum,
    { lastColor: string; palette: [string[], string[]] }
> = {
    [ColorPaletteEnum.Main]: { lastColor: "", palette: [p3, p2] },
};

export function getUniqueColor(
    palette: ColorPaletteEnum = ColorPaletteEnum.Main,
): string {
    const [lightPallete, darkPalette] = palettes[palette].palette;
    const darkMode =
        document.documentElement.getAttribute("data-theme") === "dark";
    const colors = darkMode
        ? { ...palettes[palette], palette: darkPalette }
        : { ...palettes[palette], palette: lightPallete };
    let nextColor =
        colors.palette[Math.floor(Math.random() * colors.palette.length)];
    while (nextColor === colors.lastColor) {
        nextColor =
            colors.palette[Math.floor(Math.random() * colors.palette.length)];
    }
    colors.lastColor = nextColor;
    return nextColor;
}
