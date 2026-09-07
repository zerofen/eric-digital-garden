'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type AdminPost = {
  slug: string;
  title: string;
  description: string;
  date: string;
  draft: boolean;
  sha: string;
  content?: string;
};

type ApiErrorBody = { error?: string };

class AdminApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function adminRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/admin${path}`, {
    ...init,
    credentials: 'same-origin',
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });
  const payload = (await response.json().catch(() => ({}))) as T & ApiErrorBody;
  if (!response.ok)
    throw new AdminApiError(
      response.status,
      payload.error || `请求失败（${response.status}）`,
    );
  return payload;
}

function newPostTemplate() {
  const date = new Date().toISOString().slice(0, 10);
  return `---\ntitle: '新文章标题'\ndescription: '用一句话介绍这篇文章。'\ndate: '${date}'\ntags: []\ndraft: true\n---\n\n从这里开始写正文。\n`;
}

export function AdminConsole({
  avatar,
  name,
}: {
  avatar: string;
  name: string;
}) {
  const clickTimes = useRef<number[]>([]);
  const [open, setOpen] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [posts, setPosts] = useState<AdminPost[]>([]);
  const [selected, setSelected] = useState<AdminPost | null>(null);
  const [content, setContent] = useState('');
  const [slug, setSlug] = useState('');
  const [isNew, setIsNew] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const loadPosts = useCallback(async () => {
    setBusy(true);
    setMessage('');
    try {
      const result = await adminRequest<{ posts: AdminPost[] }>('/posts');
      setPosts(result.posts);
      setAuthenticated(true);
    } catch (error) {
      if (error instanceof AdminApiError && error.status === 401) {
        setAuthenticated(false);
      } else {
        setMessage(
          error instanceof Error ? error.message : '无法读取文章列表。',
        );
      }
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void loadPosts();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [loadPosts, open]);

  function handleAvatarClick() {
    const now = Date.now();
    clickTimes.current = [
      ...clickTimes.current.filter((time) => now - time < 4000),
      now,
    ];
    if (clickTimes.current.length < 5) return;
    clickTimes.current = [];
    setOpen(true);
  }

  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      await adminRequest('/login', {
        method: 'POST',
        body: JSON.stringify({ password }),
      });
      setPassword('');
      setAuthenticated(true);
      await loadPosts();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '登录失败。');
      setBusy(false);
    }
  }

  async function editPost(post: AdminPost) {
    setBusy(true);
    setMessage('');
    try {
      const result = await adminRequest<{ post: AdminPost }>(
        `/posts/${post.slug}`,
      );
      setSelected(result.post);
      setSlug(result.post.slug);
      setContent(result.post.content || '');
      setIsNew(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '无法读取文章。');
    } finally {
      setBusy(false);
    }
  }

  function createPost() {
    setSelected(null);
    setSlug('');
    setContent(newPostTemplate());
    setIsNew(true);
    setMessage('新文章默认是草稿，保存后不会立即出现在公开页面。');
  }

  async function savePost(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      await adminRequest(isNew ? '/posts' : `/posts/${selected?.slug}`, {
        method: isNew ? 'POST' : 'PUT',
        body: JSON.stringify({ slug, content, sha: selected?.sha }),
      });
      setSelected(null);
      setContent('');
      setSlug('');
      setIsNew(false);
      await loadPosts();
      setMessage('已经提交到 GitHub，Cloudflare 完成构建后公开页面会更新。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存失败。');
    } finally {
      setBusy(false);
    }
  }

  async function deletePost() {
    if (!selected) return;
    if (
      !window.confirm(
        `确认删除《${selected.title}》？Git 历史仍可恢复这篇文章。`,
      )
    )
      return;
    setBusy(true);
    setMessage('');
    try {
      await adminRequest(`/posts/${selected.slug}`, {
        method: 'DELETE',
        body: JSON.stringify({ sha: selected.sha }),
      });
      setSelected(null);
      setContent('');
      setSlug('');
      await loadPosts();
      setMessage('删除提交已发送，Cloudflare 完成构建后文章会从网站移除。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '删除失败。');
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    setBusy(true);
    try {
      await adminRequest('/logout', { method: 'POST' });
    } finally {
      setAuthenticated(false);
      setPosts([]);
      setSelected(null);
      setContent('');
      setBusy(false);
    }
  }

  return (
    <>
      <button
        className="admin-avatar-trigger"
        type="button"
        onClick={handleAvatarClick}
        aria-label={`${name} 的头像`}
        aria-haspopup="dialog"
      >
        <img src={avatar} width="32" height="32" alt="" />
      </button>
      {open ? (
        <div className="admin-overlay" role="presentation">
          <section
            className="admin-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="博客管理员"
          >
            <header className="admin-header">
              <div>
                <span>ERIC&apos;S GARDEN</span>
                <h2>管理员模式</h2>
              </div>
              <div className="admin-header-actions">
                {authenticated ? (
                  <button
                    type="button"
                    onClick={() => void logout()}
                    disabled={busy}
                  >
                    退出登录
                  </button>
                ) : null}
                <button
                  className="admin-close"
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="关闭管理员模式"
                >
                  ×
                </button>
              </div>
            </header>

            {!authenticated ? (
              <form className="admin-login" onSubmit={login}>
                <p>
                  输入管理员密码后管理文章。密码仅发送给 Cloudflare Worker。
                </p>
                <label htmlFor="admin-password">管理员密码</label>
                <input
                  id="admin-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoFocus
                  required
                />
                <button className="admin-primary" type="submit" disabled={busy}>
                  {busy ? '正在验证…' : '进入花园后台'}
                </button>
                {message ? <p className="admin-message">{message}</p> : null}
              </form>
            ) : (
              <div className="admin-workspace">
                <aside className="admin-sidebar">
                  <div className="admin-sidebar-title">
                    <strong>文章</strong>
                    <button type="button" onClick={createPost} disabled={busy}>
                      ＋ 新建
                    </button>
                  </div>
                  <div className="admin-posts">
                    {posts.map((post) => (
                      <button
                        type="button"
                        key={post.slug}
                        className={
                          selected?.slug === post.slug ? 'is-active' : ''
                        }
                        onClick={() => void editPost(post)}
                        disabled={busy}
                      >
                        <span>{post.title}</span>
                        <small>
                          {post.date} · {post.draft ? '草稿' : '公开'}
                        </small>
                      </button>
                    ))}
                  </div>
                </aside>

                <main className="admin-editor">
                  {isNew || selected ? (
                    <form onSubmit={savePost}>
                      <div className="admin-editor-toolbar">
                        <label>
                          文件名
                          <span>
                            <input
                              value={slug}
                              onChange={(event) => setSlug(event.target.value)}
                              disabled={!isNew}
                              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                              placeholder="my-new-post"
                              required
                            />
                            .md
                          </span>
                        </label>
                        <div>
                          {!isNew ? (
                            <button
                              className="admin-danger"
                              type="button"
                              onClick={() => void deletePost()}
                              disabled={busy}
                            >
                              删除
                            </button>
                          ) : null}
                          <button
                            className="admin-primary"
                            type="submit"
                            disabled={busy}
                          >
                            {busy ? '提交中…' : '保存到 GitHub'}
                          </button>
                        </div>
                      </div>
                      <label
                        className="admin-content-label"
                        htmlFor="admin-content"
                      >
                        Markdown 内容
                      </label>
                      <textarea
                        id="admin-content"
                        value={content}
                        onChange={(event) => setContent(event.target.value)}
                        spellCheck="false"
                        required
                      />
                    </form>
                  ) : (
                    <div className="admin-empty">
                      <span>✦</span>
                      <p>选择一篇文章编辑，或新建一篇草稿。</p>
                    </div>
                  )}
                  {message ? <p className="admin-message">{message}</p> : null}
                </main>
              </div>
            )}
          </section>
        </div>
      ) : null}
    </>
  );
}
