// 内置现代版快速指南 (Markdown 格式)
export const MODERN_GUIDE_MD = `- BooguNote Next (现代跨平台重构版) <!-- boo:{"bold":true,"branch":true,"color":"#ffffff","bg":"#1e40af"} -->
  - 欢迎使用全新重构的 BooguNote！ <!-- boo:{"icon":"star","bold":true,"branch":true} -->
    - 本项目以标准 Markdown (.md) 为核心存储格式，同时 100% 兼容导入与导出原版 .boo (XML) 文档。
    - 保留了原版最精髓的“三种文字块状态”、“三种宽度切换”、“树枝连接线”与“全键盘极速操作流”。
    - 新增了原版不具备的：无限层级撤销/重做 (Ctrl+Z / Ctrl+Y)、跨平台支持、多标签页与多主题切换。
  - 核心概念：三态与三宽 <!-- boo:{"icon":"idea","bold":true,"branch":true} -->
    - 1. 三种文字块选择状态 <!-- boo:{"bold":true,"branch":true} -->
      - 焦点态 (Focused)：实线高亮外框，可直接输入多行文字。
      - 被选择 (Selected)：虚线边框与高亮底色（支持 Ctrl+单击 多选、Shift+单击 范围选择、Alt+单击 选中整棵子树）。
      - 未选择 (Unselected)：无边框干扰，保持大纲视图纯粹干净。
    - 2. 三种文字块宽度模式（按 Ctrl+U 或右键前方块切换） <!-- boo:{"bold":true,"branch":true} -->
      - 窄块 (Narrow)：当前默认紧凑卡片宽度，适合树状多层级并排浏览。
      - 宽块 (Wide)：宽幅段落模式（此块即为宽块示例，适合长段文字记录与代码摘录）。 <!-- boo:{"width":"wide","bg":"#eff6ff","color":"#1e3a8a"} -->
      - 单行收缩 (Shrink)：超长文字自动浓缩为单行省略号显示，适合快速折叠长篇内容。 <!-- boo:{"width":"shrink"} -->
  - 经典全键盘快捷键一览 <!-- boo:{"icon":"flag","bold":true,"branch":true} -->
    - 新建与编辑文字块 <!-- boo:{"bold":true,"branch":true} -->
      - Ctrl + Enter：在下方新建【同级】文字块 <!-- boo:{"icon":"tick"} -->
      - Alt + Enter：在上方新建【同级】文字块 <!-- boo:{"icon":"tick"} -->
      - Shift + Enter：新建【子级】文字块 <!-- boo:{"icon":"tick"} -->
      - Ctrl + \\ ：从当前光标位置将文字块一分为二（切割文字块） <!-- boo:{"icon":"star"} -->
      - Ctrl + Delete：删除当前焦点或选中的文字块 <!-- boo:{"icon":"cross"} -->
    - 移动与层级调整 <!-- boo:{"bold":true,"branch":true} -->
      - Ctrl + Up / Down：上下移动文字块（连同子分支）
      - Ctrl + Left / Right（或 Shift+Tab / Tab）：向左升级 / 向右降级文字块
    - 样式与视觉开关 <!-- boo:{"bold":true,"branch":true} -->
      - Ctrl + U：循环切换块宽度（窄 -> 宽 -> 单行收缩）
      - Ctrl + B：切换文字块粗体
      - Ctrl + = / Ctrl + -：循环切换 7 种经典图标
      - Alt + B / Shift + Alt + B：开启 / 关闭当前节点的父子“树枝线”
      - Alt + T / Alt + G：设置文字颜色 / 背景颜色
`;

