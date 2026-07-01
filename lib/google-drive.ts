const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const DRIVE_FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';

export class GoogleDriveConfigurationError extends Error {}

function getOAuthConfig() {
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;

  const missing = [
    !clientId && 'GOOGLE_DRIVE_CLIENT_ID',
    !clientSecret && 'GOOGLE_DRIVE_CLIENT_SECRET',
    !refreshToken && 'GOOGLE_DRIVE_REFRESH_TOKEN',
  ].filter(Boolean);

  if (missing.length) {
    throw new GoogleDriveConfigurationError(`Missing Google Drive configuration: ${missing.join(', ')}`);
  }

  return { clientId: clientId!, clientSecret: clientSecret!, refreshToken: refreshToken! };
}

async function getAccessToken() {
  const { clientId, clientSecret, refreshToken } = getOAuthConfig();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    cache: 'no-store',
  });
  const data = (await response.json()) as { access_token?: string; error_description?: string };

  if (!response.ok || !data.access_token) {
    throw new Error(`Google OAuth token refresh failed: ${data.error_description ?? response.statusText}`);
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

export async function downloadPhotoFromGoogleDrive(fileId: string) {
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

export const googleDriveScope = DRIVE_FILE_SCOPE;
