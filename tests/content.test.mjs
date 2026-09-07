import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePost, validateContent } from '../lib/content.mjs';

const header =
  '---\ntitle: "测试文章"\ndescription: "测试摘要"\ndate: "2026-09-07"\ntags: ["学习"]\n';
test('Markdown 渲染保留正文、代码和互不重复的标题锚点', () => {
  const post = parsePost(
    `${header}---\n\n## 相同标题\n\n**重点**\n\n## 相同标题\n\n\`\`\`js\nconst x = 1;\n\`\`\``,
    'sample',
  );
  assert.match(post.html, /<strong>重点<\/strong>/);
  assert.match(post.html, /language-js/);
  assert.deepEqual(
    post.headings.map((h) => h.id),
    ['section-1', 'section-2'],
  );
});
test('不安全的 Markdown HTML、事件与链接不能进入成品', () => {
  const post = parsePost(
    `${header}---\n\n<script>alert(1)</script><img src="x" onerror="alert(2)">\n\n[危险](javascript:alert(3))`,
    'safe',
  );
  assert.doesNotMatch(post.html, /<script|onerror|javascript:/i);
});
test('拒绝无效日期、缺少摘要、错误标签与非布尔草稿状态', () => {
  for (const source of [
    header.replace('2026-09-07', '2026-02-30'),
    header.replace('description: "测试摘要"\n', ''),
    header.replace('["学习"]', '学习'),
    `${header}draft: "false"\n`,
  ]) {
    assert.throws(() => parsePost(`${source}---\n\n正文`, 'invalid'));
  }
  assert.throws(() => parsePost(`${header}---\n\n正文`, '../escape'));
});
test('草稿与示例标记保持正确，阅读时间不为零', () => {
  const post = parsePost(
    `${header}draft: true\nexample: true\n---\n\n尚未发表`,
    'draft',
  );
  assert.equal(post.draft, true);
  assert.equal(post.example, true);
  assert.equal(post.readingMinutes, 1);
});
test('拒绝可执行 JavaScript frontmatter', () => {
  assert.throws(() =>
    parsePost('---js\n({title: "unsafe"})\n---\n正文', 'unsafe'),
  );
});
test('当前配置、头像和全部内容通过一致性检查', () => {
  const { posts } = validateContent();
  assert.ok(posts.every((post) => post.html && post.title));
});
