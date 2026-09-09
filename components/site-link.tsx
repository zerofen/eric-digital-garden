'use client';

import { useRouter } from 'next/navigation';
import type {
  AnchorHTMLAttributes,
  MouseEvent as ReactMouseEvent,
} from 'react';

type SiteLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  href: string;
  replace?: boolean;
  scroll?: boolean;
};

export function SiteLink({
  href,
  replace = false,
  scroll = true,
  onClick,
  target,
  children,
  ...props
}: SiteLinkProps) {
  const router = useRouter();

  function handleClick(event: ReactMouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      props.download !== undefined ||
      (target && target !== '_self')
    )
      return;

    const destination = new URL(href, window.location.href);
    if (destination.origin !== window.location.origin) return;

    // vinext beta.5 的 next/link 动态导航模块在生产构建后会丢失命名导出。
    // 直接使用公开的 App Router API，可保持根布局中的音频节点不被卸载。
    event.preventDefault();
    const route = `${destination.pathname}${destination.search}${destination.hash}`;
    if (replace) router.replace(route, { scroll });
    else router.push(route, { scroll });
  }

  return (
    <a {...props} href={href} target={target} onClick={handleClick}>
      {children}
    </a>
  );
}
