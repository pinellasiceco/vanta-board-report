import puppeteer from 'puppeteer';
import { writeFile } from 'fs/promises';
import logger from '../utils/logger.js';

export async function generatePDF(populatedHtml, outputPath) {
  logger.info('Launching headless browser for PDF generation...');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(populatedHtml, { waitUntil: 'networkidle0' });

    logger.info('Rendering PDF...');
    const pdfBuffer = await page.pdf({
      format: 'Letter',
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      scale: 1,
    });

    await writeFile(outputPath, pdfBuffer);
    logger.info(`PDF saved: ${outputPath}`);
    return outputPath;
  } finally {
    await browser.close();
  }
}
