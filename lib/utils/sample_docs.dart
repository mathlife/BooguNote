/// 内置快速指南与示例大纲文档
class SampleDocs {
  /// 现代版快速指南 (Markdown 格式)
  static const String modernGuideMd = '''- BooguNote Native (纯原生极速版) <!-- boo:{"bold":true,"branch":true,"color":"#ffffff","bg":"#1e40af"} -->
  - 欢迎使用全新纯原生重构的 BooguNote！ <!-- boo:{"icon":"star","bold":true,"branch":true} -->
    - 本应用完全采用原生机器码编译（C++ / Flutter Skia 引擎），零 Chrome 内核，秒开秒关。
    - 100% 双向兼容读写 Markdown (.md) 与原版 BooguNote (.boo XML) 文档。
    - 保留了原版最精髓的“三态”、“三宽”、“正交树枝折线”与“全键盘极速操作流”。
  - 核心概念：三态与三宽 <!-- boo:{"icon":"idea","bold":true,"branch":true} -->
    - 1. 三种文字块选择状态 <!-- boo:{"bold":true,"branch":true} -->
      - 焦点编辑态 (Focused)：蓝色高亮外框，光标聚焦文本框，直接输入多行文字。
      - 被选择 (Selected)：选中背景底色，支持多选与批量移动/删除。
      - 未选择 (Unselected)：极简卡片，纯粹干净。
    - 2. 三种文字块宽度模式（按 Ctrl+U 或右键切换） <!-- boo:{"bold":true,"branch":true} -->
      - 窄块 (Narrow)：当前默认紧凑卡片宽度，适合树状多层级并排浏览。
      - 宽块 (Wide)：宽幅段落模式（此块即为宽块示例，适合长段文字记录）。 <!-- boo:{"width":"wide","bg":"#eff6ff","color":"#1e3a8a"} -->
      - 单行收缩 (Shrink)：超长文字自动浓缩为单行省略号显示，适合折叠长篇内容。 <!-- boo:{"width":"shrink"} -->
  - 经典全键盘快捷键一览 <!-- boo:{"icon":"flag","bold":true,"branch":true} -->
    - 新建与编辑文字块 <!-- boo:{"bold":true,"branch":true} -->
      - Ctrl + Enter：在下方新建【同级】文字块 <!-- boo:{"icon":"tick"} -->
      - Alt + Enter：在上方新建【同级】文字块 <!-- boo:{"icon":"tick"} -->
      - Shift + Enter：新建【子级】文字块 <!-- boo:{"icon":"tick"} -->
      - Ctrl + \\ ：光标处切分文字块 <!-- boo:{"icon":"star"} -->
      - Ctrl + Delete：删除当前文字块 <!-- boo:{"icon":"cross"} -->
      - Backspace：在空白文字块中按退格直接删除并回退上一块 <!-- boo:{"icon":"warning"} -->
    - 移动与层级调整 <!-- boo:{"bold":true,"branch":true} -->
      - Ctrl + Up / Down：上下移动文字块（连同整个子分支）
      - Tab / Shift + Tab (或 Ctrl+Right / Left)：向右降级 / 向左升级文字块
      - Up / Down 方向键：在文字块之间上下移动焦点
    - 样式与视觉开关 <!-- boo:{"bold":true,"branch":true} -->
      - Ctrl + U：循环切换块宽度（窄 -> 宽 -> 单行收缩）
      - Ctrl + B：切换文字块粗体
      - Ctrl + = / Ctrl + -：循环切换 7 种经典图标
''';

  /// 原版 BooguNote 教程 XML (.boo)
  static const String legacyTutorialBooXml = '''<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>
<root version="7" DefaultSaveDir="" DefaultSaveExtension="png">
	<item content="BooguNote 原生版使用指南" icon="star" branch="open" block="narrow" level="0" IsShown="true" IsBold="true" ShowBranch="true" TextColor="ffffff00" BkgrdColor="0000ff00">
		<item content="1. 新建同级文字块：按下 Ctrl+Enter 键" icon="tick" branch="none" block="narrow" level="1" IsShown="true" IsBold="true" ShowBranch="false"/>
		<item content="2. 新建子级文字块：按下 Shift+Enter 键" icon="tick" branch="none" block="narrow" level="1" IsShown="true" IsBold="true" ShowBranch="false"/>
		<item content="3. 降级与升级：按下 Tab 向右降级，Shift+Tab 向左升级" icon="idea" branch="none" block="narrow" level="1" IsShown="true" IsBold="false" ShowBranch="false"/>
		<item content="4. 移动文字块：按下 Ctrl+Up 向上移动，Ctrl+Down 向下移动" icon="none" branch="none" block="narrow" level="1" IsShown="true" IsBold="false" ShowBranch="false"/>
		<item content="5. 切换三种宽度：按下 Ctrl+U 键（窄块 / 宽块 / 单行收缩）" icon="flag" branch="none" block="narrow" level="1" IsShown="true" IsBold="false" ShowBranch="false"/>
		<item content="6. 切换图标：按下 Ctrl+= 或 Ctrl+-，或右键单击文字块" icon="question" branch="none" block="narrow" level="1" IsShown="true" IsBold="false" ShowBranch="false"/>
	</item>
</root>''';
}

