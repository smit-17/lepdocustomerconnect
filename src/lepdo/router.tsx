// Thin compatibility layer so the LEPDO screens can use familiar link/navigation
// helpers on top of TanStack Router.
import {
  Link as TLink,
  Navigate as TNavigate,
  Outlet,
  useLocation,
  useNavigate as useTNavigate,
  useParams as useTParams,
  useRouterState,
} from '@tanstack/react-router';
import { useCallback, useMemo, type AnchorHTMLAttributes, type ReactNode } from 'react';

export { Outlet, useLocation };

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { to: string; replace?: boolean; children?: ReactNode };

export function Link({ to, replace, ...rest }: LinkProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <TLink to={to as any} replace={replace} {...(rest as any)} />;
}

type NavLinkProps = Omit<LinkProps, 'className'> & { end?: boolean; className?: string | ((s: { isActive: boolean }) => string) };

export function NavLink({ to, end, className, ...rest }: NavLinkProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const clean = pathname.replace(/\/+$/, '') || '/';
  const isActive = end ? clean === to : clean === to || clean.startsWith(to + '/');
  const cls = typeof className === 'function' ? className({ isActive }) : className;
  return <Link to={to} className={cls} aria-current={isActive ? 'page' : undefined} {...rest} />;
}

export function Navigate({ to, replace }: { to: string; replace?: boolean }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <TNavigate to={to as any} replace={replace} />;
}

export function useNavigate() {
  const nav = useTNavigate();
  return useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (to: string, opts?: { replace?: boolean }) => nav({ to: to as any, replace: opts?.replace }),
    [nav],
  );
}

export function useParams(): Record<string, string | undefined> {
  return useTParams({ strict: false }) as Record<string, string | undefined>;
}

export function useSearchParams(): [URLSearchParams, (next: Record<string, string>, opts?: { replace?: boolean }) => void] {
  const search = useRouterState({ select: (s) => s.location.searchStr });
  const nav = useTNavigate();
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const set = useCallback(
    (next: Record<string, string>, opts?: { replace?: boolean }) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      nav({ to: '.' as any, search: next as any, replace: opts?.replace }),
    [nav],
  );
  return [params, set];
}
