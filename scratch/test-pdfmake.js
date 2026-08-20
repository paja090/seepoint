const pdfMake = require('pdfmake');
const roboto = require('pdfmake/build/fonts/Roboto.js');

for (const [name, font] of Object.entries(roboto.vfs)) {
  pdfMake.virtualfs.writeFileSync(name, font.data, font.encoding);
}
pdfMake.addFonts(roboto.fonts);

console.log('Testing pdfMake getBuffer()...');
const doc = pdfMake.createPdf({
  content: [{ text: 'Hello World' }],
  defaultStyle: { font: 'Roboto' }
});

const res = doc.getBuffer();
console.log('Direct call result:', res);

doc.getBuffer((buf) => {
  console.log('Callback result Buffer length:', buf ? buf.length : 0);
});
