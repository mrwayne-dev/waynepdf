import { exportPDF } from './exportPDF.js';
import { exportHTML } from './exportHTML.js';
import { isFormatAvailable } from './exportRegistry.js';

/*
 * One entry point for every format.
 *
 * The Header used to hold the whole print flow inline. Routing all three formats
 * through here keeps the button dumb — it knows a format id and a document, not
 * how any of them are produced.
 */
export async function runExport({ format, ...context }) {
  if (!isFormatAvailable(format)) {
    throw new Error(`Export format "${format}" is not available yet.`);
  }

  switch (format) {
    case 'pdf':
      return exportPDF(context);
    case 'html':
      return exportHTML(context);
    case 'docx': {
      // Dynamic, so jszip and the OOXML writer stay out of the main chunk.
      const { exportDOCX } = await import('./docx/index.js');
      return exportDOCX(context);
    }
    default:
      throw new Error(`Unknown export format "${format}".`);
  }
}
