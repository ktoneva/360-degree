import puppeteerCore, { type Browser } from "puppeteer-core";

declare global {
  // eslint-disable-next-line no-var
  var __reportPdfBrowser: Browser | undefined;
}

/**
 * Vercel's serverless functions run Amazon Linux, which needs the purpose-
 * built Chromium binary from @sparticuz/chromium -- puppeteer's own default
 * download doesn't run there. Local development has no such binary for
 * Windows/macOS, so it falls back to whatever Chrome the full `puppeteer`
 * devDependency downloaded for this machine (or an explicit override).
 */
async function launchBrowser(): Promise<Browser> {
  const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

  if (isServerless) {
    const chromium = (await import("@sparticuz/chromium")).default;
    return puppeteerCore.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }

  const executablePath =
    process.env.PUPPETEER_EXECUTABLE_PATH ?? (await (await import("puppeteer")).default.executablePath());
  return puppeteerCore.launch({ executablePath, headless: true });
}

/** Reuses one browser instance across requests in the same warm serverless
 * container instead of paying Chromium's startup cost every time -- relaunches
 * if the cached instance has disconnected or crashed. */
async function getBrowser(): Promise<Browser> {
  if (globalThis.__reportPdfBrowser?.connected) {
    return globalThis.__reportPdfBrowser;
  }
  const browser = await launchBrowser();
  globalThis.__reportPdfBrowser = browser;
  return browser;
}

function parseCookieHeader(cookieHeader: string, url: string): { name: string; value: string; url: string }[] {
  return cookieHeader
    .split(";")
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const eq = pair.indexOf("=");
      return { name: pair.slice(0, eq), value: pair.slice(eq + 1), url };
    });
}

/**
 * Renders the given app URL to a PDF by having a real headless browser visit
 * it, rather than re-implementing the page's markup separately (Next.js
 * itself refuses to bundle react-dom/server inside an App Route). This means
 * every existing print rule already on the page -- the print:hidden admin
 * chrome and Download button, the report's own "Page X of Y" -- applies
 * exactly as it does when a reader presses Ctrl+P today, with no separate
 * copy of that logic to keep in sync. The incoming request's session
 * cookies are carried over so the (protected) layout's own auth check sees
 * the same signed-in admin, not an anonymous visitor bounced to
 * /admin/login -- if it still lands on /admin/login (a stale or missing
 * session), that's treated as a failure rather than silently producing a
 * PDF of the login page.
 */
export async function renderUrlToPdf(url: string, cookieHeader: string | null): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    if (cookieHeader) {
      await page.setCookie(...parseCookieHeader(cookieHeader, url));
    }
    await page.goto(url, { waitUntil: "networkidle0" });
    if (new URL(page.url()).pathname === "/admin/login") {
      throw new Error("Not authenticated for PDF export");
    }
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      displayHeaderFooter: false,
      margin: { top: "0.4in", bottom: "0.4in", left: "0.3in", right: "0.3in" },
    });
    return Buffer.from(pdf);
  } finally {
    await page.close();
  }
}
