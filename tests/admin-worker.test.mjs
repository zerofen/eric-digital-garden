import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createSessionToken,
  parsePostSummary,
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
