// src/tally/client.ts
// HTTP client for all TallyPrime communication methods
// Uses Node's native http module with UTF-16LE encoding (required by Tally)

import * as http from 'node:http';
import { XmlParser, TallyParseResult } from './xml-parser.mjs';
import { XmlBuilder } from './xml-builder.mjs';
import { TDLBuilder, CollectionConfig, FunctionConfig } from './tdl-builder.mjs';
import logger from './logger.mjs';

export class TallyConnectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TallyConnectionError';
  }
}

export class TallyResponseError extends Error {
  public rawXml: string;
  constructor(message: string, rawXml: string) {
    super(message);
    this.name = 'TallyResponseError';
    this.rawXml = rawXml;
  }
}

export class TallyClient {
  private host: string;
  private port: number;
  private timeoutMs: number;
  private baseUrl: string;
  private requestQueue: Promise<any> = Promise.resolve();

  constructor(host: string, port: number, timeoutMs: number = 30000) {
    this.host = host;
    this.port = port;
    this.timeoutMs = timeoutMs;
    this.baseUrl = `http://${host}:${port}`;
  }

  /**
   * Enqueue a request to ensure sequential execution.
   * Tally's XML server is single-threaded — concurrent requests
   * can cause UI freezes, incorrect responses, or crashes.
   */
  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const task = this.requestQueue.then(() => fn(), () => fn());
    this.requestQueue = task.then(() => {}, () => {});
    return task;
  }

  // ── Core: POST XML to Tally (serialized via queue) ───────────
  async postXml(xmlBody: string): Promise<string> {
    return this.enqueue(() => this.postXmlDirect(xmlBody));
  }

  /**
   * Direct HTTP POST using Node's http module with UTF-16LE encoding.
   * Tally's XML server expects UTF-16LE requests and returns UTF-16LE responses.
   * Always called through enqueue() to ensure serial execution.
   */
  private postXmlDirect(xmlBody: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const bodyBuffer = Buffer.from(xmlBody, 'utf16le');

      const options: http.RequestOptions = {
        hostname: this.host,
        port: this.port,
        path: '/',
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml;charset=utf-16',
          'Content-Length': bodyBuffer.byteLength,
        },
        timeout: this.timeoutMs,
      };

      logger.debug('Sending XML to Tally', { url: this.baseUrl, bodyLength: xmlBody.length });

      const req = http.request(options, (res) => {
        const chunks: Buffer[] = [];

        res.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });

        res.on('end', () => {
          try {
            const raw = Buffer.concat(chunks);
            // Tally responds in UTF-16LE
            const data = raw.toString('utf16le');

            if (!data || data.trim().length === 0) {
              reject(new TallyResponseError('Empty response from TallyPrime', ''));
              return;
            }

            // Check for errors (non-throwing — let caller decide)
            this.checkForErrors(data);

            resolve(data);
          } catch (err) {
            reject(err);
          }
        });

        res.on('error', (err) => {
          reject(new TallyConnectionError(`Tally response error: ${err.message}`));
        });
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new TallyConnectionError(
          `Tally request timed out after ${this.timeoutMs}ms. ` +
          `The query may be too large or Tally is busy processing another request.`
        ));
      });

      req.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT') {
          reject(new TallyConnectionError(
            `Cannot connect to TallyPrime at ${this.baseUrl}. ` +
            `Ensure TallyPrime is running with XML server enabled on port ${this.port}.`
          ));
        } else {
          reject(new TallyConnectionError(`Tally communication error: ${err.message}`));
        }
      });

      req.write(bodyBuffer);
      req.end();
    });
  }

  // ── Check for errors in response ──────────────────────────────
  private checkForErrors(rawXml: string): void {
    // Check for EXCEPTION responses (Tally returns these for critical errors)
    if (rawXml.trimStart().startsWith('<EXCEPTION>')) {
      const match = rawXml.match(/<EXCEPTION>([\s\S]*?)<\/EXCEPTION>/i);
      const errorMsg = match ? match[1].replace(/<[^>]+>/g, ' ').trim() : 'Unknown exception';
      logger.warn('Tally EXCEPTION detected', { error: errorMsg });
      // Don't throw — let the caller handle via parsed result
    }

    if (rawXml.includes('<LINEERROR>')) {
      const match = rawXml.match(/<LINEERROR>(.*?)<\/LINEERROR>/i);
      const errorMsg = match ? match[1] : 'Unknown LINEERROR';
      logger.warn('Tally LINEERROR detected', { error: errorMsg });
    }
  }

  // ── Parse XML response ────────────────────────────────────────
  parseResponse(xml: string): TallyParseResult {
    return XmlParser.parse(xml);
  }

  // ── Test connection ───────────────────────────────────────────
  async testConnection(): Promise<boolean> {
    try {
      const xml = XmlBuilder.buildCollectionExportRequest('List of Companies');
      await this.postXml(xml);
      return true;
    } catch (err) {
      logger.warn('Tally connection test failed', { error: String(err) });
      return false;
    }
  }

  // ── Export a named report ─────────────────────────────────────
  async exportReport(
    reportName: string,
    staticVars: Record<string, string> = {}
  ): Promise<TallyParseResult> {
    const xml = XmlBuilder.buildExportRequest(reportName, staticVars);
    const response = await this.postXml(xml);
    return this.parseResponse(response);
  }

  // ── Export a named collection ─────────────────────────────────
  async exportCollection(
    collectionName: string,
    staticVars: Record<string, string> = {}
  ): Promise<TallyParseResult> {
    const xml = XmlBuilder.buildCollectionExportRequest(collectionName, staticVars);
    const response = await this.postXml(xml);
    return this.parseResponse(response);
  }

  // ── Inline TDL collection query ───────────────────────────────
  async queryCollection(
    config: CollectionConfig,
    staticVars: Record<string, string> = {}
  ): Promise<TallyParseResult> {
    const xml = TDLBuilder.buildCollectionRequest(config, staticVars);
    const response = await this.postXml(xml);
    return this.parseResponse(response);
  }

  // ── Raw inline TDL collection query ───────────────────────────
  async queryRawTdlCollection(
    collectionName: string,
    tdlCode: string,
    staticVars: Record<string, string> = {}
  ): Promise<TallyParseResult> {
    const xml = XmlBuilder.buildInlineTdlCollectionRequest(collectionName, tdlCode, staticVars);
    const response = await this.postXml(xml);
    return this.parseResponse(response);
  }

  // ── Export single object ──────────────────────────────────────
  async exportObject(
    subtype: string,
    id: string,
    fetchFields: string[] = [],
    staticVars: Record<string, string> = {}
  ): Promise<TallyParseResult> {
    const xml = XmlBuilder.buildObjectExportRequest(subtype, id, fetchFields, staticVars);
    const response = await this.postXml(xml);
    return this.parseResponse(response);
  }

  // ── Evaluate TDL function ─────────────────────────────────────
  async evaluateFunction(
    config: FunctionConfig,
    params: string[] = []
  ): Promise<TallyParseResult> {
    const xml = TDLBuilder.buildFunctionRequest(config, params);
    const response = await this.postXml(xml);
    return this.parseResponse(response);
  }

  // ── Import masters ────────────────────────────────────────────
  async importMasters(
    masterXml: string,
    company?: string
  ): Promise<TallyParseResult> {
    const xml = XmlBuilder.buildMasterImportRequest(masterXml, company);
    const response = await this.postXml(xml);
    return this.parseResponse(response);
  }

  // ── Import vouchers ───────────────────────────────────────────
  async importVouchers(
    voucherXml: string,
    company?: string
  ): Promise<TallyParseResult> {
    const xml = XmlBuilder.buildVoucherImportRequest(voucherXml, company);
    const response = await this.postXml(xml);
    return this.parseResponse(response);
  }

  // ── Execute TDL action ────────────────────────────────────────
  async executeAction(actionId: string): Promise<TallyParseResult> {
    const xml = XmlBuilder.buildActionRequest(actionId);
    const response = await this.postXml(xml);
    return this.parseResponse(response);
  }

  // ── Get company list ──────────────────────────────────────────
  async getCompanyList(): Promise<string[]> {
    const result = await this.exportCollection('List of Companies');
    if (result.success && result.data) {
      return XmlParser.extractNameList(result.data, 'COMPANY');
    }
    return [];
  }
}
