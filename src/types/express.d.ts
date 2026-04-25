import { JwtPayload } from '../auth/guard/access-token.guard';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}
