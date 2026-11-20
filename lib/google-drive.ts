import crypto from 'node:crypto';
import { getTenantContext, requireTenantContext } from './tenant-context';
import { extractGoogleDriveFolderId } from './work/photo-folder';

const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive';
const DRIVE_FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';

export class GoogleDriveConfigurationError extends Error {}

export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  thumbnailLink?: string;
}

export type GoogleDriveFilePage = {
  files: GoogleDriveFile[];
  nextPageToken: string | null;
};

interface MockFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  content: Buffer;
  thumbnailLink?: string;
  parents: string[];
  organizationId?: string;
}

const defaultMockFiles: MockFile[] = [
  {
    id: 'mock-file-1',
    name: 'PHA-D1-001_praha-d1.jpg',
    mimeType: 'image/jpeg',
    size: 1024,
    content: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'),
    thumbnailLink: 'https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?w=150&h=150&fit=crop',
    parents: [],
  },
  {
    id: 'mock-file-2',
    name: 'PHA-CL-014_andel-citylight.png',
    mimeType: 'image/png',
    size: 2048,
    content: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64'),
    thumbnailLink: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=150&h=150&fit=crop',
    parents: [],
  },
  {
    id: 'mock-file-3',
    name: 'BRN-LED-007_brno-led-screen.webp',
    mimeType: 'image/webp',
    size: 3072,
    content: Buffer.from('UklGRhoAAABXRUJQVlA4TCEAAAAvAAAAEP8IEP8HAP8HAP8HAP8HAP8HAP8HAP8HAP8HAP8HAP8=', 'base64'),
    thumbnailLink: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=150&h=150&fit=crop',
    parents: [],
  },
  {
    id: 'mock-file-4',
    name: 'PHA-D1-001_interior-check.jpg',
    mimeType: 'image/jpeg',
    size: 1536,
    content: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'),
    thumbnailLink: 'https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=150&h=150&fit=crop',
    parents: [],
  }
];

const globalForMockDrive = globalThis as unknown as {
  mockDriveFiles?: Map<string, MockFile>;
};

function getMockDriveFiles() {
  if (!globalForMockDrive.mockDriveFiles) {
    const map = new Map<string, MockFile>();
    defaultMockFiles.forEach(file => {
      const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || 'mock-folder-id';
      map.set(file.id, { ...file, parents: [folderId] });
    });
    globalForMockDrive.mockDriveFiles = map;
  }
  return globalForMockDrive.mockDriveFiles;
}

function seedTenantMockFilesIfEmpty(organizationId: string, folderId: string) {
  const map = getMockDriveFiles();
  for (const file of map.values()) {
    if (file.organizationId === organizationId || file.parents.includes(folderId)) {
      return;
    }
  }
  const demoFiles: MockFile[] = [
    {
      id: `mock-${organizationId}-1`,
      name: 'billboard-plakat-reklama.jpg',
      mimeType: 'image/jpeg',
      size: 1024 * 500,
      content: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'),
      thumbnailLink: 'https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?w=150&h=150&fit=crop',
      parents: [folderId],
      organizationId,
    },
    {
      id: `mock-${organizationId}-2`,
      name: 'citylight-plakat-vecer.png',
      mimeType: 'image/png',
      size: 1024 * 750,
      content: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64'),
      thumbnailLink: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=150&h=150&fit=crop',
      parents: [folderId],
      organizationId,
    },
    {
      id: `mock-${organizationId}-3`,
      name: 'led-obrazovka-den.webp',
      mimeType: 'image/webp',
      size: 1024 * 320,
      content: Buffer.from('UklGRhoAAABXRUJQVlA4TCEAAAAvAAAAEP8IEP8HAP8HAP8HAP8HAP8HAP8HAP8HAP8HAP8=', 'base64'),
      thumbnailLink: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=150&h=150&fit=crop',
      parents: [folderId],
      organizationId,
    },
  ];
  for (const f of demoFiles) {
    map.set(f.id, f);
  }
}

export function isGoogleDriveMockEnabled() {
  return process.env.NODE_ENV !== 'production' && process.env.GOOGLE_DRIVE_MOCK_ENABLED === 'true';
}

type AccessTokenProvider = () => Promise<string>;

export async function resolveGoogleDriveAccessToken(
  hasOAuthCredentials: boolean,
  hasServiceAccountCredentials: boolean,
  getOAuthToken: AccessTokenProvider,
  getServiceAccountToken: AccessTokenProvider,
) {
  if (hasOAuthCredentials) {
    try {
      return await getOAuthToken();
    } catch (error) {
      if (!hasServiceAccountCredentials) throw error;
      console.warn('Google Drive OAuth failed; falling back to the service account.');
    }
  }

  if (hasServiceAccountCredentials) return getServiceAccountToken();

  throw new GoogleDriveConfigurationError(
    'Chybí konfigurace Google Drive OAuth nebo Google Service Account.',
  );
}

