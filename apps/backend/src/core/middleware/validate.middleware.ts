import { Request, Response, NextFunction } from 'express';

export function validate<T>(schema: { parse: (data: unknown) => T }) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const parsed = schema.parse({
        ...req.body,
        ...req.query,
        ...req.params,
      });
      req.body = parsed;
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function validateBody<T>(schema: { parse: (data: unknown) => T }) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function validateQuery<T>(schema: { parse: (data: unknown) => T }) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const parsed = schema.parse(req.query);
      Object.assign(req.query, parsed);
      next();
    } catch (error) {
      next(error);
    }
  };
}
