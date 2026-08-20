const pdfMake = require('pdfmake');
const roboto = require('pdfmake/build/fonts/Roboto.js');

for (const [name, font] of Object.entries(roboto.vfs)) {
  pdfMake.virtualfs.writeFileSync(name, font.data, font.encoding);
}
pdfMake.addFonts(roboto.fonts);

async function main() {
  try {
    const doc = pdfMake.createPdf({
      content: [
        { text: 'Testing image' },
        { image: '/api/photos/123/file', width: 240 }
      ],
      defaultStyle: { font: 'Roboto' }
    });
    const buf = await doc.getBuffer();
    console.log('PDF generated! Buffer length:', buf.length);
  } catch (err) {
    console.error('PDF generation crashed:', err.message);
  }
}

main();
