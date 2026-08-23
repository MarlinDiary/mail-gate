import { gmail_v1, google } from "googleapis";
import sanitizeHtml from "sanitize-html";

import { getGmailConfig, getMailGateAccountEmail } from "@/lib/config";
import {
  buildScopedGmailQuery,
  messageMatchesScope,
  readDisplayedRecipientAddresses,
  readPrimarySenderAddress,
  type MailAccessScope,
} from "@/lib/mail-scope";
import {
  buildAccessServiceOptions,
  type AccessServiceOption,
} from "@/lib/mail-services";

export type MailGateMessage = {
  bodyHtml: string;
  bodyText: string;
  bodyType: "html" | "text";
  id: string;
  receivedAt: string;
  recipientAddresses: string[];
  sender: string;
  senderAddress: string;
  snippet: string;
  subject: string;
  threadId: string;
};

export type MailGateFeed = {
  generatedAt: string;
  messages: MailGateMessage[];
  query: string;
};

export type MailGateFeedOptions = {
  pageSize?: number;
  scope?: MailAccessScope;
};

export const MAILGATE_DEFAULT_PAGE_SIZE = 10;

const MAILGATE_MAX_PAGE_SIZE = 50;
const MESSAGE_DETAIL_BATCH_SIZE = 10;
const MAX_INLINE_IMAGE_BYTES = 1024 * 1024;
const MAX_REMOTE_IMAGE_CACHE_ENTRIES = 100;
const SAFE_INLINE_IMAGE_TYPES = new Set([
  "image/gif",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);
const remoteImageCache = new Map<string, Promise<string | null>>();

type InlineImagePart = {
  attachmentId: string;
  contentId: string;
  contentLocation: string;
  data: string;
  mimeType: string;
  size: number;
};

export async function getMailGateFeed(
  options: MailGateFeedOptions = {}
): Promise<MailGateFeed> {
  const { config, gmail } = createGmailClient();
  const query = buildScopedGmailQuery(config.query, options.scope);
  const pageSize = normalizePageSize(options.pageSize);

  const messageRefs = await listMessageRefs(
    gmail,
    config.userId,
    query,
    pageSize
  );

  const messages: Array<MailGateMessage | null> = [];

  for (const batch of chunk(messageRefs, MESSAGE_DETAIL_BATCH_SIZE)) {
    const batchMessages = await Promise.all(
      batch.map(async (message) => {
        if (!message.id) {
          return null;
        }

        const detail = await gmail.users.messages.get({
          userId: config.userId,
          id: message.id,
          format: "full",
        });

        return normalizeMessage(
          gmail,
          config.userId,
          detail.data,
          config.linkHostAllowlist,
          options.scope
        );
      })
    );

    messages.push(...batchMessages);
  }

  return {
    generatedAt: new Date().toISOString(),
    messages: messages.filter((message): message is MailGateMessage => Boolean(message)),
    query,
  };
}

export async function getMailAccessOptions(): Promise<AccessServiceOption[]> {
  const { config, gmail } = createGmailClient();
  const query = buildScopedGmailQuery(config.query);
  const messageRefs = await listMessageRefs(
    gmail,
    config.userId,
    query,
    MAILGATE_DEFAULT_PAGE_SIZE
  );
  const messages = await Promise.all(
    messageRefs.map(async (message) => {
      if (!message.id) {
        return null;
      }

      const detail = await gmail.users.messages.get({
        userId: config.userId,
        id: message.id,
        format: "metadata",
        metadataHeaders: [
          "From",
          "To",
          "Delivered-To",
          "X-Original-To",
          "Envelope-To",
        ],
      });
      const headers = detail.data.payload?.headers ?? [];

      return {
        recipientAddresses: readDisplayedRecipientAddresses(headers),
        senderAddress: readPrimarySenderAddress(headers),
      };
    })
  );

  return buildAccessServiceOptions(
    messages.filter((message): message is NonNullable<typeof message> =>
      Boolean(message)
    )
  );
}

export async function getGmailAccountEmail(): Promise<string> {
  const configuredEmail = getMailGateAccountEmail();

  if (configuredEmail !== "Gmail account") {
    return configuredEmail;
  }

  const { config, gmail } = createGmailClient();
  const profile = await gmail.users.getProfile({ userId: config.userId });

  return profile.data.emailAddress ?? configuredEmail;
}

function createGmailClient(): {
  config: ReturnType<typeof getGmailConfig>;
  gmail: gmail_v1.Gmail;
} {
  const config = getGmailConfig();
  const auth = new google.auth.OAuth2(config.clientId, config.clientSecret);
  auth.setCredentials({ refresh_token: config.refreshToken });

  return {
    config,
    gmail: google.gmail({ version: "v1", auth }),
  };
}

function normalizePageSize(value: number | undefined): number {
  if (!Number.isFinite(value)) {
    return MAILGATE_DEFAULT_PAGE_SIZE;
  }

  return Math.min(
    MAILGATE_MAX_PAGE_SIZE,
    Math.max(1, Math.floor(value ?? MAILGATE_DEFAULT_PAGE_SIZE))
  );
}

async function listMessageRefs(
  gmail: gmail_v1.Gmail,
  userId: string,
  query: string,
  pageSize: number
): Promise<gmail_v1.Schema$Message[]> {
  const response = await gmail.users.messages.list({
    userId,
    q: query,
    maxResults: pageSize,
  });

  return response.data.messages ?? [];
}

async function normalizeMessage(
  gmail: gmail_v1.Gmail,
  userId: string,
  message: gmail_v1.Schema$Message,
  linkHostAllowlist: string[],
  scope?: MailAccessScope
): Promise<MailGateMessage | null> {
  const internalDate = Number.parseInt(message.internalDate ?? "", 10);

  if (!Number.isFinite(internalDate)) {
    return null;
  }

  const headers = message.payload?.headers ?? [];

  if (!messageMatchesScope(headers, scope)) {
    return null;
  }

  const subject = readHeader(headers, "subject") || "(no subject)";
  const from = readHeader(headers, "from") || "(unknown sender)";
  const bodies = collectBodies(message.payload);
  const rawHtml = bodies.html.join("\n");
  const rawText = bodies.text.join("\n\n");
  const htmlWithImages = rawHtml
    ? await embedMessageImages(gmail, userId, message.id ?? "", rawHtml, bodies.inlineImages)
    : "";
  const bodyHtml = htmlWithImages
    ? sanitizeMessageHtml(htmlWithImages, linkHostAllowlist)
    : "";
  const bodyText = normalizeBodyText(
    rawText || decodeCommonHtmlEntities(stripHtml(rawHtml)) || message.snippet || ""
  );
  const bodyType = bodyHtml ? "html" : "text";

  return {
    bodyHtml,
    bodyText,
    bodyType,
    id: message.id ?? "",
    receivedAt: new Date(internalDate).toISOString(),
    recipientAddresses: readDisplayedRecipientAddresses(headers),
    sender: formatSenderName(from),
    senderAddress: readPrimarySenderAddress(headers),
    snippet: normalizeWhitespace(decodeCommonHtmlEntities(message.snippet ?? "")),
    subject,
    threadId: message.threadId ?? "",
  };
}

function readHeader(headers: gmail_v1.Schema$MessagePartHeader[], name: string): string {
  const header = headers.find((item) => item.name?.toLowerCase() === name);

  return header?.value ?? "";
}

function collectBodies(part: gmail_v1.Schema$MessagePart | undefined): {
  html: string[];
  inlineImages: InlineImagePart[];
  text: string[];
} {
  if (!part) {
    return { html: [], inlineImages: [], text: [] };
  }

  const bodies = {
    html: [] as string[],
    inlineImages: [] as InlineImagePart[],
    text: [] as string[],
  };
  const mimeType = part.mimeType?.toLowerCase() ?? "";

  if (part.body?.data && !part.filename) {
    const decoded = decodeGmailBody(part.body.data);

    if (mimeType.includes("text/html")) {
      bodies.html.push(decoded);
    } else if (mimeType.includes("text/plain") || !mimeType) {
      bodies.text.push(decoded);
    }
  }

  if (isSafeInlineImageType(mimeType)) {
    const contentId = normalizeContentReference(readHeader(part.headers ?? [], "content-id"));
    const contentLocation = normalizeContentReference(
      readHeader(part.headers ?? [], "content-location")
    );

    if (contentId || contentLocation) {
      bodies.inlineImages.push({
        attachmentId: part.body?.attachmentId ?? "",
        contentId,
        contentLocation,
        data: part.body?.data ?? "",
        mimeType,
        size: part.body?.size ?? 0,
      });
    }
  }

  for (const child of part.parts ?? []) {
    const childBodies = collectBodies(child);

    bodies.html.push(...childBodies.html);
    bodies.inlineImages.push(...childBodies.inlineImages);
    bodies.text.push(...childBodies.text);
  }

  return bodies;
}

async function embedMessageImages(
  gmail: gmail_v1.Gmail,
  userId: string,
  messageId: string,
  html: string,
  inlineImages: InlineImagePart[]
): Promise<string> {
  const htmlWithInlineImages = await embedInlineImages(
    gmail,
    userId,
    messageId,
    html,
    inlineImages
  );
  const htmlWithoutTrackingImages = stripTrackingImages(htmlWithInlineImages);

  return embedRemoteImages(htmlWithoutTrackingImages);
}

async function embedInlineImages(
  gmail: gmail_v1.Gmail,
  userId: string,
  messageId: string,
  html: string,
  inlineImages: InlineImagePart[]
): Promise<string> {
  if (!messageId || inlineImages.length === 0) {
    return html;
  }

  const referencedContentIds = findCidReferences(html);

  if (referencedContentIds.size === 0) {
    return html;
  }

  const dataUrls = new Map<string, string>();
  const matchingImages = inlineImages.filter((image) =>
    getInlineImageKeys(image).some((key) => referencedContentIds.has(key))
  );

  await Promise.all(
    matchingImages.map(async (image) => {
      const dataUrl = await readInlineImageDataUrl(gmail, userId, messageId, image);

      if (!dataUrl) {
        return;
      }

      for (const key of getInlineImageKeys(image)) {
        dataUrls.set(key, dataUrl);
      }
    })
  );

  if (dataUrls.size === 0) {
    return html;
  }

  return html.replace(/cid:([^"'\s)>]+)/gi, (match, rawContentId) => {
    return dataUrls.get(normalizeContentReference(rawContentId)) ?? match;
  });
}

async function readInlineImageDataUrl(
  gmail: gmail_v1.Gmail,
  userId: string,
  messageId: string,
  image: InlineImagePart
): Promise<string | null> {
  if (!isSafeInlineImageType(image.mimeType)) {
    return null;
  }

  if (image.size > MAX_INLINE_IMAGE_BYTES) {
    return null;
  }

  let data = image.data;

  if (!data && image.attachmentId) {
    try {
      const attachment = await gmail.users.messages.attachments.get({
        userId,
        messageId,
        id: image.attachmentId,
      });

      data = attachment.data.data ?? "";
    } catch (error) {
      console.warn("Unable to read inline Gmail image attachment.", error);
      return null;
    }
  }

  if (!data) {
    return null;
  }

  const imageBytes = Buffer.from(data, "base64url");

  if (imageBytes.byteLength > MAX_INLINE_IMAGE_BYTES) {
    return null;
  }

  return `data:${image.mimeType};base64,${imageBytes.toString("base64")}`;
}

function findCidReferences(html: string): Set<string> {
  const references = new Set<string>();

  for (const match of html.matchAll(/cid:([^"'\s)>]+)/gi)) {
    references.add(normalizeContentReference(match[1]));
  }

  return references;
}

function getInlineImageKeys(image: InlineImagePart): string[] {
  return [image.contentId, image.contentLocation].filter(Boolean);
}

async function embedRemoteImages(html: string): Promise<string> {
  const imageSources = findRemoteImageSources(html);

  if (imageSources.length === 0) {
    return html;
  }

  const replacements = await Promise.all(
    imageSources.map(async (src) => ({
      dataUrl: await readRemoteImageDataUrl(src),
      src,
    }))
  );

  return replacements.reduce((currentHtml, replacement) => {
    if (!replacement.dataUrl) {
      return currentHtml;
    }

    return currentHtml.split(replacement.src).join(replacement.dataUrl);
  }, html);
}

async function readRemoteImageDataUrl(src: string): Promise<string | null> {
  const cached = remoteImageCache.get(src);

  if (cached) {
    return cached;
  }

  if (remoteImageCache.size >= MAX_REMOTE_IMAGE_CACHE_ENTRIES) {
    remoteImageCache.clear();
  }

  const readPromise = fetchRemoteImageDataUrl(src);
  remoteImageCache.set(src, readPromise);

  return readPromise;
}

async function fetchRemoteImageDataUrl(src: string): Promise<string | null> {
  try {
    const response = await fetch(src, {
      headers: {
        "User-Agent": "MailGate/1.0",
      },
      redirect: "follow",
    });

    if (!response.ok) {
      return null;
    }

    const contentType =
      response.headers.get("content-type")?.split(";")[0]?.toLowerCase() ?? "";
    const contentLength = Number.parseInt(
      response.headers.get("content-length") ?? "0",
      10
    );

    if (
      !isSafeInlineImageType(contentType) ||
      contentLength > MAX_INLINE_IMAGE_BYTES
    ) {
      return null;
    }

    const imageBytes = Buffer.from(await response.arrayBuffer());

    if (imageBytes.byteLength > MAX_INLINE_IMAGE_BYTES) {
      return null;
    }

    return `data:${contentType};base64,${imageBytes.toString("base64")}`;
  } catch {
    return null;
  }
}

function findRemoteImageSources(html: string): string[] {
  const sources = new Set<string>();

  for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
    const src = readHtmlAttribute(match[0], "src");

    if (src.startsWith("https://")) {
      sources.add(src);
    }
  }

  return Array.from(sources);
}

function stripTrackingImages(html: string): string {
  return html.replace(/<img\b[^>]*>/gi, (tag) => {
    const src = readHtmlAttribute(tag, "src");
    const width = Number.parseInt(readHtmlAttribute(tag, "width"), 10);
    const height = Number.parseInt(readHtmlAttribute(tag, "height"), 10);

    if (
      (Number.isFinite(width) && width <= 1 && Number.isFinite(height) && height <= 1) ||
      imageSourceLooksLikeTrackingPixel(src)
    ) {
      return "";
    }

    return tag;
  });
}

function imageSourceLooksLikeTrackingPixel(src: string): boolean {
  if (!src) {
    return false;
  }

  try {
    const parsed = new URL(src);

    return parsed.pathname === "/wf/open";
  } catch {
    return false;
  }
}

function readHtmlAttribute(tag: string, name: string): string {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = tag.match(
    new RegExp(
      `${escapedName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
      "i"
    )
  );

  return match?.[1] ?? match?.[2] ?? match?.[3] ?? "";
}

function isSafeInlineImageType(mimeType: string): boolean {
  return SAFE_INLINE_IMAGE_TYPES.has(mimeType.toLowerCase());
}

function normalizeContentReference(value: string): string {
  const trimmed = value.trim().replace(/^cid:/i, "").replace(/^<|>$/g, "");

  try {
    return decodeURIComponent(trimmed).toLowerCase();
  } catch {
    return trimmed.toLowerCase();
  }
}

function decodeGmailBody(data: string): string {
  return Buffer.from(data, "base64url").toString("utf8");
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function sanitizeMessageHtml(value: string, linkHostAllowlist: string[]): string {
  return sanitizeHtml(value, {
    allowedAttributes: {
      a: ["href", "name", "target", "rel"],
      "*": [
        "align",
        "aria-label",
        "background",
        "bgcolor",
        "border",
        "cellpadding",
        "cellspacing",
        "class",
        "dir",
        "height",
        "id",
        "lang",
        "role",
        "style",
        "title",
        "valign",
        "width",
      ],
      blockquote: ["cite"],
      img: ["alt", "decoding", "height", "loading", "src", "width"],
      table: ["align", "cellpadding", "cellspacing", "role", "width"],
      td: ["align", "colspan", "rowspan", "valign", "width"],
      th: ["align", "colspan", "rowspan", "valign", "width"],
    },
    allowedSchemes: ["https", "mailto"],
    allowedSchemesByTag: {
      img: ["data", "https"],
    },
    allowedTags: [
      ...sanitizeHtml.defaults.allowedTags,
      "article",
      "aside",
      "body",
      "br",
      "caption",
      "center",
      "col",
      "colgroup",
      "div",
      "font",
      "footer",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "head",
      "header",
      "hr",
      "html",
      "img",
      "main",
      "meta",
      "section",
      "span",
      "style",
      "table",
      "tbody",
      "td",
      "tfoot",
      "th",
      "title",
      "thead",
      "tr",
    ],
    allowVulnerableTags: true,
    parseStyleAttributes: false,
    transformTags: {
      a: (_tagName, attribs) => {
        const href = attribs.href ?? "";

        if (!href || !hrefIsAllowed(href, linkHostAllowlist)) {
          return {
            attribs: {},
            tagName: "span",
          };
        }

        return {
          attribs: {
            ...attribs,
            rel: "noreferrer",
            target: "_blank",
          },
          tagName: "a",
        };
      },
      img: (_tagName, attribs) => {
        const src = attribs.src ?? "";

        if (!imageSrcIsAllowed(src)) {
          return {
            attribs: {},
            tagName: "span",
          };
        }

        return {
          attribs: {
            alt: attribs.alt ?? "",
            ...(attribs.class ? { class: attribs.class } : {}),
            decoding: "async",
            loading: "lazy",
            src,
            ...(attribs.style ? { style: attribs.style } : {}),
            ...(attribs.height ? { height: attribs.height } : {}),
            ...(attribs.width ? { width: attribs.width } : {}),
          },
          tagName: "img",
        };
      },
    },
  });
}

function imageSrcIsAllowed(src: string): boolean {
  if (/^data:image\/(?:gif|jpe?g|png|webp);base64,/i.test(src)) {
    return true;
  }

  try {
    const parsed = new URL(src);

    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function hostIsAllowed(hostname: string, hostAllowlist: string[]): boolean {
  if (hostAllowlist.length === 0) {
    return true;
  }

  const normalized = hostname.toLowerCase();

  return hostAllowlist.some(
    (allowedHost) =>
      normalized === allowedHost || normalized.endsWith(`.${allowedHost}`)
  );
}

function hrefIsAllowed(href: string, hostAllowlist: string[]): boolean {
  try {
    const parsed = new URL(href);

    if (parsed.protocol === "mailto:") {
      return true;
    }

    return parsed.protocol === "https:" && hostIsAllowed(parsed.hostname, hostAllowlist);
  } catch {
    return false;
  }
}

function decodeCommonHtmlEntities(value: string): string {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#x27;", "'")
    .replaceAll("&#39;", "'");
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeBodyText(value: string): string {
  return decodeCommonHtmlEntities(value)
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stripHtml(value: string): string {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
}

function formatSenderName(from: string): string {
  const nameMatch = from.match(/^\s*"?([^"<]+?)"?\s*<[^>]+>\s*$/);
  const name = nameMatch?.[1]?.trim() ?? "";

  if (name) {
    return name.replace(/\\"/g, '"');
  }

  const emailMatch = from.match(/<?([^<>\s@]+@([^<>\s]+))>?/);

  if (emailMatch?.[2]) {
    return emailMatch[2];
  }

  return from || "(unknown sender)";
}
