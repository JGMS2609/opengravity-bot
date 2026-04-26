import fs from "node:fs";
import path from "node:path";
import { authenticate } from "@google-cloud/local-auth";
import { google } from "googleapis";

const SCOPES = ["https://www.googleapis.com/auth/drive.readonly"];

const ROOT_DIR = process.cwd();
const DATA_DIR = path.join(ROOT_DIR, "data");
const DOWNLOADS_DIR = path.join(DATA_DIR, "downloads");
const TOKEN_PATH = path.join(DATA_DIR, "google-token.json");
const CREDENTIALS_PATH = path.join(DATA_DIR, "google-credentials.json");

type DriveFileInfo = {
  id: string;
  name: string;
  mimeType: string;
};

function ensureDataDirs(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DOWNLOADS_DIR)) {
    fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
  }
}

function sanitizeFileName(name: string): string {
  return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").trim();
}

async function loadSavedClient() {
  try {
    if (!fs.existsSync(TOKEN_PATH)) {
      return null;
    }

    const tokenRaw = fs.readFileSync(TOKEN_PATH, "utf8");
    const token = JSON.parse(tokenRaw);

    const credentialsRaw = fs.readFileSync(CREDENTIALS_PATH, "utf8");
    const credentials = JSON.parse(credentialsRaw);
    const key = credentials.installed || credentials.web;

    const client = new google.auth.OAuth2(
      key.client_id,
      key.client_secret,
      key.redirect_uris?.[0],
    );

    client.setCredentials(token);
    return client;
  } catch (error) {
    console.error("No pude cargar credenciales guardadas de Google Drive:", error);
    return null;
  }
}

async function saveClient(client: any): Promise<void> {
  const credentialsRaw = fs.readFileSync(CREDENTIALS_PATH, "utf8");
  const credentials = JSON.parse(credentialsRaw);
  const key = credentials.installed || credentials.web;

  const payload = {
    type: "authorized_user",
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
    access_token: client.credentials.access_token,
    expiry_date: client.credentials.expiry_date,
    token_type: client.credentials.token_type,
    scope: client.credentials.scope,
  };

  fs.writeFileSync(TOKEN_PATH, JSON.stringify(payload, null, 2), "utf8");
}

async function authorizeGoogleDrive() {
  ensureDataDirs();

  if (!fs.existsSync(CREDENTIALS_PATH)) {
    throw new Error(
      "No existe data/google-credentials.json. Primero descarga tus credenciales OAuth desde Google Cloud y guardalas en esa ruta.",
    );
  }

  const savedClient = await loadSavedClient();
  if (savedClient) {
    return savedClient;
  }

  const client = await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  });

  if (client.credentials) {
    await saveClient(client);
  }

  return client;
}

async function getDriveClient() {
  const auth = await authorizeGoogleDrive();
  return google.drive({
    version: "v3",
    auth,
  });
}

export function canHandleGoogleDrive(text: string): boolean {
  const lower = text.toLowerCase();

  return (
    lower.includes("google drive") ||
    lower.includes("mi drive") ||
    lower.includes("buscar en drive") ||
    lower.includes("busca en drive") ||
    lower.includes("busca en google drive") ||
    lower.includes("listar archivos") ||
    lower.includes("lista mis archivos") ||
    lower.includes("descarga de drive") ||
    lower.includes("descargar de drive")
  );
}

function extractSearchQuery(text: string): string | null {
  const patterns = [
    /(?:busca en drive|buscar en drive|busca en google drive|buscar en google drive)\s+(.+)/i,
    /(?:archivo llamado|archivo que se llama)\s+(.+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return match[1].trim().replace(/[.!?]+$/, "");
    }
  }

  return null;
}

function extractFileNameToDownload(text: string): string | null {
  const patterns = [
    /(?:descarga de drive|descargar de drive|descarga el archivo|descargar archivo)\s+(.+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return match[1].trim().replace(/[.!?]+$/, "");
    }
  }

  return null;
}

