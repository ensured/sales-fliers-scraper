import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

interface ScrapeResult {
    success: boolean;
    message: string;
    timestamp: string;
    screenshot?: string;
    error?: string;
    pdfData?: string;
    pdfFileName?: string;
    nationalCoopPdfData?: string;
    nationalCoopPdfFileName?: string;
    nationalCoopLink?: string;
    mainFlyerLink?: string;
}

// Helper function to check for cached files
function checkCachedFiles(downloadsDir: string, today: Date) {
    let cachedPdfData = null;
    let cachedPdfFileName = null;
    let cachedNationalCoopPdfData = null;
    let cachedNationalCoopPdfFileName = null;

    const existingFiles = fs.readdirSync(downloadsDir).filter(file => file.endsWith('.pdf'));

    for (const file of existingFiles) {
        const filePath = path.join(downloadsDir, file);
        const stats = fs.statSync(filePath);
        const fileDate = new Date(stats.mtime);

        // Use file if it's from today
        if (fileDate.toDateString() === today.toDateString()) {
            const fileData = fs.readFileSync(filePath, 'base64');

            // Determine file type by filename (decode URL-encoded characters)
            const decodedFile = decodeURIComponent(file.toLowerCase());
            if (decodedFile.includes('coop') || decodedFile.includes('co+op')) {
                cachedNationalCoopPdfData = fileData;
                cachedNationalCoopPdfFileName = file;
                console.log(`Using cached National Co-op PDF: ${file}`);
            } else {
                cachedPdfData = fileData;
                cachedPdfFileName = file;
                console.log(`Using cached main flyer PDF: ${file}`);
            }
        }
    }

    return { cachedPdfData, cachedPdfFileName, cachedNationalCoopPdfData, cachedNationalCoopPdfFileName };
}

// Helper function to extract filename from URL and clean it
function extractFilename(url: string, defaultName: string): string {
    const urlFileName = url.split('/').pop() || defaultName;
    return decodeURIComponent(urlFileName);
}

// Helper function to download PDF with fallback
async function downloadPdf(url: string, filePath: string): Promise<Buffer | null> {
    try {
        const pdfFetchResponse = await fetch(url);
        if (pdfFetchResponse.ok) {
            return Buffer.from(await pdfFetchResponse.arrayBuffer());
        }
    } catch (fetchError) {
        console.error('Fetch download failed, trying Puppeteer:', fetchError);
    }
    return null;
}

// Helper function to download PDF via Puppeteer (fallback)
async function downloadPdfViaPuppeteer(page: any, url: string): Promise<Buffer | null> {
    try {
        const pdfResponse = await page.goto(url, { waitUntil: 'networkidle2' });
        if (pdfResponse) {
            const pdfBuffer = await pdfResponse.buffer();
            return pdfBuffer && pdfBuffer.length > 1000 ? pdfBuffer : null;
        }
    } catch (error) {
        console.error('Puppeteer download failed:', error);
    }
    return null;
}

// Helper function to create response
function createResponse(
    success: boolean,
    message: string,
    pdfData?: string | null,
    pdfFileName?: string | null,
    nationalCoopPdfData?: string | null,
    nationalCoopPdfFileName?: string | null,
    mainFlyerLink?: string | null,
    nationalCoopLink?: string | null,
    error?: string
) {
    return NextResponse.json({
        success,
        message,
        timestamp: new Date().toISOString(),
        pdfData: pdfData ? `data:application/pdf;base64,${pdfData}` : null,
        pdfFileName,
        nationalCoopPdfData: nationalCoopPdfData ? `data:application/pdf;base64,${nationalCoopPdfData}` : null,
        nationalCoopPdfFileName,
        mainFlyerLink,
        nationalCoopLink,
        error
    }, error ? { status: 500 } : undefined);
}

