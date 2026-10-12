import { readServerBootstrap } from './serverBootstrap';
export function readInitialScopedFeed() {
  return readServerBootstrap('initial-scoped-deals');
}