async function getAccessToken() {
  if (getTenantContext()?.organizationId) {
    try {
      const { connectedGoogleAccessToken } = await import('./integrations/google-oauth');
      const connectedToken = await connectedGoogleAccessToken('GOOGLE_DRIVE');
      if (connectedToken) return connectedToken;
    } catch (error) {
      console.warn('Tenant Google Drive OAuth failed; falling back to shared storage credentials.', error);
    }
  }

  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL;
  const configuredPrivateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY;

  const getOAuthToken = async () => {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId!,
        client_secret: clientSecret!,
        refresh_token: refreshToken!,
        grant_type: 'refresh_token',
      }),
      cache: 'no-store',
    });
    const data = (await response.json()) as { access_token?: string; error_description?: string };
    if (!response.ok || !data.access_token) {
      throw new Error(`Google OAuth autentizace selhala: ${data.error_description ?? response.statusText}`);
    }
    return data.access_token;
  };

  const getServiceAccountToken = async () => {
    if (!email || !configuredPrivateKey) {
      throw new GoogleDriveConfigurationError(
        'Chybí konfigurace Google Drive OAuth nebo Google Service Account.',
      );
    }
    const privateKey = configuredPrivateKey.replace(/\\n/g, '\n');
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const now = Math.floor(Date.now() / 1000);
    const claimSet = Buffer.from(
      JSON.stringify({
        iss: email,
        scope: 'https://www.googleapis.com/auth/drive',
        aud: 'https://oauth2.googleapis.com/token',
        exp: now + 3600,
        iat: now,
      }),
    ).toString('base64url');

    const sign = crypto.createSign('RSA-SHA256');
    sign.update(`${header}.${claimSet}`);
    const signature = sign.sign(privateKey, 'base64url');
    const jwt = `${header}.${claimSet}.${signature}`;
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
      cache: 'no-store',
    });
    const data = (await response.json()) as { access_token?: string; error_description?: string };
    if (!response.ok || !data.access_token) {
      throw new Error(`Google Service Account autentizace selhala: ${data.error_description ?? response.statusText}`);
    }
    return data.access_token;
  };

  return resolveGoogleDriveAccessToken(
    Boolean(clientId && clientSecret && refreshToken),
    Boolean(email && configuredPrivateKey),
    getOAuthToken,
    getServiceAccountToken,
  );
}

export async function resolveTenantPhotoFolderId(orgId?: string): Promise<string> {
  const organizationId = orgId || getTenantContext()?.organizationId;
  const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID || 'mock-folder-id';

  if (isGoogleDriveMockEnabled()) {
    return organizationId ? `${rootFolderId}/organizations/${organizationId}` : rootFolderId;
  }

  const accessToken = await getAccessToken();
  return getOrCreatePhotoFolder(accessToken, organizationId);
}

export async function getOrCreatePhotoFolder(accessToken: string, orgId?: string) {
  const configuredRoot = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (configuredRoot) return getOrCreateOrganizationPhotoFolder(accessToken, configuredRoot, orgId);

  const query = [
    `mimeType = '${DRIVE_FOLDER_MIME_TYPE}'`,
    "appProperties has { key='seepointStorage' and value='photos' }",
    'trashed = false',
  ].join(' and ');
  const params = new URLSearchParams({
    q: query,
    spaces: 'drive',
    pageSize: '1',
    fields: 'files(id)',
  });
  const listResponse = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  const listData = (await listResponse.json()) as { files?: Array<{ id: string }>; error?: { message?: string } };

  if (!listResponse.ok) {
    throw new Error(`Google Drive folder lookup failed: ${listData.error?.message ?? listResponse.statusText}`);
  }
  if (listData.files?.[0]?.id) return getOrCreateOrganizationPhotoFolder(accessToken, listData.files[0].id, orgId);

  const createResponse = await fetch('https://www.googleapis.com/drive/v3/files?fields=id', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'SeePoint Photos',
      mimeType: DRIVE_FOLDER_MIME_TYPE,
      appProperties: { seepointStorage: 'photos' },
    }),
  });
  const createData = (await createResponse.json()) as { id?: string; error?: { message?: string } };

  if (!createResponse.ok || !createData.id) {
    throw new Error(`Google Drive folder creation failed: ${createData.error?.message ?? createResponse.statusText}`);
  }

  return getOrCreateOrganizationPhotoFolder(accessToken, createData.id, orgId);
}

export async function getOrCreateOrganizationPhotoFolder(accessToken: string, rootFolderId: string, orgId?: string) {
  const organizationId = orgId || getTenantContext()?.organizationId || requireTenantContext().organizationId;
  const escapedOrgId = organizationId.replaceAll("'", '');
  const query = [
    `mimeType = '${DRIVE_FOLDER_MIME_TYPE}'`,
    `'${rootFolderId}' in parents`,
    `appProperties has { key='seepointOrganizationId' and value='${escapedOrgId}' }`,
    'trashed = false',
  ].join(' and ');
  const params = new URLSearchParams({ q: query, spaces: 'drive', pageSize: '1', fields: 'files(id)' });
  const listResponse = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' });
  const listData = await listResponse.json() as { files?: Array<{ id: string }>; error?: { message?: string } };
  if (!listResponse.ok) throw new Error(`Google Drive tenant folder lookup failed: ${listData.error?.message ?? listResponse.statusText}`);
  if (listData.files?.[0]?.id) return listData.files[0].id;
  const response = await fetch('https://www.googleapis.com/drive/v3/files?fields=id', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: `organizations__${organizationId}`, mimeType: DRIVE_FOLDER_MIME_TYPE, parents: [rootFolderId], appProperties: { seepointOrganizationId: organizationId } }),
  });
  const data = await response.json() as { id?: string; error?: { message?: string } };
  if (!response.ok || !data.id) throw new Error(`Google Drive tenant folder creation failed: ${data.error?.message ?? response.statusText}`);
  return data.id;
}

