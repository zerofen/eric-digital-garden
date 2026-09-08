'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type CollectionKey = 'projects' | 'books' | 'music' | 'moments';
type SectionKey = 'posts' | CollectionKey;

type AdminPost = {
  slug: string;
  title: string;
  description: string;
  date: string;
  draft: boolean;
  sha: string;
  content?: string;
};

type CollectionItem = {
  title?: string;
  description?: string;
  status?: string;
  url?: string;
  tags?: string[];
  author?: string;
  note?: string;
  artist?: string;
  audio?: string;
  date?: string;
  text?: string;
  example?: boolean;
};

type Collections = Record<CollectionKey, CollectionItem[]>;

type CollectionDraft = {
  title: string;
  description: string;
  status: string;
  url: string;
  tags: string;
  author: string;
  note: string;
  artist: string;
  audio: string;
  date: string;
  text: string;
  example: boolean;
};

type ApiErrorBody = { error?: string };

const emptyCollections: Collections = {
  projects: [],
  books: [],
  music: [],
  moments: [],
};

const sectionMeta: Record<
  SectionKey,
  { label: string; eyebrow: string; singular: string; empty: string }
> = {
  posts: {
    label: '文章',
    eyebrow: 'WRITING',
    singular: '文章',
    empty: '选择一篇文章编辑，或新建一篇草稿。',
  },
  projects: {
    label: '项目',
    eyebrow: 'PROJECTS',
    singular: '项目',
    empty: '选择一个项目编辑，或添加新的作品。',
  },
  books: {
    label: '书架',
    eyebrow: 'BOOKS',
    singular: '书籍',
    empty: '选择一本书编辑，或把新书放上书架。',
  },
  music: {
    label: '音乐',
    eyebrow: 'MUSIC',
    singular: '歌曲',
    empty: '选择一首歌编辑，或收藏新的旋律。',
  },
  moments: {
    label: '此刻',
    eyebrow: 'MOMENTS',
    singular: '此刻',
    empty: '选择一条此刻编辑，或记录今天的片段。',
  },
};

class AdminApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function adminRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has('Content-Type'))
    headers.set('Content-Type', 'application/json');
  const response = await fetch(`/api/admin${path}`, {
    ...init,
    credentials: 'same-origin',
    headers,
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

function emptyCollectionDraft(): CollectionDraft {
  return {
    title: '',
    description: '',
    status: '',
    url: '',
    tags: '',
    author: '',
    note: '',
    artist: '',
    audio: '',
    date: new Date().toISOString().slice(0, 10),
    text: '',
    example: false,
  };
}

function collectionItemToDraft(item: CollectionItem): CollectionDraft {
  return {
    ...emptyCollectionDraft(),
    title: item.title || '',
    description: item.description || '',
    status: item.status || '',
    url: item.url || '',
    tags: item.tags?.join('，') || '',
    author: item.author || '',
    note: item.note || '',
    artist: item.artist || '',
    audio: item.audio || '',
    date: item.date || new Date().toISOString().slice(0, 10),
    text: item.text || '',
    example: item.example || false,
  };
}

function optional(value: string) {
  return value.trim() || undefined;
}

function collectionDraftToItem(
  collection: CollectionKey,
  draft: CollectionDraft,
): CollectionItem {
  if (collection === 'projects') {
    const tags = draft.tags
      .split(/[,，]/)
      .map((tag) => tag.trim())
      .filter(Boolean);
    return {
      title: draft.title.trim(),
      description: draft.description.trim(),
      status: optional(draft.status),
      url: optional(draft.url),
      tags: tags.length ? tags : undefined,
    };
  }
  if (collection === 'books') {
    return {
      title: draft.title.trim(),
      author: draft.author.trim(),
      note: optional(draft.note),
      status: optional(draft.status),
      url: optional(draft.url),
    };
  }
  if (collection === 'music') {
    return {
      title: draft.title.trim(),
      artist: draft.artist.trim(),
      note: optional(draft.note),
      url: optional(draft.url),
      audio: optional(draft.audio),
    };
  }
  return {
    date: draft.date,
    text: draft.text.trim(),
    example: draft.example || undefined,
  };
}

function itemTitle(collection: CollectionKey, item: CollectionItem) {
  if (collection === 'moments') {
    const text = item.text || '未命名此刻';
    return text.length > 28 ? `${text.slice(0, 28)}…` : text;
  }
  return item.title || `未命名${sectionMeta[collection].singular}`;
}

function itemMeta(collection: CollectionKey, item: CollectionItem) {
  if (collection === 'projects')
    return item.status || item.tags?.join(' · ') || '项目';
  if (collection === 'books')
    return [item.author, item.status].filter(Boolean).join(' · ') || '书架';
  if (collection === 'music') return item.artist || '音乐';
  return item.date || '此刻';
}

function TextField({
  label,
  value,
  onChange,
  required,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  type?: 'text' | 'url' | 'date';
}) {
  return (
    <label className="admin-field">
      <span>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        placeholder={placeholder}
      />
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  required,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="admin-field admin-field-wide">
      <span>{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        placeholder={placeholder}
      />
    </label>
  );
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
  const [section, setSection] = useState<SectionKey>('posts');
  const [posts, setPosts] = useState<AdminPost[]>([]);
  const [collections, setCollections] = useState<Collections>(emptyCollections);
  const [collectionsSha, setCollectionsSha] = useState('');
  const [selectedPost, setSelectedPost] = useState<AdminPost | null>(null);
  const [postContent, setPostContent] = useState('');
  const [postSlug, setPostSlug] = useState('');
  const [postIsNew, setPostIsNew] = useState(false);
  const [selectedCollectionIndex, setSelectedCollectionIndex] = useState<
    number | null
  >(null);
  const [collectionDraft, setCollectionDraft] =
    useState<CollectionDraft>(emptyCollectionDraft);
  const [collectionIsNew, setCollectionIsNew] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const loadDashboard = useCallback(async () => {
    const [postResult, collectionResult] = await Promise.all([
      adminRequest<{ posts: AdminPost[] }>('/posts'),
      adminRequest<{ collections: Collections; sha: string }>('/collections'),
    ]);
    setPosts(postResult.posts);
    setCollections(collectionResult.collections);
    setCollectionsSha(collectionResult.sha);
  }, []);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [open]);

  function clearSelection() {
    setSelectedPost(null);
    setPostContent('');
    setPostSlug('');
    setPostIsNew(false);
    setSelectedCollectionIndex(null);
    setCollectionDraft(emptyCollectionDraft());
    setCollectionIsNew(false);
  }

  async function openAuthenticatedDashboard() {
    setBusy(true);
    setMessage('');
    try {
      await loadDashboard();
      setAuthenticated(true);
    } catch (error) {
      if (error instanceof AdminApiError && error.status === 401) {
        setAuthenticated(false);
      } else {
        setMessage(
          error instanceof Error ? error.message : '无法读取花园内容。',
        );
      }
    } finally {
      setBusy(false);
    }
  }

  function handleAvatarClick() {
    const now = Date.now();
    clickTimes.current = [
      ...clickTimes.current.filter((time) => now - time < 4000),
      now,
    ];
    if (clickTimes.current.length < 5) return;
    clickTimes.current = [];
    setOpen(true);
    void openAuthenticatedDashboard();
  }

  async function login(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      await adminRequest('/login', {
        method: 'POST',
        body: JSON.stringify({ password }),
      });
      setPassword('');
      await loadDashboard();
      setAuthenticated(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '登录失败。');
    } finally {
      setBusy(false);
    }
  }

  function switchSection(nextSection: SectionKey) {
    setSection(nextSection);
    clearSelection();
    setMessage('');
  }

  async function editPost(post: AdminPost) {
    setBusy(true);
    setMessage('');
    try {
      const result = await adminRequest<{ post: AdminPost }>(
        `/posts/${post.slug}`,
      );
      setSelectedPost(result.post);
      setPostSlug(result.post.slug);
      setPostContent(result.post.content || '');
      setPostIsNew(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '无法读取文章。');
    } finally {
      setBusy(false);
    }
  }

  function createPost() {
    setSelectedPost(null);
    setPostSlug('');
    setPostContent(newPostTemplate());
    setPostIsNew(true);
    setMessage('新文章默认是草稿，确认内容后可在 Markdown 中改为公开。');
  }

  async function savePost(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      await adminRequest(
        postIsNew ? '/posts' : `/posts/${selectedPost?.slug}`,
        {
          method: postIsNew ? 'POST' : 'PUT',
          body: JSON.stringify({
            slug: postSlug,
            content: postContent,
            sha: selectedPost?.sha,
          }),
        },
      );
      clearSelection();
      await loadDashboard();
      setMessage('文章已提交到 GitHub。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存失败。');
    } finally {
      setBusy(false);
    }
  }

  async function deletePost() {
    if (!selectedPost) return;
    if (
      !window.confirm(
        `确认删除《${selectedPost.title}》？Git 历史仍可恢复这篇文章。`,
      )
    )
      return;
    setBusy(true);
    setMessage('');
    try {
      await adminRequest(`/posts/${selectedPost.slug}`, {
        method: 'DELETE',
        body: JSON.stringify({ sha: selectedPost.sha }),
      });
      clearSelection();
      await loadDashboard();
      setMessage('文章删除提交已发送到 GitHub。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '删除失败。');
    } finally {
      setBusy(false);
    }
  }

  function editCollectionItem(index: number) {
    if (section === 'posts') return;
    setSelectedCollectionIndex(index);
    setCollectionDraft(collectionItemToDraft(collections[section][index]));
    setCollectionIsNew(false);
    setMessage('');
  }

  function createCollectionItem() {
    setSelectedCollectionIndex(null);
    setCollectionDraft(emptyCollectionDraft());
    setCollectionIsNew(true);
    setMessage('');
  }

  function updateDraft(field: keyof CollectionDraft, value: string | boolean) {
    setCollectionDraft((current) => ({ ...current, [field]: value }));
  }

  async function saveCollectionItem(
    event: React.SyntheticEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    if (section === 'posts') return;
    const items = [...collections[section]];
    const nextItem = collectionDraftToItem(section, collectionDraft);
    if (collectionIsNew) items.push(nextItem);
    else if (selectedCollectionIndex !== null)
      items[selectedCollectionIndex] = nextItem;
    else return;

    setBusy(true);
    setMessage('');
    try {
      await adminRequest(`/collections/${section}`, {
        method: 'PUT',
        body: JSON.stringify({ items, sha: collectionsSha }),
      });
      clearSelection();
      await loadDashboard();
      setMessage(`${sectionMeta[section].label}内容已提交到 GitHub。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存失败。');
    } finally {
      setBusy(false);
    }
  }

  async function deleteCollectionItem() {
    if (section === 'posts' || selectedCollectionIndex === null) return;
    const item = collections[section][selectedCollectionIndex];
    if (
      !window.confirm(
        `确认删除“${itemTitle(section, item)}”？Git 历史仍可恢复这条内容。`,
      )
    )
      return;
    const items = collections[section].filter(
      (_, index) => index !== selectedCollectionIndex,
    );
    setBusy(true);
    setMessage('');
    try {
      await adminRequest(`/collections/${section}`, {
        method: 'PUT',
        body: JSON.stringify({ items, sha: collectionsSha }),
      });
      clearSelection();
      await loadDashboard();
      setMessage(`${sectionMeta[section].singular}已从 GitHub 内容中删除。`);
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
      setCollections(emptyCollections);
      setCollectionsSha('');
      clearSelection();
      setBusy(false);
    }
  }

  const collectionItems = section === 'posts' ? [] : collections[section];
  const currentCount =
    section === 'posts' ? posts.length : collections[section].length;
  const showCollectionForm =
    section !== 'posts' &&
    (collectionIsNew || selectedCollectionIndex !== null);

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
          <dialog
            open
            className="admin-dialog"
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
                  输入管理员密码后管理文章、项目、书架、音乐与此刻。密码仅发送给
                  Cloudflare Worker。
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
              <div className="admin-dashboard">
                <nav className="admin-section-tabs" aria-label="内容栏目">
                  {(Object.keys(sectionMeta) as SectionKey[]).map((key) => {
                    const count =
                      key === 'posts' ? posts.length : collections[key].length;
                    return (
                      <button
                        type="button"
                        key={key}
                        className={section === key ? 'is-active' : ''}
                        onClick={() => switchSection(key)}
                        aria-current={section === key ? 'page' : undefined}
                      >
                        <span>{sectionMeta[key].label}</span>
                        <small>{count}</small>
                      </button>
                    );
                  })}
                </nav>

                <div className="admin-workspace">
                  <aside className="admin-sidebar">
                    <div className="admin-sidebar-title">
                      <div>
                        <span>{sectionMeta[section].eyebrow}</span>
                        <strong>{sectionMeta[section].label}</strong>
                        <small>{currentCount} 条内容</small>
                      </div>
                      <button
                        type="button"
                        onClick={
                          section === 'posts'
                            ? createPost
                            : createCollectionItem
                        }
                        disabled={busy}
                      >
                        ＋ 新建
                      </button>
                    </div>
                    <div className="admin-items">
                      {section === 'posts'
                        ? posts.map((post) => (
                            <button
                              type="button"
                              key={post.slug}
                              className={
                                selectedPost?.slug === post.slug
                                  ? 'is-active'
                                  : ''
                              }
                              onClick={() => void editPost(post)}
                              disabled={busy}
                            >
                              <span>{post.title}</span>
                              <small>
                                {post.date} · {post.draft ? '草稿' : '公开'}
                              </small>
                            </button>
                          ))
                        : collectionItems.map((item, index) => (
                            <button
                              type="button"
                              key={`${itemTitle(section, item)}-${index}`}
                              className={
                                selectedCollectionIndex === index &&
                                !collectionIsNew
                                  ? 'is-active'
                                  : ''
                              }
                              onClick={() => editCollectionItem(index)}
                              disabled={busy}
                            >
                              <span>{itemTitle(section, item)}</span>
                              <small>{itemMeta(section, item)}</small>
                            </button>
                          ))}
                      {!currentCount ? (
                        <p className="admin-list-empty">这个栏目还没有内容。</p>
                      ) : null}
                    </div>
                  </aside>

                  <main className="admin-editor">
                    {section === 'posts' && (postIsNew || selectedPost) ? (
                      <form className="admin-post-form" onSubmit={savePost}>
                        <div className="admin-editor-toolbar">
                          <label>
                            文件名
                            <span>
                              <input
                                value={postSlug}
                                onChange={(event) =>
                                  setPostSlug(event.target.value)
                                }
                                disabled={!postIsNew}
                                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                                placeholder="my-new-post"
                                required
                              />
                              .md
                            </span>
                          </label>
                          <div>
                            {!postIsNew ? (
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
                              {busy ? '提交中…' : '保存文章'}
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
                          value={postContent}
                          onChange={(event) =>
                            setPostContent(event.target.value)
                          }
                          spellCheck="false"
                          required
                        />
                      </form>
                    ) : null}

                    {showCollectionForm ? (
                      <form
                        className="admin-structured-form"
                        onSubmit={saveCollectionItem}
                      >
                        <div className="admin-form-heading">
                          <div>
                            <span>{sectionMeta[section].eyebrow}</span>
                            <h3>
                              {collectionIsNew ? '新建' : '编辑'}
                              {sectionMeta[section].singular}
                            </h3>
                          </div>
                          <div>
                            {!collectionIsNew ? (
                              <button
                                className="admin-danger"
                                type="button"
                                onClick={() => void deleteCollectionItem()}
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
                              {busy ? '提交中…' : '保存内容'}
                            </button>
                          </div>
                        </div>

                        <div className="admin-form-grid">
                          {section === 'projects' ? (
                            <>
                              <TextField
                                label="项目名称"
                                value={collectionDraft.title}
                                onChange={(value) =>
                                  updateDraft('title', value)
                                }
                                required
                                placeholder="例如：DriveMind Lite"
                              />
                              <TextField
                                label="项目状态"
                                value={collectionDraft.status}
                                onChange={(value) =>
                                  updateDraft('status', value)
                                }
                                placeholder="进行中 / 已完成"
                              />
                              <TextAreaField
                                label="项目介绍"
                                value={collectionDraft.description}
                                onChange={(value) =>
                                  updateDraft('description', value)
                                }
                                required
                                placeholder="介绍项目解决的问题与特点。"
                              />
                              <TextField
                                label="标签"
                                value={collectionDraft.tags}
                                onChange={(value) => updateDraft('tags', value)}
                                placeholder="AI，视觉，安全"
                              />
                              <TextField
                                label="项目链接"
                                value={collectionDraft.url}
                                onChange={(value) => updateDraft('url', value)}
                                placeholder="https://... 或 /projects/..."
                              />
                            </>
                          ) : null}

                          {section === 'books' ? (
                            <>
                              <TextField
                                label="书名"
                                value={collectionDraft.title}
                                onChange={(value) =>
                                  updateDraft('title', value)
                                }
                                required
                              />
                              <TextField
                                label="作者"
                                value={collectionDraft.author}
                                onChange={(value) =>
                                  updateDraft('author', value)
                                }
                                required
                              />
                              <TextField
                                label="阅读状态"
                                value={collectionDraft.status}
                                onChange={(value) =>
                                  updateDraft('status', value)
                                }
                                placeholder="在读 / 已读 / 想读"
                              />
                              <TextField
                                label="书籍链接"
                                value={collectionDraft.url}
                                onChange={(value) => updateDraft('url', value)}
                                placeholder="https://... 或 /books/..."
                              />
                              <TextAreaField
                                label="读书笔记"
                                value={collectionDraft.note}
                                onChange={(value) => updateDraft('note', value)}
                                placeholder="记下这本书带来的想法。"
                              />
                            </>
                          ) : null}

                          {section === 'music' ? (
                            <>
                              <TextField
                                label="歌曲名"
                                value={collectionDraft.title}
                                onChange={(value) =>
                                  updateDraft('title', value)
                                }
                                required
                              />
                              <TextField
                                label="歌手"
                                value={collectionDraft.artist}
                                onChange={(value) =>
                                  updateDraft('artist', value)
                                }
                                required
                              />
                              <TextField
                                label="收听链接"
                                value={collectionDraft.url}
                                onChange={(value) => updateDraft('url', value)}
                                placeholder="https://... 或 /music/..."
                              />
                              <TextField
                                label="音频地址"
                                value={collectionDraft.audio}
                                onChange={(value) =>
                                  updateDraft('audio', value)
                                }
                                placeholder="/audio/song.mp3 或 https://..."
                              />
                              <TextAreaField
                                label="歌曲备注"
                                value={collectionDraft.note}
                                onChange={(value) => updateDraft('note', value)}
                                placeholder="一句歌词，或这首歌陪伴你的时刻。"
                              />
                            </>
                          ) : null}

                          {section === 'moments' ? (
                            <>
                              <TextField
                                label="日期"
                                value={collectionDraft.date}
                                onChange={(value) => updateDraft('date', value)}
                                type="date"
                                required
                              />
                              <label
                                className="admin-check-field"
                                htmlFor="admin-example"
                                aria-label="示例内容"
                              >
                                <input
                                  id="admin-example"
                                  type="checkbox"
                                  checked={collectionDraft.example}
                                  onChange={(event) =>
                                    updateDraft('example', event.target.checked)
                                  }
                                />
                                <span>
                                  <strong>示例内容</strong>
                                  <small>开启后会在公开页面标注“示例”。</small>
                                </span>
                              </label>
                              <TextAreaField
                                label="此刻内容"
                                value={collectionDraft.text}
                                onChange={(value) => updateDraft('text', value)}
                                required
                                placeholder="记下今天值得保存的一小段。"
                              />
                            </>
                          ) : null}
                        </div>
                      </form>
                    ) : null}

                    {section === 'posts' && !postIsNew && !selectedPost ? (
                      <div className="admin-empty">
                        <span>✦</span>
                        <p>{sectionMeta[section].empty}</p>
                      </div>
                    ) : null}
                    {section !== 'posts' && !showCollectionForm ? (
                      <div className="admin-empty">
                        <span>✦</span>
                        <p>{sectionMeta[section].empty}</p>
                      </div>
                    ) : null}
                    {message ? (
                      <p className="admin-message">{message}</p>
                    ) : null}
                  </main>
                </div>
              </div>
            )}
          </dialog>
        </div>
      ) : null}
    </>
  );
}
