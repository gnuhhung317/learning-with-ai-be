const PDFDocument = require('pdfkit');
const pdf = require('pdf-parse');
const { Buffer } = require('buffer');

class PDFService {
  validatePDFFile(file) {
    return file.mimetype === 'application/pdf';
  }

  async extractContent(file) {
    try {
      console.log('Starting PDF content extraction...');
      const buffer = file.buffer;
      
      // Extract text using pdf-parse
      const data = await pdf(buffer);
      const extractedText = data.text;
      
      if (!extractedText) {
        throw new Error('No content found in PDF');
      }

      console.log('PDF text extracted successfully');
      return this.processText(extractedText);
    } catch (error) {
      console.error('Error in PDF content extraction:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error(`Failed to extract PDF content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  createDocument() {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
      lang: 'vi',
      autoFirstPage: true,
      info: {
        Producer: 'PDF Service',
        Creator: 'Quiz Generator',
        CreationDate: new Date()
      }
    });
    doc.registerFont('Roboto', './Roboto-Regular.ttf');
    doc.font('Roboto');
    return doc;
  }

  processText(text) {
    return text
      .replace(/\s+/g, ' ')
      .trim();
  }
}

module.exports = { PDFService };