export async function uploadPhotoToGoogleDrive(file: File, fileName: string, photoId: string) {
  if (isGoogleDriveMockEnabled()) {
    const organizationId = getTenantContext()?.organizationId;
    const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID || 'mock-folder-id';
    const folderId = organizationId ? `${rootFolderId}/organizations/${organizationId}` : rootFolderId;
    const buffer = Buffer.from(await file.arrayBuffer());
    const mockFileId = `mock-uploaded-${crypto.randomUUID()}`;
    const newMockFile: MockFile = {
      id: mockFileId,
      name: fileName,
      mimeType: file.type,
      size: file.size,
      content: buffer,
      parents: [folderId],
      organizationId,
      thumbnailLink: 'https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=150&h=150&fit=crop',
    };
    getMockDriveFiles().set(mockFileId, newMockFile);
    return {
      id: mockFileId,
      name: fileName,
      mimeType: file.type,
      size: file.size,
    };
  }

  const accessToken = await getAccessToken();
  const folderId = await getOrCreatePhotoFolder(accessToken);
  const boundary = `seepoint-${crypto.randomUUID()}`;
  const metadata = JSON.stringify({
    name: fileName,
    parents: [folderId],
    appProperties: { seepointPhotoId: photoId, seepointOrganizationId: requireTenantContext().organizationId },
  });
  const body = new Blob(
    [
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`,
      `--${boundary}\r\nContent-Type: ${file.type}\r\n\r\n`,
      file,
      `\r\n--${boundary}--`,
    ],
    { type: `multipart/related; boundary=${boundary}` },
  );

  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,mimeType,size',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': body.type,
      },
      body,
    },
  );
  const data = (await response.json()) as {
    id?: string;
    name?: string;
    mimeType?: string;
    size?: string;
    error?: { message?: string };
  };

  if (!response.ok || !data.id) {
    throw new Error(`Google Drive upload failed: ${data.error?.message ?? response.statusText}`);
  }

  return {
    id: data.id,
    name: data.name ?? fileName,
    mimeType: data.mimeType ?? file.type,
    size: Number(data.size ?? file.size),
  };
}

export async function uploadDocumentToGoogleDrive(file: File, fileName: string, documentId: string) {
  if (isGoogleDriveMockEnabled()) {
    const organizationId = getTenantContext()?.organizationId;
    const rootFolderId = process.env.GOOGLE_DRIVE_INVOICE_FOLDER_ID || process.env.GOOGLE_DRIVE_FOLDER_ID || 'mock-folder-id';
    const folderId = organizationId ? `${rootFolderId}/organizations/${organizationId}` : rootFolderId;
    const buffer = Buffer.from(await file.arrayBuffer());
    const mockFileId = `mock-document-${crypto.randomUUID()}`;
    getMockDriveFiles().set(mockFileId, {
      id: mockFileId,
      name: fileName,
      mimeType: file.type,
      size: file.size,
      content: buffer,
      parents: [folderId],
      organizationId,
    });
    return { id: mockFileId, name: fileName, mimeType: file.type, size: file.size };
  }

  const accessToken = await getAccessToken();
  const configuredRoot = process.env.GOOGLE_DRIVE_INVOICE_FOLDER_ID || process.env.GOOGLE_DRIVE_FOLDER_ID;
  const folderId = configuredRoot
    ? await getOrCreateOrganizationPhotoFolder(accessToken, configuredRoot)
    : await getOrCreatePhotoFolder(accessToken);
  const boundary = `seepoint-${crypto.randomUUID()}`;
  const metadata = JSON.stringify({
    name: fileName,
    parents: [folderId],
    appProperties: { seepointDocumentId: documentId, seepointOrganizationId: requireTenantContext().organizationId },
  });
  const body = new Blob(
    [
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`,
      `--${boundary}\r\nContent-Type: ${file.type}\r\n\r\n`,
      file,
      `\r\n--${boundary}--`,
    ],
    { type: `multipart/related; boundary=${boundary}` },
  );
  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,mimeType,size',
    { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': body.type }, body },
  );
  const data = await response.json() as { id?: string; name?: string; mimeType?: string; size?: string; error?: { message?: string } };
  if (!response.ok || !data.id) throw new Error(`Google Drive document upload failed: ${data.error?.message ?? response.statusText}`);
  return { id: data.id, name: data.name ?? fileName, mimeType: data.mimeType ?? file.type, size: Number(data.size ?? file.size) };
}

export async function downloadPhotoFromGoogleDrive(fileId: string): Promise<Response> {
  if (fileId.startsWith('mock-')) {
    const mock = getMockDriveFiles().get(fileId) || defaultMockFiles.find(f => f.id === fileId);
    if (mock) {
      return new Response(new Uint8Array(mock.content), {
        status: 200,
        headers: { 'Content-Type': mock.mimeType },
      });
    }
    if (isGoogleDriveMockEnabled()) {
      return new Response(JSON.stringify({ error: 'Mock file not found' }), { status: 404 });
    }
  }

  if (isGoogleDriveMockEnabled()) {
    const file = getMockDriveFiles().get(fileId);
    if (!file) {
      return new Response(JSON.stringify({ error: 'Mock file not found' }), { status: 404 });
    }
    return new Response(new Uint8Array(file.content), {
      status: 200,
      headers: { 'Content-Type': file.mimeType },
    });
  }

  let primaryRes: Response | null = null;
  try {
    const accessToken = await getAccessToken();
    primaryRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      },
    );
    if (primaryRes.ok) return primaryRes;

    // Fallback 1: High-res CDN thumbnail via Google Drive metadata
    try {
      const metaRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=thumbnailLink,webContentLink&supportsAllDrives=true`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: 'no-store',
        },
      );
      if (metaRes.ok) {
        const meta = (await metaRes.json()) as { thumbnailLink?: string; webContentLink?: string };
        const cdnUrl = meta.thumbnailLink ? meta.thumbnailLink.replace(/=s\d+.*$/, '=s2500') : meta.webContentLink;
        if (cdnUrl) {
          const cdnRes = await fetch(cdnUrl, { signal: AbortSignal.timeout(8000) });
          if (cdnRes.ok && cdnRes.body) return cdnRes;
        }
      }
    } catch (fallbackErr) {
      console.warn('[google-drive] High-res thumbnail fallback failed:', fallbackErr);
    }
  } catch (tokenErr) {
    console.warn('[google-drive] Drive API access failed, trying public CDN fallback:', tokenErr instanceof Error ? tokenErr.message : tokenErr);
  }

  // Fallback 2: Google CDN direct export
  try {
    const directRes = await fetch(`https://lh3.googleusercontent.com/d/${encodeURIComponent(fileId)}=s2500`, {
      signal: AbortSignal.timeout(6000),
    });
    if (directRes.ok && directRes.body) return directRes;
  } catch {
    // Ignore direct CDN errors
  }

  return primaryRes || new Response(JSON.stringify({ error: 'Fotografie na Google Disku není dostupná.' }), { status: 404 });
}

