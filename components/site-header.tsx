'use client';
import { usePathname } from 'next/navigation';
import { navigation, site } from '@/lib/site';
import { AdminConsole } from '@/components/admin-console';

export function SiteHeader() {
  const pathname = usePathname();
  return (
    <header className="site-header">
      <div className="header-inner">
        <div className="brand">
          <AdminConsole avatar={site.avatar} name={site.name} />
          <a href="/" aria-label={`${site.name}，返回首页`}>
            {site.name}
            <span className="brand-dot">.</span>
          </a>
        </div>
        <nav aria-label="主导航">
          {navigation.map((item) => (
            <a
              key={item.href}
              href={item.href}
              aria-current={
                (
                  item.href === '/'
                    ? pathname === '/'
                    : pathname.startsWith(item.href.slice(0, -1))
                )
                  ? 'page'
                  : undefined
              }
            >
              {item.label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}