// 原版 BooguNote 0.3.3.7 内置《教程.boo》完整 XML 内容（用于直接体验 .boo 原生解析效果）
export const LEGACY_TUTORIAL_BOO_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>
<root version="7" DefaultSaveDir="" DefaultSaveExtension="png">
	<item content=" BooguNote 0.3.3.7 更新：" icon="none" branch="open" block="narrow" level="0" IsShown="true" IsBold="true" ShowBranch="false" TextColor="ffffff00" BkgrdColor="0000ff00" ModifyTime="2011-03-29 14:30:59" IsFile="false">
		<item content="1. Win+V 可以一键拷贝文件快捷方式" icon="none" branch="none" block="narrow" level="1" IsShown="true" IsBold="true" ShowBranch="false" TextColor="00800000" BkgrdColor="ffffff00" ModifyTime="2011-03-29 14:31:26" IsFile="false"/>
		<item content="2. Win+V 从网页上一键拷贝时不再单独生成链接文字块。URL链接直接放在内容后面" icon="none" branch="none" block="narrow" level="1" IsShown="true" IsBold="true" ShowBranch="false" TextColor="00800000" BkgrdColor="ffffff00" ModifyTime="2011-03-29 14:32:17" IsFile="false"/>
		<item content="3. 在BooguNote.exe同目录下有bn_icons.bmp文件。用户可以替换为自己的图标文件。" icon="none" branch="none" block="narrow" level="1" IsShown="true" IsBold="true" ShowBranch="false" TextColor="00800000" BkgrdColor="ffffff00" ModifyTime="2011-03-29 14:33:02" IsFile="false"/>
	</item>
	<item content=" 使用方法：" icon="none" branch="open" block="narrow" level="0" IsShown="true" IsBold="true" ShowBranch="true" TextColor="ffffff00" BkgrdColor="0000ff00" IsFile="false">
		<item content="预备知识" icon="star" branch="open" block="narrow" level="1" IsShown="true" IsBold="true" ShowBranch="false" TextColor="00000000" BkgrdColor="ffffff00" IsFile="false">
			<item content="1.BooguNote.exe不是安装程序。直接点击运行，按下Ctrl+N，然后随便写点啥。" icon="none" branch="none" block="narrow" level="2" IsShown="true" IsBold="false" ShowBranch="false" TextColor="00000000" BkgrdColor="ffffff00" IsFile="false"/>
			<item content="2.你可能第一眼看到BooguNote时感觉平淡无奇。这就是BooguNote的特点：低调。但当你需要的时候他会给你强有力的支持。" icon="none" branch="none" block="narrow" level="2" IsShown="true" IsBold="false" ShowBranch="false" TextColor="00000000" BkgrdColor="ffffff00" IsFile="false"/>
			<item content="3.文字块有三种选择状态：焦点，被选择，未选择。&#xA;焦点态时文字块周围有框。&#xA;被选择时文字块有虚线边框有背景色。&#xA;未选择时文字块无框无背景色。" icon="none" branch="none" block="narrow" level="2" IsShown="true" IsBold="false" ShowBranch="false" TextColor="00000000" BkgrdColor="ffffff00" IsFile="false"/>
			<item content="4.文字框有三种宽度：窄，宽，收缩。收缩的意思就是收缩成只有一行。&#xA;这三种状态的宽度可以在“设置”-&gt;“文字块”页面上进行设置" icon="none" branch="none" block="narrow" level="2" IsShown="true" IsBold="false" ShowBranch="false" TextColor="00000000" BkgrdColor="ffffff00" IsFile="false"/>
			<item content="5.BooguNote可以选择性的显示父节点到子节点的连线。我叫他“树枝线”" icon="none" branch="none" block="narrow" level="2" IsShown="true" IsBold="false" ShowBranch="false" TextColor="00000000" BkgrdColor="ffffff00" IsFile="false"/>
		</item>
		<item content="基本操作" icon="star" branch="open" block="narrow" level="1" IsShown="true" IsBold="true" ShowBranch="false" TextColor="00000000" BkgrdColor="ffffff00" IsFile="false">
			<item content="1. 新建文字块" icon="none" branch="open" block="narrow" level="2" IsShown="true" IsBold="false" ShowBranch="true" TextColor="00000000" BkgrdColor="ffffff00" IsFile="false">
				<item content="Ctrl+Enter	新建同级下一个文字块" icon="none" branch="none" block="wide" level="3" IsShown="true" IsBold="false" ShowBranch="false" TextColor="00000000" BkgrdColor="ffffff00" IsFile="false"/>
				<item content="Alt+Enter	新建同级上一个文字块" icon="none" branch="none" block="wide" level="3" IsShown="true" IsBold="false" ShowBranch="false" TextColor="00000000" BkgrdColor="ffffff00" IsFile="false"/>
				<item content="Shift+Enter	新建子文字块" icon="none" branch="none" block="narrow" level="3" IsShown="true" IsBold="false" ShowBranch="false" TextColor="00000000" BkgrdColor="ffffff00" IsFile="false"/>
			</item>
			<item content="2. Delete Block	Ctrl+Del 删除焦点所在文字块或所有被选择文字块。" icon="none" branch="none" block="narrow" level="2" IsShown="true" IsBold="false" ShowBranch="false" TextColor="00000000" BkgrdColor="ffffff00" IsFile="false"/>
			<item content="3. 选择文字块" icon="none" branch="open" block="narrow" level="2" IsShown="true" IsBold="false" ShowBranch="true" TextColor="00000000" BkgrdColor="ffffff00" IsFile="false">
				<item content="Ctrl+Left Click	选择一个文字块" icon="none" branch="none" block="narrow" level="3" IsShown="true" IsBold="false" ShowBranch="false" TextColor="00000000" BkgrdColor="ffffff00" IsFile="false"/>
				<item content="Shift+Left Click	批量选择文字块" icon="none" branch="none" block="narrow" level="3" IsShown="true" IsBold="false" ShowBranch="false" TextColor="00000000" BkgrdColor="ffffff00" IsFile="false"/>
				<item content="Alt+Left Click	选择该文字块以及子文字块" icon="none" branch="none" block="narrow" level="3" IsShown="true" IsBold="false" ShowBranch="false" TextColor="00000000" BkgrdColor="ffffff00" IsFile="false"/>
			</item>
			<item content="4. 移动文字块" icon="none" branch="open" block="narrow" level="2" IsShown="true" IsBold="false" ShowBranch="true" TextColor="00000000" BkgrdColor="ffffff00" IsFile="false">
				<item content="Ctrl+Up Arrow	向上移动焦点所在文字块或者被选择文字块" icon="none" branch="none" block="narrow" level="3" IsShown="true" IsBold="false" ShowBranch="false" TextColor="00000000" BkgrdColor="ffffff00" IsFile="false"/>
				<item content="Ctrl+Down Arrow	向下移动焦点所在文字块或者被选择文字块" icon="none" branch="none" block="narrow" level="3" IsShown="true" IsBold="false" ShowBranch="false" TextColor="00000000" BkgrdColor="ffffff00" IsFile="false"/>
				<item content="Ctrl+Left Arrow	向左升级焦点所在文字块" icon="none" branch="none" block="narrow" level="3" IsShown="true" IsBold="false" ShowBranch="false" TextColor="00000000" BkgrdColor="ffffff00" IsFile="false"/>
				<item content="Ctrl+Right Arrow	向右降级焦点所在文字块" icon="none" branch="none" block="narrow" level="3" IsShown="true" IsBold="false" ShowBranch="false" TextColor="00000000" BkgrdColor="ffffff00" IsFile="false"/>
			</item>
		</item>
		<item content="高级使用" icon="star" branch="open" block="narrow" level="1" IsShown="true" IsBold="true" ShowBranch="false" TextColor="00000000" BkgrdColor="ffffff00" IsFile="false">
			<item content="1. 设置图标：右键单击选择图标，或使用 Ctrl+&quot;+&quot; / Ctrl+&quot;-&quot;" icon="none" branch="open" block="narrow" level="2" IsShown="true" IsBold="false" ShowBranch="true" TextColor="00000000" BkgrdColor="ffffff00" IsFile="false">
				<item content="旗帜标记 (flag)" icon="flag" branch="none" block="narrow" level="3" IsShown="true" IsBold="false" ShowBranch="false" TextColor="00000000" BkgrdColor="ffffff00" IsFile="false"/>
				<item content="完成标记 (tick)" icon="tick" branch="none" block="narrow" level="3" IsShown="true" IsBold="false" ShowBranch="false" TextColor="00000000" BkgrdColor="ffffff00" IsFile="false"/>
				<item content="错误/取消标记 (cross)" icon="cross" branch="none" block="narrow" level="3" IsShown="true" IsBold="false" ShowBranch="false" TextColor="00000000" BkgrdColor="ffffff00" IsFile="false"/>
				<item content="重点星标 (star)" icon="star" branch="none" block="narrow" level="3" IsShown="true" IsBold="false" ShowBranch="false" TextColor="00000000" BkgrdColor="ffffff00" IsFile="false"/>
				<item content="疑问标记 (question)" icon="question" branch="none" block="narrow" level="3" IsShown="true" IsBold="false" ShowBranch="false" TextColor="00000000" BkgrdColor="ffffff00" IsFile="false"/>
				<item content="警告标记 (warning)" icon="warning" branch="none" block="narrow" level="3" IsShown="true" IsBold="false" ShowBranch="false" TextColor="00000000" BkgrdColor="ffffff00" IsFile="false"/>
				<item content="灵感标记 (idea)" icon="idea" branch="none" block="narrow" level="3" IsShown="true" IsBold="false" ShowBranch="false" TextColor="00000000" BkgrdColor="ffffff00" IsFile="false"/>
			</item>
			<item content="2. 切换文字块的三种宽度：Ctrl+U 或右键单击文字块前面的小方块" icon="none" branch="none" block="narrow" level="2" IsShown="true" IsBold="false" ShowBranch="true" TextColor="00000000" BkgrdColor="ffffff00" IsFile="false"/>
			<item content="3. 设置文字颜色 Alt+T，设置背景颜色 Alt+G" icon="none" branch="none" block="narrow" level="2" IsShown="true" IsBold="false" ShowBranch="false" TextColor="00000000" BkgrdColor="ffffff00" IsFile="false"/>
			<item content="4. 显示树枝线：Alt+B 显示从父节点到子节点的连接线，Shift+Alt+B 隐藏连线" icon="none" branch="none" block="narrow" level="2" IsShown="true" IsBold="false" ShowBranch="false" TextColor="00000000" BkgrdColor="ffffff00" IsFile="false"/>
			<item content="5. Ctrl+B 设置整个文字框的文字是粗体，Ctrl+&quot;\\&quot; 从光标处切割文字块" icon="none" branch="none" block="narrow" level="2" IsShown="true" IsBold="false" ShowBranch="false" TextColor="00000000" BkgrdColor="ffffff00" IsFile="false"/>
		</item>
	</item>
</root>`;