async function listRecentFiles(limit = 10): Promise<DriveFileInfo[]> {
  const drive = await getDriveClient();
  const result = await drive.files.list({
    pageSize: limit,
    fields: "files(id, name, mimeType)",
    orderBy: "modifiedTime desc",
    q: "trashed = false",
    spaces: "drive",
  });

  return (result.data.files || [])
    .filter((file) => file.id && file.name && file.mimeType)
    .map((file) => ({
      id: file.id as string,
      name: file.name as string,
      mimeType: file.mimeType as string,
    }));
}

async function searchFilesByName(query: string, limit = 10): Promise<DriveFileInfo[]> {
  const drive = await getDriveClient();
  const safeQuery = query.replace(/'/g, "\\'");
  const result = await drive.files.list({
    pageSize: limit,
    fields: "files(id, name, mimeType)",
    q: `trashed = false and name contains '${safeQuery}'`,
    spaces: "drive",
  });

  return (result.data.files || [])
    .filter((file) => file.id && file.name && file.mimeType)
    .map((file) => ({
      id: file.id as string,
      name: file.name as string,
      mimeType: file.mimeType as string,
    }));
}

async function downloadFileByName(query: string): Promise<string> {
  const drive = await getDriveClient();
  const files = await searchFilesByName(query, 5);

  if (!files.length) {
    return `No encontre ningun archivo en Google Drive que coincida con "${query}".`;
  }

  const file = files[0];

  if (
    file.mimeType === "application/vnd.google-apps.document" ||
    file.mimeType === "application/vnd.google-apps.spreadsheet" ||
    file.mimeType === "application/vnd.google-apps.presentation"
  ) {
    return `Encontre "${file.name}", pero es un archivo nativo de Google (${file.mimeType}). Para ese tipo de archivo necesito agregar exportacion especifica antes de descargarlo.`;
  }

  const safeName = sanitizeFileName(file.name);
  const outputPath = path.join(DOWNLOADS_DIR, safeName);

  const response = await drive.files.get(
    {
      fileId: file.id,
      alt: "media",
    },
    {
      responseType: "stream",
    },
  );

  const dest = fs.createWriteStream(outputPath);

  await new Promise<void>((resolve, reject) => {
    const stream = response.data as NodeJS.ReadableStream;
    stream
      .pipe(dest)
      .on("finish", () => resolve())
      .on("error", (err) => reject(err));
  });

  return `Descargue "${file.name}" en la ruta local: ${outputPath}`;
}

export async function handleGoogleDriveRequest(text: string): Promise<string> {
  try {
    const fileToDownload = extractFileNameToDownload(text);
    if (fileToDownload) {
      return await downloadFileByName(fileToDownload);
    }

    const searchQuery = extractSearchQuery(text);
    if (searchQuery) {
      const files = await searchFilesByName(searchQuery, 10);

      if (!files.length) {
        return `No encontre archivos en Google Drive que coincidan con "${searchQuery}".`;
      }

      const lines = files.map(
        (file, index) => `${index + 1}. ${file.name} | ${file.mimeType} | ${file.id}`,
      );

      return `Encontre estos archivos en Google Drive para "${searchQuery}":\n${lines.join("\n")}`;
    }

    const recentFiles = await listRecentFiles(10);

    if (!recentFiles.length) {
      return "No encontre archivos recientes en Google Drive.";
    }

    const lines = recentFiles.map(
      (file, index) => `${index + 1}. ${file.name} | ${file.mimeType} | ${file.id}`,
    );

    return `Estos son algunos archivos recientes de tu Google Drive:\n${lines.join("\n")}`;
  } catch (error: any) {
    console.error("Error en googleDriveSkill:", error);

    if (String(error?.message || "").includes("google-credentials.json")) {
      return "Aun no esta configurado Google Drive. Falta guardar el archivo data/google-credentials.json con tus credenciales OAuth descargadas desde Google Cloud.";
    }

    return `Tuve un error al usar Google Drive: ${error?.message || "error desconocido"}`;
  }
}