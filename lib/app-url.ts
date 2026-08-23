type AppUrlEnvironment = { APP_URL?: string; VERCEL_URL?: string; VERCEL_ENV?: string };

export function getAppOrigin(
  request: Request,
  environment: AppUrlEnvironment = {
    APP_URL: process.env.APP_URL,
    VERCEL_URL: process.env.VERCEL_URL,
    VERCEL_ENV: process.env.VERCEL_ENV,
  },
) {
  const vercelHost = environment.VERCEL_URL?.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
  if (environment.VERCEL_ENV === 'preview' && vercelHost) return new URL(`https://${vercelHost}`).origin;

  const configured = environment.APP_URL?.trim();
  if (configured) return new URL(configured).origin;

  if (vercelHost) return new URL(`https://${vercelHost}`).origin;

  return new URL(request.url).origin;
}

export function getAppUrl(request: Request, path: string) {
  return new URL(path, `${getAppOrigin(request)}/`).toString();
}