export const downloadFileFromGoogleDrive = downloadPhotoFromGoogleDrive;

export async function deletePhotoFromGoogleDrive(fileId: string) {
  if (isGoogleDriveMockEnabled()) {
    getMockDriveFiles().delete(fileId);
    return;
  }

  const accessToken = await getAccessToken();
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?supportsAllDrives=true`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  if (!response.ok && response.status !== 404) {
    throw new Error(`Google Drive delete failed: ${response.statusText}`);
  }
}

export async function listImagesInFolderPage(
  folderId: string,
  options: { pageSize?: number; pageToken?: string; organizationId?: string } = {},
): Promise<GoogleDriveFilePage> {
  const pageSize = Math.max(1, Math.min(options.pageSize ?? 100, 200));
  const organizationId = options.organizationId || getTenantContext()?.organizationId;
  const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID || 'mock-folder-id';

  // If a tenant context is active and folderId is the global root or default, resolve to the tenant's dedicated folder
  let targetFolderId = folderId;
  if (organizationId && (folderId === rootFolderId || folderId === 'mock-folder-id' || folderId === 'root')) {
    targetFolderId = await resolveTenantPhotoFolderId(organizationId);
  }

  if (isGoogleDriveMockEnabled()) {
    const list: GoogleDriveFile[] = [];
    const filesMap = getMockDriveFiles();

    if (organizationId) {
      seedTenantMockFilesIfEmpty(organizationId, targetFolderId);
    }

    filesMap.forEach(file => {
      if (organizationId) {
        // Enforce strict multi-tenant boundary: file MUST belong to this organization!
        const belongsToTenant = file.parents.includes(targetFolderId) || file.organizationId === organizationId;
        const belongsToOtherTenant = Boolean(file.organizationId && file.organizationId !== organizationId);
        if (!belongsToTenant || belongsToOtherTenant) return;
      } else {
        if (!file.parents.includes(targetFolderId)) return;
      }

      list.push({
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        size: file.size,
        thumbnailLink: file.thumbnailLink,
      });
    });

    const offset = Math.max(0, Number.parseInt(options.pageToken ?? '0', 10) || 0);
    const files = list.slice(offset, offset + pageSize);
    return { files, nextPageToken: offset + files.length < list.length ? String(offset + files.length) : null };
  }

  const accessToken = await getAccessToken();
  const escapedOrgId = organizationId ? organizationId.replaceAll("'", '') : '';
  const query = organizationId
    ? `('${targetFolderId}' in parents or appProperties has { key='seepointOrganizationId' and value='${escapedOrgId}' }) and (mimeType = 'image/jpeg' or mimeType = 'image/png' or mimeType = 'image/webp') and trashed = false`
    : `'${targetFolderId}' in parents and (mimeType = 'image/jpeg' or mimeType = 'image/png' or mimeType = 'image/webp') and trashed = false`;

  const params = new URLSearchParams({
    q: query,
    fields: 'nextPageToken, files(id, name, mimeType, size, thumbnailLink, parents, appProperties)',
    pageSize: String(pageSize),
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
  });
  if (options.pageToken) params.set('pageToken', options.pageToken);
  const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  const data = (await response.json()) as {
    files?: Array<{
      id: string;
      name: string;
      mimeType: string;
      size?: string;
      thumbnailLink?: string;
      parents?: string[];
      appProperties?: Record<string, string>;
    }>;
    nextPageToken?: string;
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(`Google Drive list failed: ${data.error?.message ?? response.statusText}`);
  }

  const filteredFiles = (data.files ?? []).filter(file => {
    if (!organizationId) return true;
    // Strict post-filtering: if tagged with an org, must match this org
    if (file.appProperties?.seepointOrganizationId) {
      return file.appProperties.seepointOrganizationId === organizationId;
    }
    // If not tagged, must be inside the tenant's dedicated folder
    return file.parents?.includes(targetFolderId) ?? false;
  });

  return {
    files: filteredFiles.map(file => ({
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      size: Number(file.size ?? 0),
      thumbnailLink: file.thumbnailLink,
    })),
    nextPageToken: data.nextPageToken ?? null,
  };
}

export async function listImagesInFolder(folderId: string): Promise<GoogleDriveFile[]> {
  return (await listImagesInFolderPage(folderId, { pageSize: 200 })).files;
}

export async function verifyFileInTenantStorage(fileId: string, organizationId?: string): Promise<boolean> {
  const orgId = organizationId || getTenantContext()?.organizationId || requireTenantContext().organizationId;
  const tenantFolderId = await resolveTenantPhotoFolderId(orgId);

  if (isGoogleDriveMockEnabled()) {
    const file = getMockDriveFiles().get(fileId);
    if (!file) return false;
    if (file.organizationId && file.organizationId !== orgId) return false;
    return file.parents.includes(tenantFolderId) || file.organizationId === orgId;
  }

  const accessToken = await getAccessToken();
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,parents,appProperties&supportsAllDrives=true`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    },
  );

  if (!response.ok) return false;
  const data = (await response.json()) as {
    parents?: string[];
    appProperties?: Record<string, string>;
  };

  if (data.appProperties?.seepointOrganizationId) {
    return data.appProperties.seepointOrganizationId === orgId;
  }

  return data.parents?.includes(tenantFolderId) ?? false;
}

