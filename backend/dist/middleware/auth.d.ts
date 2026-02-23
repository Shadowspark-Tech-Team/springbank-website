import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../types';
export declare function authenticate(req: Request, res: Response, next: NextFunction): void;
export declare function requireRole(...roles: UserRole[]): (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=auth.d.ts.map