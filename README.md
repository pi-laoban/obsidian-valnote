# Valnote

在 Obsidian 的 `valnote` 代码块里写表达式。结果紧挨在表达式后面，只显示在界面上，不写进笔记。

## 用法

````markdown
```valnote
1 + 1
120321 mod 2
prev + 1
```
````

打字时就能在表达式旁边看到结果。点击结果块会复制这个数值。

- 每个代码块单独计算。`prev` 是上一行成功的结果。
- `a = 2` 这类赋值只在当前块里有效。
- 空行、`#` 注释和写错的行不显示结果，也不改变 `prev`。
- 围栏要写完整。没有结束围栏时，后面的正文不会被当成算式。

表达式语法使用 [math.js](https://mathjs.org/docs/expressions/syntax.html)。

## 开发

需要 Node.js 18 或更高版本，包管理器是 pnpm。

```bash
pnpm install
pnpm dev
```

`pnpm dev` 会持续把 `src/` 编译到 `main.js`。改完后重新加载 Obsidian，并在 **Settings → Community plugins** 中启用 **Valnote**。

```bash
pnpm build
pnpm lint
```

## 发布

1. 在 `manifest.json` 里更新 `minAppVersion`（如果这次用了更新的 API）。
2. 运行 `pnpm version patch`、`pnpm version minor` 或 `pnpm version major`。版本号不要加 `v` 前缀。
3. 推送对应 tag。发布工作流会构建 `main.js`，并附上 `manifest.json` 和 `styles.css` 创建草稿 release。