export async function verifyFileInFolder(fileId: string, folderId: string): Promise<boolean> {
  const activeTenant = getTenantContext()?.organizationId;
  const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (activeTenant && rootFolderId && (folderId === rootFolderId || folderId === 'mock-folder-id')) {
    return verifyFileInTenantStorage(fileId, activeTenant);
  }

  if (isGoogleDriveMockEnabled()) {
    const file = getMockDriveFiles().get(fileId);
    return file?.parents.includes(folderId) ?? false;
  }

  const accessToken = await getAccessToken();
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=parents&supportsAllDrives=true`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    },
  );

  if (!response.ok) return false;
  const data = (await response.json()) as { parents?: string[] };
  return data.parents?.includes(folderId) ?? false;
}

export class GoogleDriveTargetAccessError extends Error {
  readonly code: 'NOT_FOUND_OR_FORBIDDEN' | 'FOLDER_NAME_NOT_FOUND' | 'NOT_CONFIGURED';
  readonly serviceAccountEmail: string | null;
  readonly canCreateNewFolder: boolean;

  constructor(
    code: 'NOT_FOUND_OR_FORBIDDEN' | 'FOLDER_NAME_NOT_FOUND' | 'NOT_CONFIGURED',
    message: string,
    options?: { serviceAccountEmail?: string | null; canCreateNewFolder?: boolean }
  ) {
    super(message);
    this.name = 'GoogleDriveTargetAccessError';
    this.code = code;
    this.serviceAccountEmail = options?.serviceAccountEmail ?? null;
    this.canCreateNewFolder = options?.canCreateNewFolder ?? true;
  }
}

export function getConfiguredDriveServiceAccountEmail(): string | null {
  const email = (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL || '').trim();
  return email || null;
}

async function getCandidateDriveAccessTokens(options?: {
  allowCompanyServiceAccount?: boolean;
}): Promise<Array<{ source: 'service-account' | 'env-oauth' | 'tenant-oauth'; token: string }>> {
  const tokens: Array<{ source: 'service-account' | 'env-oauth' | 'tenant-oauth'; token: string }> = [];
  const allowCompanyServiceAccount = options?.allowCompanyServiceAccount ?? true;

  // 1. Company Drive Service Account (full drive scope — can read/write any company folder or Shared Drive shared with the SA)
  if (allowCompanyServiceAccount) {
    const email = getConfiguredDriveServiceAccountEmail();
    const configuredPrivateKey =
      process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY;
    if (email && configuredPrivateKey) {
      try {
        const privateKey = configuredPrivateKey.replace(/\\n/g, '\n');
        const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
        const now = Math.floor(Date.now() / 1000);
        const claimSet = Buffer.from(
          JSON.stringify({
            iss: email,
            scope: 'https://www.googleapis.com/auth/drive',
            aud: 'https://oauth2.googleapis.com/token',
            exp: now + 3600,
            iat: now,
          }),
        ).toString('base64url');
        const sign = crypto.createSign('RSA-SHA256');
        sign.update(`${header}.${claimSet}`);
        const signature = sign.sign(privateKey, 'base64url');
        const response = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion: `${header}.${claimSet}.${signature}`,
          }),
          cache: 'no-store',
        });
        const data = (await response.json()) as { access_token?: string };
        if (response.ok && data.access_token) {
          tokens.push({ source: 'service-account', token: data.access_token });
        }
      } catch {
        // Continue to next credential
      }
    }

    // 2. Company env-level Drive OAuth refresh token (if configured)
    const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;
    if (clientId && clientSecret && refreshToken) {
      try {
        const response = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: refreshToken,
            grant_type: 'refresh_token',
          }),
          cache: 'no-store',
        });
        const data = (await response.json()) as { access_token?: string };
        if (response.ok && data.access_token) {
          tokens.push({ source: 'env-oauth', token: data.access_token });
        }
      } catch {
        // Continue
      }
    }
  }

  // 3. Tenant-connected Google Drive OAuth (drive.file scope)
  if (getTenantContext()?.organizationId) {
    try {
      const { connectedGoogleAccessToken } = await import('./integrations/google-oauth');
      const tenantToken = await connectedGoogleAccessToken('GOOGLE_DRIVE');
      if (tenantToken) tokens.push({ source: 'tenant-oauth', token: tenantToken });
    } catch {
      // Continue
    }
  }

  return tokens;
}

export type ResolvedTargetDriveFolder = {
  id: string;
  name: string;
  webViewLink: string;
  accessToken: string;
  tokenSource: 'tenant-oauth' | 'env-oauth' | 'service-account' | 'mock';
  isSharedDrive?: boolean;
  driveLabel?: string;
};

function labelForDriveSource(
  tokenSource: ResolvedTargetDriveFolder['tokenSource'],
  isSharedDrive?: boolean
): string {
  if (isSharedDrive) return 'Firemní sdílený Google Disk';
  if (tokenSource === 'service-account' || tokenSource === 'env-oauth') {
    return 'Firemní Google Disk (servisní účet)';
  }
  if (tokenSource === 'mock') return 'Testovací Google Disk (mock)';
  return 'Připojený Google účet (OAuth)';
}

/**
 * Resolves a target Google Drive folder from either a Drive folder URL/ID
 * or a plain folder name (from WorkOrder.ftdUrl).
 * For SeePoint, tries the company Drive Service Account (full drive scope, including Shared Drives)
 * FIRST so Plán práce folders on the company Drive are always preferred over a personal Drive.
 * For external tenants (allowCompanyServiceAccount: false), strictly uses only their own tenant OAuth.
 */
export async function resolveTargetDriveFolder(
  folderInput: string,
  options?: { allowCompanyServiceAccount?: boolean }
): Promise<ResolvedTargetDriveFolder> {
  const trimmed = folderInput.trim();
  const allowCompanyServiceAccount = options?.allowCompanyServiceAccount ?? true;
  if (!trimmed) {
    throw new GoogleDriveTargetAccessError(
      'FOLDER_NAME_NOT_FOUND',
      'Zadejte odkaz nebo název cílové složky na Google Disku.',
      {
        serviceAccountEmail: allowCompanyServiceAccount ? getConfiguredDriveServiceAccountEmail() : null,
        canCreateNewFolder: true,
      }
    );
  }

  const parsedId = extractGoogleDriveFolderId(trimmed);

  if (isGoogleDriveMockEnabled()) {
    const id = parsedId || `mock-target-${crypto.createHash('sha1').update(trimmed).digest('hex').slice(0, 12)}`;
    return {
      id,
      name: parsedId ? `Složka ${parsedId.slice(0, 8)}` : trimmed,
      webViewLink: `https://drive.google.com/drive/folders/${id}`,
      accessToken: 'mock-token',
      tokenSource: 'mock',
      isSharedDrive: false,
      driveLabel: labelForDriveSource('mock', false),
    };
  }

  const candidates = await getCandidateDriveAccessTokens({ allowCompanyServiceAccount });
  const serviceAccountEmail = allowCompanyServiceAccount ? getConfiguredDriveServiceAccountEmail() : null;
  if (candidates.length === 0) {
    throw new GoogleDriveTargetAccessError(
      'NOT_CONFIGURED',
      'Google Disk není pro tuto organizaci připojen. Připojte ho v Nastavení → Integrace.',
      { serviceAccountEmail, canCreateNewFolder: false }
    );
  }

  if (parsedId) {
    for (const candidate of candidates) {
      try {
        const res = await fetch(
          `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(parsedId)}?fields=id,name,mimeType,webViewLink,trashed,driveId,capabilities(canAddChildren)&supportsAllDrives=true`,
          {
            headers: { Authorization: `Bearer ${candidate.token}` },
            cache: 'no-store',
          }
        );
        if (!res.ok) continue;
        const data = (await res.json()) as {
          id?: string;
          name?: string;
          mimeType?: string;
          webViewLink?: string;
          trashed?: boolean;
          driveId?: string;
          capabilities?: { canAddChildren?: boolean };
        };
        if (data.id && data.mimeType === DRIVE_FOLDER_MIME_TYPE && !data.trashed && data.capabilities?.canAddChildren !== false) {
          const isSharedDrive = Boolean(data.driveId);
          return {
            id: data.id,
            name: data.name || parsedId,
            webViewLink: data.webViewLink || `https://drive.google.com/drive/folders/${data.id}`,
            accessToken: candidate.token,
            tokenSource: candidate.source,
            isSharedDrive,
            driveLabel: labelForDriveSource(candidate.source, isSharedDrive),
          };
        }
      } catch {
        // Try next token
      }
    }

    const shareHint = serviceAccountEmail
      ? ` Pro zápis přímo do vašich firemních složek z Plánu práce stačí jednou nasdílet hlavní firemní složku na Google Disku (oprávnění Editor) s účtem ${serviceAccountEmail} — pak se do ní i do všech podsložek budou fotky nahrávat automaticky.`
      : ' Připojený Google účet v bezpečném režimu (drive.file) může zapisovat pouze do složek vytvořených SeePointem – můžete jedním kliknutím vytvořit novou složku a fotky do ní nahrát.';
    throw new GoogleDriveTargetAccessError(
      'NOT_FOUND_OR_FORBIDDEN',
      `Do zadané složky na Google Disku se nepodařilo zapsat (chybí oprávnění zápisu).${shareHint}`,
      { serviceAccountEmail, canCreateNewFolder: true }
    );
  }

  // Search by folder name across available tokens (Company Drive SA first for SeePoint)
  const escapedName = trimmed.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  for (const exact of [true, false]) {
    const nameFilter = exact ? `name = '${escapedName}'` : `name contains '${escapedName}'`;
    const q = `mimeType = '${DRIVE_FOLDER_MIME_TYPE}' and ${nameFilter} and trashed = false`;
    const params = new URLSearchParams({
      q,
      pageSize: '10',
      fields: 'files(id,name,webViewLink,driveId,capabilities(canAddChildren))',
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true',
    });

    for (const candidate of candidates) {
      try {
        const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
          headers: { Authorization: `Bearer ${candidate.token}` },
          cache: 'no-store',
        });
        if (!res.ok) continue;
        const data = (await res.json()) as {
          files?: Array<{
            id: string;
            name: string;
            webViewLink?: string;
            driveId?: string;
            capabilities?: { canAddChildren?: boolean };
          }>;
        };
        const writableFiles = (data.files || []).filter((f) => f.capabilities?.canAddChildren !== false);
        // Prefer Shared Drive / company folder when multiple matches exist
        const writable = writableFiles.find((f) => Boolean(f.driveId)) || writableFiles[0];
        if (writable) {
          const isSharedDrive = Boolean(writable.driveId);
          return {
            id: writable.id,
            name: writable.name,
            webViewLink: writable.webViewLink || `https://drive.google.com/drive/folders/${writable.id}`,
            accessToken: candidate.token,
            tokenSource: candidate.source,
            isSharedDrive,
            driveLabel: labelForDriveSource(candidate.source, isSharedDrive),
          };
        }
      } catch {
        // Try next token
      }
    }
  }

  const nameShareHint = serviceAccountEmail
    ? ` Ověřte, že je vaše firemní složka s realizacemi nasdílena (Editor) se servisním účtem ${serviceAccountEmail}, nebo vložte přímý odkaz složky z Google Disku.`
    : ' Vložte přímý odkaz složky z Disku, nebo nechte vytvořit novou složku.';

  throw new GoogleDriveTargetAccessError(
    'FOLDER_NAME_NOT_FOUND',
    `Složka „${trimmed}“ nebyla na firemním Google Disku nalezena.${nameShareHint}`,
    { serviceAccountEmail, canCreateNewFolder: true }
  );
}

