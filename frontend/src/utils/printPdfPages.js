/** Render authenticated PDF bytes as images; no customer text is inserted into print HTML. */
export async function printPdfPages(pdf, popup, options = {}) {
  popup.document.open();
  popup.document.write('<!doctype html><html><head><title>Customer KYC</title><style>body{margin:0;background:white}.page{break-after:page;page-break-after:always}.page:last-child{break-after:auto;page-break-after:auto}img{display:block;width:100%}@page{size:A4;margin:0}</style></head><body></body></html>');
  popup.document.close();
  if(options.title)popup.document.title=options.title;
  for (let number = 1; number <= pdf.numPages; number++) {
    const page = await pdf.getPage(number);
    const viewport = page.getViewport({ scale: options.scale || 1.5 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width; canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    const section = popup.document.createElement('div'); section.className = 'page';
    const image = popup.document.createElement('img');
    image.alt = `${options.pageLabel || "KYC page"} ${number}`; image.src = canvas.toDataURL('image/png');
    section.appendChild(image); popup.document.body.appendChild(section);
    await image.decode();
  }
  popup.focus(); popup.print();
}
