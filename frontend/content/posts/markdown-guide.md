---
title: 排版速查：这个博客支持哪些格式
date: 2026-10-20
tags: [指南, Markdown]
summary: 把常用语法和它们的实际效果摆在一起，写文章时照着抄，顺便当样式预览页。
---

这一页既是速查表，也是样式预览。想确认某段效果好不好看，回这里对照即可。

## 文字

普通段落，一段话不要写太长。中文段落之间不需要空行，Markdown 里空一行就是新段落。

**加粗**用来强调关键结论，*斜体* 用来标术语，`行内代码` 用来写变量名和文件名。~~删除线~~ 一般不用。

链接长这样：[GitHub](https://github.com)，外链会自动在新标签页打开。

## 列表

无序列表适合并列项：

- Vue 3 与组合式 API
- Vite 构建，`import.meta.glob` 读取文章
- marked 解析，highlight.js 高亮

有序列表适合步骤：

1. 新建 Markdown 文件
2. 填 frontmatter
3. commit 并 push

## 引用

> 写作是把想不清楚的事情，逼到必须说清楚为止。
>
> 引用的第二段会自动和第一段保持同样的缩进。

## 代码

行内 `const base = import.meta.env.BASE_URL` 不会换行。

带语言标记的代码块会高亮：

```js
import { allPosts, findPost } from '@/lib/posts'

const post = findPost('hello-world')
if (!post) throw new Error('文章不存在')
```

```bash
npm run dev
npm run build
```

```java
@GetMapping("/{id}")
public BlogPost getPost(@PathVariable Long id) {
    return service.getPostById(id);
}
```

不写语言名也能显示，只是没有高亮：

```text
纯文本块
```

## 表格

| 语法 | 效果 | 备注 |
| --- | --- | --- |
| `**粗体**` | **粗体** | 强调结论 |
| `` `代码` `` | `代码` | 变量、路径 |
| `> 引用` | 引用块 | 引述他人 |
| `![alt](/path)` | 图片 | 放 public/images |

## 分隔线

---

上面那条线就是三个短横线。

## 图片

图片放在 `frontend/public/images/`，引用时从根路径写：

```markdown
![示意图](/images/demo.png)
```

## 标题层级

正文里用 `##` 和 `###` 就够了。`####` 偶尔用，再往下会显得零碎。

### 三级标题的样子

字号和间距都收得更紧，用来切分小节。

## 最后

语法不用记，写多了自然就顺手。真正重要的是内容，不是标记。