/**
 * Creates a new realization folder on Google Drive.
 * Prefers the company Drive root folder (GOOGLE_DRIVE_REALIZATIONS_FOLDER_ID or GOOGLE_DRIVE_FOLDER_ID)
 * via Service Account for SeePoint so new folders land on the company Drive instead of a personal Drive.
 * Falls back to tenant OAuth (drive.file) when no company root is writable or for external tenants.
 */
export async function createRealizationDriveFolder(
  folderName: string,
  options?: { allowCompanyServiceAccount?: boolean; parentFolderUrl?: string | null }
): Promise<ResolvedTargetDriveFolder> {
  const cleanName = folderName.trim().replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').slice(0, 120) || 'SeePoint Realizace';
  const allowCompanyServiceAccount = options?.allowCompanyServiceAccount ?? true;

  if (isGoogleDriveMockEnabled()) {
    const id = `mock-realization-${crypto.randomUUID().slice(0, 12)}`;
    return {
      id,
      name: cleanName,
      webViewLink: `https://drive.google.com/drive/folders/${id}`,
      accessToken: 'mock-token',
      tokenSource: 'mock',
      isSharedDrive: false,
      driveLabel: labelForDriveSource('mock', false),
    };
  }

  const organizationId = getTenantContext()?.organizationId || requireTenantContext().organizationId;

  // 1. Explicit parent folder URL/ID provided by caller
  if (options?.parentFolderUrl && options.parentFolderUrl.trim()) {
    const parent = await resolveTargetDriveFolder(options.parentFolderUrl, { allowCompanyServiceAccount });
    const createRes = await fetch(
      'https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink,driveId&supportsAllDrives=true',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${parent.accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: cleanName,
          mimeType: DRIVE_FOLDER_MIME_TYPE,
          parents: [parent.id],
          appProperties: { seepointRealizationFolder: 'true', seepointOrganizationId: organizationId },
        }),
      }
    );
    const created = (await createRes.json()) as {
      id?: string;
      name?: string;
      webViewLink?: string;
      driveId?: string;
      error?: { message?: string };
    };
    if (!createRes.ok || !created.id) {
      throw new Error(`Vytvoření složky na Google Disku selhalo: ${created.error?.message ?? createRes.statusText}`);
    }
    const isSharedDrive = Boolean(created.driveId || parent.isSharedDrive);
    return {
      id: created.id,
      name: created.name || cleanName,
      webViewLink: created.webViewLink || `https://drive.google.com/drive/folders/${created.id}`,
      accessToken: parent.accessToken,
      tokenSource: parent.tokenSource,
      isSharedDrive,
      driveLabel: labelForDriveSource(parent.tokenSource, isSharedDrive),
    };
  }

  // 2. Prefer Company Drive configured root folder via Service Account / env OAuth (for SeePoint)
  const configuredCompanyRoot = allowCompanyServiceAccount
    ? (process.env.GOOGLE_DRIVE_REALIZATIONS_FOLDER_ID || process.env.GOOGLE_DRIVE_FOLDER_ID || '').trim()
    : '';
  if (configuredCompanyRoot) {
    try {
      const companyRoot = await resolveTargetDriveFolder(configuredCompanyRoot, { allowCompanyServiceAccount: true });
      // If a dedicated REALIZATIONS folder is configured, create directly inside it;
      // otherwise put under a tidy "SeePoint Realizace (FTD)" subfolder inside GOOGLE_DRIVE_FOLDER_ID.
      let targetParentId = companyRoot.id;
      if (!process.env.GOOGLE_DRIVE_REALIZATIONS_FOLDER_ID) {
        const q = [
          `mimeType = '${DRIVE_FOLDER_MIME_TYPE}'`,
          `'${companyRoot.id.replaceAll("'", '')}' in parents`,
          "name = 'SeePoint Realizace (FTD)'",
          'trashed = false',
        ].join(' and ');
        const listRes = await fetch(
          `https://www.googleapis.com/drive/v3/files?${new URLSearchParams({
            q,
            pageSize: '1',
            fields: 'files(id)',
            supportsAllDrives: 'true',
            includeItemsFromAllDrives: 'true',
          })}`,
          { headers: { Authorization: `Bearer ${companyRoot.accessToken}` }, cache: 'no-store' }
        );
        if (listRes.ok) {
          const listData = (await listRes.json()) as { files?: Array<{ id: string }> };
          if (listData.files?.[0]?.id) {
            targetParentId = listData.files[0].id;
          } else {
            const subRes = await fetch(
              'https://www.googleapis.com/drive/v3/files?fields=id&supportsAllDrives=true',
              {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${companyRoot.accessToken}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  name: 'SeePoint Realizace (FTD)',
                  mimeType: DRIVE_FOLDER_MIME_TYPE,
                  parents: [companyRoot.id],
                  appProperties: { seepointRealizationsRoot: 'true', seepointOrganizationId: organizationId },
                }),
              }
            );
            if (subRes.ok) {
              const subData = (await subRes.json()) as { id?: string };
              if (subData.id) targetParentId = subData.id;
            }
          }
        }
      }

      const createRes = await fetch(
        'https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink,driveId&supportsAllDrives=true',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${companyRoot.accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: cleanName,
            mimeType: DRIVE_FOLDER_MIME_TYPE,
            parents: [targetParentId],
            appProperties: { seepointRealizationFolder: 'true', seepointOrganizationId: organizationId },
          }),
        }
      );
      const created = (await createRes.json()) as {
        id?: string;
        name?: string;
        webViewLink?: string;
        driveId?: string;
        error?: { message?: string };
      };
      if (createRes.ok && created.id) {
        const isSharedDrive = Boolean(created.driveId || companyRoot.isSharedDrive);
        return {
          id: created.id,
          name: created.name || cleanName,
          webViewLink: created.webViewLink || `https://drive.google.com/drive/folders/${created.id}`,
          accessToken: companyRoot.accessToken,
          tokenSource: companyRoot.tokenSource,
          isSharedDrive,
          driveLabel: labelForDriveSource(companyRoot.tokenSource, isSharedDrive),
        };
      }
    } catch (err) {
      console.warn('[google-drive] Company Drive realization folder creation failed, falling back:', err);
    }
  }

  // 3. Fallback: connected tenant OAuth Drive (works even with least-privilege drive.file scope)
  const accessToken = await getAccessToken();
  let parentFolderId: string | undefined;
  try {
    const q = [
      `mimeType = '${DRIVE_FOLDER_MIME_TYPE}'`,
      "appProperties has { key='seepointRealizationsRoot' and value='true' }",
      'trashed = false',
    ].join(' and ');
    const listRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?${new URLSearchParams({ q, spaces: 'drive', pageSize: '1', fields: 'files(id)' })}`,
      { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' }
    );
    if (listRes.ok) {
      const listData = (await listRes.json()) as { files?: Array<{ id: string }> };
      parentFolderId = listData.files?.[0]?.id;
    }
    if (!parentFolderId) {
      const rootRes = await fetch('https://www.googleapis.com/drive/v3/files?fields=id', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'SeePoint Realizace (FTD)',
          mimeType: DRIVE_FOLDER_MIME_TYPE,
          appProperties: { seepointRealizationsRoot: 'true', seepointOrganizationId: organizationId },
        }),
      });
      if (rootRes.ok) {
        const rootData = (await rootRes.json()) as { id?: string };
        parentFolderId = rootData.id;
      }
    }
  } catch {
    // Fall back to Drive root if parent lookup fails
  }

  const createRes = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink&supportsAllDrives=true', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: cleanName,
      mimeType: DRIVE_FOLDER_MIME_TYPE,
      ...(parentFolderId ? { parents: [parentFolderId] } : {}),
      appProperties: { seepointRealizationFolder: 'true', seepointOrganizationId: organizationId },
    }),
  });
  const created = (await createRes.json()) as { id?: string; name?: string; webViewLink?: string; error?: { message?: string } };
  if (!createRes.ok || !created.id) {
    throw new Error(`Vytvoření složky na Google Disku selhalo: ${created.error?.message ?? createRes.statusText}`);
  }

  return {
    id: created.id,
    name: created.name || cleanName,
    webViewLink: created.webViewLink || `https://drive.google.com/drive/folders/${created.id}`,
    accessToken,
    tokenSource: 'tenant-oauth',
    isSharedDrive: false,
    driveLabel: labelForDriveSource('tenant-oauth', false),
  };
}

