import crypto from 'node:crypto';

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

interface MockFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  content: Buffer;
  thumbnailLink?: string;
  parents: string[];
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
      file.parents = [folderId];
      map.set(file.id, file);
    });
    globalForMockDrive.mockDriveFiles = map;
  }
  return globalForMockDrive.mockDriveFiles;
}

export function isGoogleDriveMockEnabled() {
  return process.env.NODE_ENV !== 'production' && process.env.GOOGLE_DRIVE_MOCK_ENABLED === 'true';
}

async function getAccessToken() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (!email || !privateKey) {
    throw new GoogleDriveConfigurationError(
      'Chybí konfigurace Google Service Account (GOOGLE_SERVICE_ACCOUNT_EMAIL a GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY).'
    );
  }

  // Support Vercel multi-line environment variables
  privateKey = privateKey.replace(/\\n/g, '\n');

  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const claimSet = Buffer.from(
    JSON.stringify({
      iss: email,
      scope: 'https://www.googleapis.com/auth/drive',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    })
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
}

async function getOrCreatePhotoFolder(accessToken: string) {
  if (process.env.GOOGLE_DRIVE_FOLDER_ID) return process.env.GOOGLE_DRIVE_FOLDER_ID;

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
  if (listData.files?.[0]?.id) return listData.files[0].id;

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

  return createData.id;
}

export async function uploadPhotoToGoogleDrive(file: File, fileName: string, photoId: string) {
  if (isGoogleDriveMockEnabled()) {
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || 'mock-folder-id';
    const buffer = Buffer.from(await file.arrayBuffer());
    const mockFileId = `mock-uploaded-${crypto.randomUUID()}`;
    const newMockFile: MockFile = {
      id: mockFileId,
      name: fileName,
      mimeType: file.type,
      size: file.size,
      content: buffer,
      parents: [folderId],
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
    appProperties: { seepointPhotoId: photoId },
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

export async function downloadPhotoFromGoogleDrive(fileId: string): Promise<Response> {
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

  const accessToken = await getAccessToken();
  return fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    },
  );
}

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

export async function listImagesInFolder(folderId: string): Promise<GoogleDriveFile[]> {
  if (isGoogleDriveMockEnabled()) {
    const list: GoogleDriveFile[] = [];
    getMockDriveFiles().forEach(file => {
      if (file.parents.includes(folderId)) {
        list.push({
          id: file.id,
          name: file.name,
          mimeType: file.mimeType,
          size: file.size,
          thumbnailLink: file.thumbnailLink,
        });
      }
    });
    return list;
  }

  const accessToken = await getAccessToken();
  const query = `'${folderId}' in parents and (mimeType = 'image/jpeg' or mimeType = 'image/png' or mimeType = 'image/webp') and trashed = false`;
  const params = new URLSearchParams({
    q: query,
    fields: 'files(id, name, mimeType, size, thumbnailLink)',
    pageSize: '1000',
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
  });
  const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  const data = (await response.json()) as {
    files?: Array<{ id: string; name: string; mimeType: string; size?: string; thumbnailLink?: string }>;
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(`Google Drive list failed: ${data.error?.message ?? response.statusText}`);
  }

  return (data.files ?? []).map(file => ({
    id: file.id,
    name: file.name,
    mimeType: file.mimeType,
    size: Number(file.size ?? 0),
    thumbnailLink: file.thumbnailLink,
  }));
}

export async function verifyFileInFolder(fileId: string, folderId: string): Promise<boolean> {
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

export const googleDriveScope = DRIVE_FILE_SCOPE;