export async function POST() {
    let browser;
    try {
        // Check for cached files first before scraping
        const downloadsDir = path.join(process.cwd(), 'public', 'downloads');
        if (!fs.existsSync(downloadsDir)) {
            fs.mkdirSync(downloadsDir, { recursive: true });
        }

        const today = new Date();
        const cachedFiles = checkCachedFiles(downloadsDir, today);

        // If we have cached files from today, extract URLs without scraping
        if (cachedFiles.cachedPdfData || cachedFiles.cachedNationalCoopPdfData) {
            let mainFlyerLink = null;
            let nationalCoopLink = null;

            // Try to extract URLs from cached filenames
            if (cachedFiles.cachedPdfFileName) {
                const decodedFileName = decodeURIComponent(cachedFiles.cachedPdfFileName);
                // Extract URL pattern from filename if it contains the date pattern
                if (decodedFileName.includes('%20to%20')) {
                    mainFlyerLink = `https://ashlandfood.coop/wp-content/uploads/sales-flyers/${cachedFiles.cachedPdfFileName}`;
                }
            }

            if (cachedFiles.cachedNationalCoopPdfFileName) {
                const decodedFileName = decodeURIComponent(cachedFiles.cachedNationalCoopPdfFileName);
                if (decodedFileName.includes('Co%2Bop_Deals')) {
                    nationalCoopLink = `https://ashlandfood.coop/wp-content/uploads/sales-flyers/${cachedFiles.cachedNationalCoopPdfFileName}`;
                }
            }

            return createResponse(
                true,
                'Successfully loaded cached Ashland Food Coop flyers',
                cachedFiles.cachedPdfData,
                cachedFiles.cachedPdfFileName,
                cachedFiles.cachedNationalCoopPdfData,
                cachedFiles.cachedNationalCoopPdfFileName,
                mainFlyerLink,
                nationalCoopLink
            );
        }

        // No cached files from today, proceed with scraping
        console.log('No cached files found from today, proceeding with scraping...');
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();

        // Navigate to the Ashland Food Coop sales flyer page
        await page.goto('https://ashlandfood.coop/sales-flyer', {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        // Extract the National Co-op Grocers PDF link
        const nationalCoopLink = await page.evaluate(() => {
            const linkElement = document.querySelector('a[href*="Co%2Bop_Deals"]') as HTMLAnchorElement;
            return linkElement ? linkElement.href : null;
        });

        // Extract the main sales flyer PDF link (if available)
        const mainFlyerLink = await page.evaluate(() => {
            // Look for direct PDF links in sales-flyers directory
            const linkElement = document.querySelector('a[href*="sales-flyers"]') as HTMLAnchorElement;
            return linkElement ? linkElement.href : null;
        });

        // Download the main flyer PDF if available
        let pdfData = null;
        let pdfFileName = null;

        if (mainFlyerLink) {
            try {
                pdfFileName = extractFilename(mainFlyerLink, 'ashland-flyer.pdf');
                const filePath = path.join(downloadsDir, pdfFileName);

                // Check if file already exists and is from today
                let shouldDownload = true;
                if (fs.existsSync(filePath)) {
                    const stats = fs.statSync(filePath);
                    const fileDate = new Date(stats.mtime);

                    // Check if file is from today (same day)
                    if (fileDate.toDateString() === today.toDateString()) {
                        console.log(`Using existing ${pdfFileName} from today`);
                        pdfData = fs.readFileSync(filePath, 'base64');
                        shouldDownload = false;
                    }
                }

                // Download only if needed (new day or file doesn't exist)
                if (shouldDownload) {
                    let pdfBuffer = await downloadPdf(mainFlyerLink, filePath);

                    if (!pdfBuffer) {
                        // Fallback to Puppeteer method
                        pdfBuffer = await downloadPdfViaPuppeteer(page, mainFlyerLink);
                    }

                    if (pdfBuffer) {
                        fs.writeFileSync(filePath, pdfBuffer);
                        pdfData = fs.readFileSync(filePath, 'base64');
                        console.log(`PDF downloaded and saved to: ${filePath}`);
                    }
                }

            } catch (pdfError) {
                console.error('Failed to download PDF:', pdfError);
            }
        }

        // Download the National Co-op PDF if available
        let nationalCoopPdfData = null;
        let nationalCoopPdfFileName = null;

        if (nationalCoopLink) {
            try {
                nationalCoopPdfFileName = extractFilename(nationalCoopLink, 'national-coop.pdf');
                const filePath = path.join(downloadsDir, nationalCoopPdfFileName);

                // Check if file already exists and is from today
                let shouldDownload = true;
                if (fs.existsSync(filePath)) {
                    const stats = fs.statSync(filePath);
                    const fileDate = new Date(stats.mtime);

                    // Check if file is from today (same day)
                    if (fileDate.toDateString() === today.toDateString()) {
                        console.log(`Using existing ${nationalCoopPdfFileName} from today`);
                        nationalCoopPdfData = fs.readFileSync(filePath, 'base64');
                        shouldDownload = false;
                    }
                }

                // Download only if needed (new day or file doesn't exist)
                if (shouldDownload) {
                    let pdfBuffer = await downloadPdf(nationalCoopLink, filePath);

                    if (!pdfBuffer) {
                        // Fallback to Puppeteer method
                        pdfBuffer = await downloadPdfViaPuppeteer(page, nationalCoopLink);
                    }

                    if (pdfBuffer) {
                        fs.writeFileSync(filePath, pdfBuffer);
                        nationalCoopPdfData = fs.readFileSync(filePath, 'base64');
                        console.log(`National Co-op PDF downloaded and saved to: ${filePath}`);
                    }
                }

            } catch (pdfError) {
                console.error('Failed to download National Co-op PDF:', pdfError);
            }
        }

        await browser.close();

        return createResponse(
            true,
            (pdfData || nationalCoopPdfData) ? 'Successfully downloaded Ashland Food Coop flyers' : 'Successfully scraped Ashland Food Coop flyer',
            pdfData,
            pdfFileName,
            nationalCoopPdfData,
            nationalCoopPdfFileName,
            mainFlyerLink,
            nationalCoopLink
        );

    } catch (error) {
        if (browser) {
            await browser.close();
        }

        console.error('Scraping error:', error);
        return createResponse(
            false,
            'Failed to scrape Ashland Food Coop flyer',
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            error instanceof Error ? error.message : 'Unknown error'
        );
    }
}
