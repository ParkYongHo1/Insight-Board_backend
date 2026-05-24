import { JwtPayload } from '../auth/guard/access-token.guard';
export {};
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}