/**
 * Idempotently uploads a photo Buffer into an arbitrary target Google Drive folder.
 * Skips uploading if a file with the same seepointPhotoId already exists in that folder.
 */
export async function uploadPhotoBufferToDriveFolder(params: {
  accessToken?: string;
  targetFolderId: string;
  buffer: Buffer;
  mimeType: string;
  fileName: string;
  photoId: string;
}): Promise<{ id: string; name: string; webViewLink: string; alreadyExisted: boolean }> {
  const organizationId = getTenantContext()?.organizationId || requireTenantContext().organizationId;

  if (isGoogleDriveMockEnabled()) {
    const map = getMockDriveFiles();
    for (const existing of map.values()) {
      if (existing.parents.includes(params.targetFolderId) && existing.name === params.fileName) {
        return {
          id: existing.id,
          name: existing.name,
          webViewLink: `https://drive.google.com/file/d/${existing.id}/view`,
          alreadyExisted: true,
        };
      }
    }
    const mockId = `mock-export-${crypto.randomUUID().slice(0, 12)}`;
    map.set(mockId, {
      id: mockId,
      name: params.fileName,
      mimeType: params.mimeType,
      size: params.buffer.length,
      content: params.buffer,
      parents: [params.targetFolderId],
      organizationId,
    });
    return {
      id: mockId,
      name: params.fileName,
      webViewLink: `https://drive.google.com/file/d/${mockId}/view`,
      alreadyExisted: false,
    };
  }

  const accessToken = params.accessToken || (await getAccessToken());
  const escapedFolderId = params.targetFolderId.replaceAll("'", '');
  const escapedPhotoId = params.photoId.replaceAll("'", '');

  // Deduplication check inside target folder
  try {
    const checkQ = `'${escapedFolderId}' in parents and appProperties has { key='seepointPhotoId' and value='${escapedPhotoId}' } and trashed = false`;
    const checkRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?${new URLSearchParams({
        q: checkQ,
        pageSize: '1',
        fields: 'files(id,name,webViewLink)',
        supportsAllDrives: 'true',
        includeItemsFromAllDrives: 'true',
      })}`,
      { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' }
    );
    if (checkRes.ok) {
      const checkData = (await checkRes.json()) as { files?: Array<{ id: string; name: string; webViewLink?: string }> };
      const existing = checkData.files?.[0];
      if (existing) {
        return {
          id: existing.id,
          name: existing.name,
          webViewLink: existing.webViewLink || `https://drive.google.com/file/d/${existing.id}/view`,
          alreadyExisted: true,
        };
      }
    }
  } catch {
    // Proceed to upload if check fails
  }

  const boundary = `seepoint-export-${crypto.randomUUID()}`;
  const metadata = JSON.stringify({
    name: params.fileName,
    parents: [params.targetFolderId],
    appProperties: {
      seepointPhotoId: params.photoId,
      seepointOrganizationId: organizationId,
      seepointExportedToTarget: 'true',
    },
  });
  const body = new Blob(
    [
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`,
      `--${boundary}\r\nContent-Type: ${params.mimeType}\r\n\r\n`,
      new Uint8Array(params.buffer),
      `\r\n--${boundary}--`,
    ],
    { type: `multipart/related; boundary=${boundary}` },
  );

  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': body.type,
      },
      body,
    }
  );
  const data = (await response.json()) as { id?: string; name?: string; webViewLink?: string; error?: { message?: string } };
  if (!response.ok || !data.id) {
    throw new Error(`Nahrání fotografie „${params.fileName}“ na Google Disk selhalo: ${data.error?.message ?? response.statusText}`);
  }

  return {
    id: data.id,
    name: data.name ?? params.fileName,
    webViewLink: data.webViewLink || `https://drive.google.com/file/d/${data.id}/view`,
    alreadyExisted: false,
  };
}

export const googleDriveScope = DRIVE_FILE_SCOPE;
