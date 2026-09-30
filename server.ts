import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_N8N_FORM_URL =
  'https://sailakshmiporeddy.app.n8n.cloud/form/ceba5cd6-5c01-45e6-9ff2-922e714c5fed';

interface ParsedFormField {
  id: string;
  name: string;
  label: string;
  type: string;
  required: boolean;
  multiple: boolean;
  placeholder: string;
}

function parseN8nFormHtml(html: string) {
  const titleMatch =
    html.match(/<div class=['"]form-header['"]>\s*<h1>([\s\S]*?)<\/h1>/i) ||
    html.match(/<title>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : 'Resume Analyzer';

  const descMatch = html.match(
    /<div class=['"]form-header['"]>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i
  );
  const description = descMatch ? descMatch[1].trim() : '';

  const useResponseDataMatch = html.match(
    /id=["']useResponseData["'][^>]*value=["']?([^"'\s/>]+)["']?/i
  );
  const useResponseData = useResponseDataMatch
    ? useResponseDataMatch[1] === 'true'
    : false;

  const fields: ParsedFormField[] = [];
  const groupRegex =
    /<div class=['"]form-group[^'"]*['"]>([\s\S]*?)<\/div>/gi;
  let match: RegExpExecArray | null;

  while ((match = groupRegex.exec(html)) !== null) {
    const block = match[1];
    const labelMatch = block.match(/<label[^>]*>([\s\S]*?)<\/label>/i);
    const inputMatch = block.match(/<(input|textarea|select)\s+([\s\S]*?)\/?>/i);
    if (!inputMatch) continue;

    const attrs = inputMatch[2];
    const getAttr = (attrName: string) => {
      const m = attrs.match(new RegExp(`${attrName}=['"]([^'"]*)['"]`, 'i'));
      return m ? m[1] : '';
    };

    const id = getAttr('id') || getAttr('name') || `field-${fields.length}`;
    const name = getAttr('name') || id;
    const type =
      inputMatch[1].toLowerCase() === 'textarea'
        ? 'textarea'
        : inputMatch[1].toLowerCase() === 'select'
          ? 'select'
          : getAttr('type') || 'text';
    const required =
      attrs.includes('form-required') ||
      (labelMatch ? labelMatch[0].includes('form-required') : false);
    const multiple = /\bmultiple\b/i.test(attrs);
    const placeholder = getAttr('placeholder');

    fields.push({
      id,
      name,
      label: labelMatch ? labelMatch[1].trim() : name,
      type,
      required,
      multiple,
      placeholder,
    });
  }

  return {
    title,
    description,
    useResponseData,
    fields:
      fields.length > 0
        ? fields
        : [
            {
              id: 'field-0',
              name: 'field-0',
              label: 'Name',
              type: 'text',
              required: true,
              multiple: false,
              placeholder: '',
            },
            {
              id: 'field-1',
              name: 'field-1',
              label: 'Email',
              type: 'email',
              required: true,
              multiple: false,
              placeholder: '',
            },
            {
              id: 'field-2',
              name: 'field-2',
              label: 'Upload resume',
              type: 'file',
              required: true,
              multiple: true,
              placeholder: '',
            },
          ],
  };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // 1. Inspect n8n form schema & live connectivity
  app.get('/api/n8n/inspect', async (req, res) => {
    const targetUrl =
      typeof req.query.url === 'string' && req.query.url.trim().startsWith('http')
        ? req.query.url.trim()
        : DEFAULT_N8N_FORM_URL;

    const startTime = Date.now();
    try {
      const response = await fetch(targetUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'ResumeAnalyzerStudio/1.0 (n8n-Form-Client)',
          Accept: 'text/html,application/xhtml+xml',
        },
      });
      const latencyMs = Date.now() - startTime;
      const html = await response.text();
      const parsed = parseN8nFormHtml(html);

      res.json({
        ok: response.ok,
        status: response.status,
        latencyMs,
        targetUrl,
        host: new URL(targetUrl).host,
        formId: targetUrl.split('/').pop() || 'ceba5cd6-5c01-45e6-9ff2-922e714c5fed',
        ...parsed,
        checkedAt: new Date().toISOString(),
      });
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      res.status(502).json({
        ok: false,
        status: 502,
        latencyMs,
        targetUrl,
        error:
          error instanceof Error
            ? error.message
            : 'Unable to reach n8n form endpoint.',
      });
    }
  });

  // 2. Submit multipart/form-data payload directly to n8n form endpoint
  app.post(
    '/api/n8n/submit',
    express.raw({ type: () => true, limit: '25mb' }),
    async (req, res) => {
      const headerUrl = req.headers['x-n8n-form-url'];
      const targetUrl =
        typeof headerUrl === 'string' && headerUrl.trim().startsWith('http')
          ? headerUrl.trim()
          : DEFAULT_N8N_FORM_URL;

      const contentType = req.headers['content-type'] || '';
      const startTime = Date.now();

      try {
        const upstreamHeaders: Record<string, string> = {};
        if (contentType) {
          upstreamHeaders['content-type'] = contentType;
        }
        upstreamHeaders['User-Agent'] =
          'ResumeAnalyzerStudio/1.0 (n8n-Form-Proxy)';

        const bodyBuffer = Buffer.isBuffer(req.body)
          ? req.body
          : Buffer.from(req.body || '');

        const upstreamResponse = await fetch(targetUrl, {
          method: 'POST',
          headers: upstreamHeaders,
          body: new Uint8Array(bodyBuffer),
        });

        const durationMs = Date.now() - startTime;
        const responseText = await upstreamResponse.text();

        let parsedJson: Record<string, unknown> | null = null;
        try {
          parsedJson = JSON.parse(responseText);
        } catch {
          parsedJson = null;
        }

        // Extract human-readable confirmation if HTML or JSON is returned
        let message = 'Your resume and candidate profile have been recorded by the n8n workflow.';
        let headerTitle = 'Form Submitted';

        if (parsedJson) {
          if (typeof parsedJson.formSubmittedText === 'string') {
            message = parsedJson.formSubmittedText;
          } else if (typeof parsedJson.message === 'string') {
            message = parsedJson.message;
          }
        } else if (responseText.includes('<')) {
          const h1Match = responseText.match(
            /<h1[^>]*id=['"]submitted-header['"][^>]*>([\s\S]*?)<\/h1>/i
          );
          const pMatch = responseText.match(
            /<p[^>]*id=['"]submitted-content['"][^>]*>([\s\S]*?)<\/p>/i
          );
          if (h1Match) headerTitle = h1Match[1].trim();
          if (pMatch) message = pMatch[1].trim();
        } else if (responseText.trim().length > 0) {
          message = responseText.trim();
        }

        res.status(upstreamResponse.status).json({
          ok: upstreamResponse.ok,
          status: upstreamResponse.status,
          durationMs,
          targetUrl,
          headerTitle,
          message,
          parsedJson,
          rawPreview: responseText.slice(0, 1200),
          redirected: upstreamResponse.redirected,
          finalUrl: upstreamResponse.url,
          submittedAt: new Date().toISOString(),
        });
      } catch (error) {
        const durationMs = Date.now() - startTime;
        res.status(502).json({
          ok: false,
          status: 502,
          durationMs,
          targetUrl,
          headerTitle: 'Submission Error',
          message:
            error instanceof Error
              ? error.message
              : 'Failed to forward multipart submission to n8n endpoint.',
        });
      }
    }
  );

  // 3. Raw pass-through submit for embedded native n8n form iframe
  app.post(
    '/api/n8n/raw-submit',
    express.raw({ type: () => true, limit: '25mb' }),
    async (req, res) => {
      const targetUrl =
        typeof req.query.url === 'string' && req.query.url.trim().startsWith('http')
          ? req.query.url.trim()
          : DEFAULT_N8N_FORM_URL;
      const contentType = req.headers['content-type'] || '';

      try {
        const bodyBuffer = Buffer.isBuffer(req.body)
          ? req.body
          : Buffer.from(req.body || '');

        const upstreamResponse = await fetch(targetUrl, {
          method: 'POST',
          headers: contentType ? { 'content-type': contentType } : {},
          body: new Uint8Array(bodyBuffer),
        });

        const text = await upstreamResponse.text();
        res
          .status(upstreamResponse.status)
          .set(
            'Content-Type',
            upstreamResponse.headers.get('content-type') || 'text/html; charset=utf-8'
          )
          .send(text);
      } catch (error) {
        res.status(502).send('Error submitting to n8n form');
      }
    }
  );

  // 4. Execution status polling proxy for n8n waiting forms
  app.get('/api/n8n/execution-status', async (req, res) => {
    const waitingUrl =
      typeof req.query.waitingUrl === 'string' ? req.query.waitingUrl : '';
    if (!waitingUrl || !waitingUrl.startsWith('http')) {
      res.status(400).json({ ok: false, status: 'invalid-url' });
      return;
    }

    try {
      const urlObj = new URL(waitingUrl);
      if (!urlObj.pathname.endsWith('/n8n-execution-status')) {
        urlObj.pathname = urlObj.pathname.replace(/\/$/, '') + '/n8n-execution-status';
      }
      const upstream = await fetch(urlObj.toString());
      const statusText = (await upstream.text()).trim();
      res.json({ ok: upstream.ok, statusText });
    } catch (error) {
      res.status(502).json({ ok: false, statusText: 'error' });
    }
  });

  // 5. Proxied Native n8n Form HTML (strips X-Frame-Options: SAMEORIGIN so it can be embedded cleanly)
  app.get('/api/n8n/embed', async (req, res) => {
    const targetUrl =
      typeof req.query.url === 'string' && req.query.url.trim().startsWith('http')
        ? req.query.url.trim()
        : DEFAULT_N8N_FORM_URL;

    try {
      const response = await fetch(targetUrl);
      let html = await response.text();

      // Rewrite postUrl in the native n8n script so submitting inside the iframe routes through our same-origin proxy
      html = html.replace(
        'fetch(postUrl, {',
        `fetch('/api/n8n/raw-submit?url=' + encodeURIComponent('${targetUrl}'), {`
      );

      res.removeHeader('X-Frame-Options');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
    } catch (error) {
      res
        .status(502)
        .send(
          '<html><body style="font-family:sans-serif;padding:24px;">Unable to load embedded n8n form preview.</body></html>'
        );
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
