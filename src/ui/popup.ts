// ============================================================
// ui/popup.ts — 拼音声调提示弹窗
// ============================================================
import { byId, h } from "../utils/dom.ts";

/** 构建拼音声调速查与页内导航说明内容。 */
function buildPinyinTip(): HTMLElement {
  const tones = [
    "ā á ǎ à",
    "ō ó ǒ ò",
    "ē é ě è",
    "ī í ǐ ì",
    "ū ú ǔ ù",
    "ü ǖ ǘ ǚ ǜ",
    "ê",
    "ẑ ĉ ŝ",
    "ŋ",
  ];
  const navKeys: Array<[string, string]> = [
    ["← / →", "上 / 下一页"],
    ["Home / End", "首 / 末页"],
    ["PageUp / PageDown", "向前 / 向后跳 10 页"],
    ["+ / - / 0", "放大 / 缩小 / 重置"],
    ["R", "旋转"],
    ["F", "全屏"],
    ["D", "双页模式"],
    ["Esc", "关闭浮层"],
  ];
  return h("div", {}, [
    h("h4", {}, ["声调速查"]),
    h("ul", {}, tones.map(t => h("li", {}, [t]))),
    h("h4", {}, ["页内导航"]),
    h("ul", {}, navKeys.map(([k, v]) => h("li", {}, [`${k} — ${v}`]))),
  ]);
}

/** 初始化拼音提示弹窗：填充内容并绑定开关。 */
export function initPinyinPopup(): void {
  const content = byId("pinyinTipContent");
  if (content) {
    content.innerHTML = "";
    content.appendChild(buildPinyinTip());
  }

  const popup = byId("pinyinPopup");
  byId("tipToggle")?.addEventListener("click", () => popup?.classList.add("active"));
  byId("closePopup")?.addEventListener("click", () => popup?.classList.remove("active"));
  popup?.addEventListener("click", (e: MouseEvent) => {
    // 点击遮罩（非内容区）关闭
    if (e.target === popup) popup.classList.remove("active");
  });
  document.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "Escape") popup?.classList.remove("active");
  });
}
