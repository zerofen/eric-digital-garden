import { ArrowLeft, Sprout } from 'lucide-react';
export default function NotFound() {
  return (
    <main id="main" className="not-found">
      <p className="eyebrow">404 / A LITTLE DETOUR</p>
      <h1>这条小路，还没有开垦。</h1>
      <Sprout size={60} strokeWidth={1} />
      <p>
        也许地址写错了，也许这篇记录已经搬家。
        <br />
        回花园里，再逛逛吧。
      </p>
      <a className="button button-primary" href="/">
        <ArrowLeft size={16} />
        回到首页
      </a>
    </main>
  );
}
