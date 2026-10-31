/**
 * 站点全局配置
 * ───────────────────────────────────────────────
 * 换博客信息只需要改这一个文件：
 * 站名、署名、简介、访问地址、社交链接。
 */
export const site = {
  // 站点标题，会显示在浏览器标签和页头
  title: 'yztcfzg',
  // 作者署名
  author: 'yztcfzg',
  // 一句话简介，显示在首页顶部与页脚
  description: '一个写字的地方。',
  // 部署后的完整访问地址（含仓库子路径），用于 RSS / sitemap 的绝对链接
  // 站点首页：https://yztcfzg.github.io/my_blog/
  url: 'https://yztcfzg.github.io/my_blog',
  // 仓库名，构建时用它推断资源前缀（GitHub Actions 环境下会自动读取真实仓库名）
  repo: 'my_blog',
  // 社交链接，留空则不显示
  links: {
    github: 'https://github.com/yztcfzg',
    email: '',
    rss: true,
  },
  // 首页每页显示的文章数，0 表示全部显示
  pageSize: 0,
}
