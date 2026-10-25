import type { NextFunction, Request, Response } from 'express';
import { originCheck } from './origin.js';

function run(origin: string | undefined) {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  const next = vi.fn();
  originCheck('http://localhost:5173')(
    { headers: origin ? { origin } : {} } as Request,
    res as unknown as Response,
    next as NextFunction,
  );
  return { res, next };
}

describe('originCheck', () => {
  it('passes requests without an Origin header', () => {
    expect(run(undefined).next).toHaveBeenCalled();
  });

  it('passes the configured web origin', () => {
    expect(run('http://localhost:5173').next).toHaveBeenCalled();
  });

  it('rejects any other origin with 403', () => {
    const { res, next } = run('http://localhost:5174');
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
