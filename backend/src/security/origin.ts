import type { NextFunction, Request, Response } from 'express';

/**
 * Rejects any request whose `Origin` header is present and is not the one web
 * origin. Requests without `Origin` (curl, same-origin GET) pass.
 */
export function originCheck(webOrigin: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const origin = req.headers.origin;
    if (origin !== undefined && origin !== webOrigin) {
      res.status(403).json({
        statusCode: 403,
        message: 'Origin not allowed',
        error: 'Forbidden',
      });
      return;
    }
    next();
  };
}
