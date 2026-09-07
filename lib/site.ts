import data from '@/content/site.json';
export const site = data;
export const navigation = [
  { href: '/', label: '首页' },
  { href: '/posts/', label: '文章' },
  { href: '/projects/', label: '项目' },
  { href: '/books/', label: '书架' },
  { href: '/music/', label: '音乐' },
  { href: '/now/', label: '此刻' },
];
export function formatDate(date: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'UTC',
  })
    .format(new Date(date))
    .replaceAll('/', '.');
}
