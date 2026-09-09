import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createSessionToken,
  parseCollectionsSource,
  parsePostSummary,
  resolveAssetRequest,
  validateCollectionItems,
  validatePostInput,
  verifySessionToken,
} from '../worker/index.mjs';
import worker from '../worker/index.mjs';

const validPost = `---
title: '测试文章'
description: '用于测试管理员接口。'
date: '2026-09-07'
tags: ['测试']
draft: true
---

正文内容。
`;

test('管理员会话可验证签名和过期时间', async () => {
  const now = Date.UTC(2026, 8, 7);
  const token = await createSessionToken('a-long-test-session-secret', now);
  assert.equal(
    await verifySessionToken('a-long-test-session-secret', token, now + 1000),
    true,
  );
  assert.equal(
    await verifySessionToken('another-secret', token, now + 1000),
    false,
  );
  assert.equal(
    await verifySessionToken(
      'a-long-test-session-secret',
      token,
      now + 5 * 60 * 60 * 1000,
    ),
    false,
  );
});

test('文章写入只接受安全文件名和完整 Markdown', () => {
  assert.equal(validatePostInput('safe-post-2', validPost), true);
  assert.throws(() => validatePostInput('../unsafe', validPost), /文件名/);
  assert.throws(
    () => validatePostInput('missing-frontmatter', '只有正文'),
    /YAML/,
  );
});

test('文章摘要从 frontmatter 提取', () => {
  assert.deepEqual(parsePostSummary('test-post', validPost, 'sha-1'), {
    slug: 'test-post',
    title: '测试文章',
    description: '用于测试管理员接口。',
    date: '2026-09-07',
    draft: true,
    sha: 'sha-1',
  });
});

test('登录接口签发 HttpOnly 会话且不会返回密码', async () => {
  const response = await worker.fetch(
    new Request('https://eric.sryze.cc/api/admin/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://eric.sryze.cc',
      },
      body: JSON.stringify({ password: 'test-password' }),
    }),
    {
      ADMIN_PASSWORD: 'test-password',
      SESSION_SECRET: 'a-long-test-session-secret',
      GITHUB_TOKEN: 'unused-in-login-test',
      GITHUB_OWNER: 'test-owner',
      GITHUB_REPO: 'test-repository',
    },
  );
  const body = await response.text();
  assert.equal(response.status, 200);
  assert.match(
    response.headers.get('Set-Cookie'),
    /HttpOnly; Secure; SameSite=Strict/,
  );
  assert.doesNotMatch(body, /test-password/);
});

test('未登录访问管理接口返回 401', async () => {
  const response = await worker.fetch(
    new Request('https://eric.sryze.cc/api/admin/collections'),
    {
      ADMIN_PASSWORD: 'test-password',
      SESSION_SECRET: 'a-long-test-session-secret',
      GITHUB_TOKEN: 'unused-in-auth-test',
      GITHUB_OWNER: 'test-owner',
      GITHUB_REPO: 'test-repository',
    },
  );

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: '请先登录。' });
});

test('站内导航的 RSC 请求读取对应静态资源', async () => {
  const seen = [];
  const response = await worker.fetch(
    new Request('https://eric.sryze.cc/posts?_rsc=cache-key', {
      headers: { Accept: 'text/x-component', RSC: '1' },
    }),
    {
      ASSETS: {
        fetch(request) {
          seen.push(request.url);
          return new Response('rsc payload');
        },
      },
    },
  );

  assert.deepEqual(seen, ['https://eric.sryze.cc/posts.rsc']);
  assert.equal(
    response.headers.get('Content-Type'),
    'text/x-component; charset=utf-8',
  );
  assert.equal(
    response.headers.get('X-Vinext-RSC-Compatibility-Id'),
    'eric-garden-static-v1',
  );
  assert.equal(await response.text(), 'rsc payload');
  assert.equal(
    resolveAssetRequest(
      new Request('https://eric.sryze.cc/?_rsc=root', {
        headers: { RSC: '1' },
      }),
    ).url,
    'https://eric.sryze.cc/index.rsc',
  );
});

test('音频资源支持拖动播放所需的字节区间响应', async () => {
  const response = await worker.fetch(
    new Request('https://eric.sryze.cc/music/song.mp3', {
      headers: { Range: 'bytes=2-4' },
    }),
    {
      ASSETS: {
        fetch() {
          return new Response('abcdef', {
            headers: { 'Content-Type': 'audio/mpeg' },
          });
        },
      },
    },
  );

  assert.equal(response.status, 206);
  assert.equal(response.headers.get('Accept-Ranges'), 'bytes');
  assert.equal(response.headers.get('Content-Range'), 'bytes 2-4/6');
  assert.equal(response.headers.get('Content-Length'), '3');
  assert.equal(await response.text(), 'cde');
});

test('管理接口拒绝超限请求体并返回 413', async () => {
  const response = await worker.fetch(
    new Request('https://eric.sryze.cc/api/admin/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': String(2 * 1024 * 1024),
        Origin: 'https://eric.sryze.cc',
      },
      body: '{}',
    }),
    {
      ADMIN_PASSWORD: 'test-password',
      SESSION_SECRET: 'a-long-test-session-secret',
      GITHUB_TOKEN: 'unused-in-login-test',
      GITHUB_OWNER: 'test-owner',
      GITHUB_REPO: 'test-repository',
    },
  );

  assert.equal(response.status, 413);
  assert.deepEqual(await response.json(), { error: '请求内容过大。' });
});

test('四种栏目使用各自的数据结构并清理空白可选字段', () => {
  assert.deepEqual(
    validateCollectionItems('projects', [
      {
        title: '  DriveMind  ',
        description: '驾驶员监测系统',
        status: '',
        tags: [' AI ', '安全'],
      },
    ]),
    [
      {
        title: 'DriveMind',
        description: '驾驶员监测系统',
        tags: ['AI', '安全'],
      },
    ],
  );
  assert.deepEqual(
    validateCollectionItems('books', [{ title: '书', author: '作者' }]),
    [{ title: '书', author: '作者' }],
  );
  assert.deepEqual(
    validateCollectionItems('music', [{ title: '歌', artist: '歌手' }]),
    [{ title: '歌', artist: '歌手' }],
  );
  assert.deepEqual(
    validateCollectionItems('moments', [
      { date: '2026-09-08', text: '今天的片段', example: false },
    ]),
    [{ date: '2026-09-08', text: '今天的片段' }],
  );
});

test('项目链接支持 HTTP 服务和站内路径', () => {
  const [httpProject, localProject] = validateCollectionItems('projects', [
    {
      title: 'HTTP 服务',
      description: '带端口的项目地址',
      url: 'http://47.94.9.61:8317',
    },
    {
      title: '站内项目',
      description: '站内项目页面',
      url: '/projects/demo',
    },
  ]);

  assert.equal(httpProject.url, 'http://47.94.9.61:8317');
  assert.equal(localProject.url, '/projects/demo');
});

test('栏目接口拒绝危险链接、无效日期和未知栏目', () => {
  assert.throws(
    () =>
      validateCollectionItems('projects', [
        { title: '项目', description: '介绍', url: 'javascript:alert(1)' },
      ]),
    /HTTP\(S\)/,
  );
  assert.throws(
    () =>
      validateCollectionItems('moments', [
        { date: '2026-02-30', text: '日期' },
      ]),
    /日期/,
  );
  assert.throws(() => validateCollectionItems('unknown', []), /栏目/);
  assert.throws(
    () => parseCollectionsSource('{"projects":[]}'),
    /栏目内容必须是数组/,
  );
});
