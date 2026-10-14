"""从论文原页提取效果图，并生成博客使用的可编辑 SVG。

运行：在含 pypdfium2 和 Pillow 的 Python 环境中执行本文件。
裁剪坐标基于 953×1348 的阅览页；实际以两倍分辨率渲染，保留原图标签。
"""

from pathlib import Path
from html import escape
import json
import xml.etree.ElementTree as ET

import pypdfium2 as pdfium

ROOT = Path(__file__).resolve().parents[1]
PDF = ROOT / "语义-几何协同引导的解耦式语言驱动六自由度抓取方法_李西兴.pdf"
OUT = ROOT / "public/images/semantic-grasp"
OUT.mkdir(parents=True, exist_ok=True)

# 提取原页的图组，保留原文指令、子图和图注；不重绘或修饰实验结果。
FIGURES = [
    (7, 5, "robot-setup", (190, 138, 765, 360)),
    (8, 6, "grounding-results", (151, 650, 812, 1074)),
    (10, 8, "cluttered-grasps", (80, 135, 876, 411)),
    (10, 9, "challenging-grasps", (80, 976, 877, 1271)),
    (11, 10, "method-comparison", (95, 807, 868, 1271)),
    (12, 11, "failure-cases", (502, 136, 876, 478)),
]


class SVG:
    """简单的矢量布局器：图形和文字均为原生 SVG，便于继续编辑。"""

    def __init__(self, width, height, title, description):
        self.parts = [f'''<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" role="img" aria-labelledby="title desc">
<title id="title">{escape(title)}</title><desc id="desc">{escape(description)}</desc>
<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b"/></marker></defs>
<style>text{{font-family:Inter,Arial,"Microsoft YaHei","Noto Sans CJK SC",sans-serif;fill:#172b42}}.muted{{fill:#596b80}}.mono{{font-family:"Cascadia Code",Consolas,monospace}}</style>
<rect width="{width}" height="{height}" fill="white"/>''']

    def text(self, x, y, label, size=22, weight=400, anchor="start", color=None):
        fill = f' style="fill:{color}"' if color else ""
        self.parts.append(f'<text x="{x}" y="{y}" font-size="{size}" font-weight="{weight}" text-anchor="{anchor}"{fill}>{escape(label)}</text>')

    def rect(self, x, y, w, h, fill="#fff", stroke="#d4dee8", radius=12, dash=False):
        dashed = ' stroke-dasharray="8 6"' if dash else ""
        self.parts.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{radius}" fill="{fill}" stroke="{stroke}" stroke-width="1.6"{dashed}/>')

    def line(self, points, color="#64748b", arrow=True, dash=False):
        end = ' marker-end="url(#arrow)"' if arrow else ""
        dashed = ' stroke-dasharray="8 6"' if dash else ""
        self.parts.append(f'<polyline points="{points}" fill="none" stroke="{color}" stroke-width="2.4" stroke-linejoin="round"{end}{dashed}/>')

    def box(self, x, y, w, h, title, lines=(), fill="#fff", stroke="#d4dee8", size=22):
        self.rect(x, y, w, h, fill, stroke)
        self.text(x+w/2, y+34, title, size, 650, "middle")
        for i, label in enumerate(lines):
            self.text(x+w/2, y+66+29*i, label, 19, anchor="middle", color="#596b80")

    def save(self, name):
        source = "\n".join(self.parts) + "\n</svg>\n"
        ET.fromstring(source)  # 写出前验证 XML，避免资源在浏览器中静默显示失败。
        (OUT / name).write_text(source, encoding="utf-8")


def framework():
    s = SVG(1720, 1070, "语义—几何协同引导的解耦式六自由度抓取框架", "上层为 CLIP 早期对齐与六层双向交互的视觉定位；像素掩码作为显式接口，与深度和相机内参构建局部点云，交由预训练 FGC-GraspNet 推理和筛选抓取。")
    s.text(40, 48, "Semantic–Geometric Decoupling for Language-Driven 6-DoF Grasping", 30, 700)
    s.text(40, 83, "语言指代定位 → 像素级空间接口 → 局部几何抓取", 22, color="#596b80")
    s.rect(32, 116, 1656, 514, "#f5f8fd", "#c8d9ed", 18)
    s.text(56, 158, "A  跨模态视觉定位 / CROSS-MODAL VISUAL GROUNDING", 24, 700, color="#245cb0")
    # 两路特征在编码器中交互；查询短语通过独立路径送入解码器。
    for points in ["266,286 302,286", "447,332 447,377", "592,450 620,450 620,292 648,292", "266,509 302,509", "592,547 620,547 620,470 648,470", "938,383 970,383 970,365 1000,365", "1226,365 1243,365 1243,304 1260,304", "1243,365 1243,471 1260,471", "1444,304 1482,304", "1444,471 1482,471"]:
        s.line(points)
    s.line("447,577 447,604 1113,604 1113,455", color="#a384bf")
    s.text(853, 592, "查询编码器 → 短语嵌入", 19, anchor="middle", color="#79559b")
    s.box(56, 226, 210, 120, "RGB 图像 I", ["二维视觉输入", "与深度图对齐"], "#fff", "#b8c8da")
    s.box(56, 452, 210, 120, "英文指令 L", ["类别 · 属性", "空间关系"], "#f5f0fa", "#d2bfdf")
    s.box(302, 226, 290, 106, "ResNet-50", ["视觉主干 · 2048 维"], "#eaf1fd", "#aac2e8")
    s.box(302, 377, 290, 119, "CLIP 视觉适配器", ["卷积 + 组归一化：→ 768", "8 头自注意力"], "#eaf1fd", "#aac2e8")
    s.box(302, 509, 290, 68, "CLIP 文本编码器", [], "#f5f0fa", "#d2bfdf")
    s.rect(648, 218, 290, 320, "#fff", "#aac2e8")
    s.text(793, 252, "双向编码器 × 6", 23, 650, "middle")
    s.box(671, 274, 244, 68, "视觉流 v", [], "#eaf1fd", "#aac2e8")
    s.line("737,348 737,412", color="#245cb0")
    s.line("850,412 850,348", color="#79559b")
    s.text(793, 380, "共享 S / Sᵀ", 19, 600, "middle")
    s.box(671, 418, 244, 68, "语言流 l", [], "#f5f0fa", "#d2bfdf")
    s.text(793, 519, "独立 FFN · 残差 · 层归一化", 17, anchor="middle", color="#596b80")
    s.box(1000, 283, 226, 172, "拼接 + 解码器", ["精炼的视觉 / 语言特征", "+ 查询短语嵌入", "共享多任务特征"], "#fff", "#b8c8da", 21)
    s.box(1260, 270, 184, 68, "检测头", [], "#fff", "#b8c8da")
    s.box(1260, 437, 184, 68, "掩码头", [], "#e6f5f1", "#91cdbf")
    s.box(1482, 252, 176, 105, "边界框 B", ["粗粒度空间先验"], "#fff", "#b8c8da", 21)
    s.box(1482, 419, 176, 105, "像素掩码 M", ["目标前景 / 背景"], "#e6f5f1", "#91cdbf", 21)
    s.text(1539, 563, "核心级联接口", 19, 600, "middle", color="#218674")
    s.rect(32, 700, 1656, 281, "#f6faf9", "#b6d9ce", 18)
    s.text(56, 740, "B  语义引导局部几何", 24, 700, color="#218674")
    s.text(593, 740, "SEMANTICS-GUIDED LOCAL GEOMETRY", 22, 700, color="#218674")
    s.line("1570,525 1570,662 421,662 421,779", color="#218674")
    s.rect(580, 641, 640, 44, "white", "#91cdbf", 8)
    s.text(900, 671, "显式空间接口：M(u,v) → P_obj；不向三维网络注入语言特征", 18, 600, "middle", color="#218674")
    for points in ["250,834 302,834", "540,834 593,834", "851,834 918,834", "1192,834 1240,834", "1430,834 1482,834"]:
        s.line(points)
    s.box(56, 779, 194, 127, "深度图 D + K", ["RGB-D 相机", "相机内参"], "#fff", "#b8c8da", 21)
    s.box(302, 779, 238, 127, "掩码裁剪 + 反投影", ["D_roi = D ⊙ M", "保留有效目标深度"], "#e6f5f1", "#91cdbf", 21)
    s.box(593, 779, 258, 127, "局部点云 P_obj", ["语义级背景抑制", "采样至 12,000 点"], "#e6f5f1", "#91cdbf")
    s.box(918, 779, 274, 127, "FGC-GraspNet", ["复用预训练权重", "物理约束下的候选位姿"], "#fff4e5", "#dfbe83")
    s.box(1240, 779, 190, 127, "位姿筛选", ["评分排序", "非极大值抑制"], "#fff4e5", "#dfbe83")
    s.box(1482, 779, 176, 127, "最优 6-DoF", ["旋转 R · 平移 t", "夹爪宽度 w"], "#fff4e5", "#dfbe83", 21)
    s.text(56, 948, "几何网络专注于目标表面；定位误差仍可能沿掩码接口向后传播。", 20, color="#596b80")
    s.text(40, 1026, "蓝：视觉特征     紫：语言特征     绿：语义空间接口     橙：几何推理与抓取输出", 20, color="#596b80")
    s.text(1680, 1053, "依据论文图 1–4 与 §1 重绘 · 示意图，不代表新增实验", 16, anchor="end", color="#596b80")
    s.save("framework.svg")


def attention():
    s = SVG(1520, 720, "共享相似度矩阵的双向交叉注意力", "视觉和语言分别投影，一次计算 S=QK 转置除以根号 d。两个方向分别添加填充掩码并归一化，聚合另一模态的值；各自通过残差、层缩放、层归一化和独立 FFN。")
    s.text(36, 49, "Shared Similarity, Bidirectional Refinement", 31, 700)
    s.text(36, 84, "一次跨模态相似度计算，两路按各自序列归一化；每层维持独立的视觉与语言流。", 21, color="#596b80")
    s.rect(32, 118, 1456, 510, "#f8fafc", "#d4dee8", 18)
    for p in ["224,264 279,264", "224,469 279,469", "539,249 580,249 580,356 620,356", "539,454 580,454 580,394 620,394", "880,355 920,355 920,226 964,226", "880,395 920,395 920,478 964,478", "1195,226 1234,226", "1195,478 1234,478"]:
        s.line(p)
    s.line("539,493 558,493 558,163 1080,163 1080,185", color="#79559b")
    s.text(760, 155, "语言值 V_l → 更新视觉", 18, anchor="middle", color="#79559b")
    s.line("539,293 601,293 601,585 1080,585 1080,553", color="#245cb0")
    s.text(760, 575, "视觉值 V_v → 更新语言", 18, anchor="middle", color="#245cb0")
    s.box(56, 206, 168, 116, "视觉特征 v", ["图像块序列"], "#eaf1fd", "#aac2e8")
    s.box(56, 411, 168, 116, "语言特征 l", ["文本词元序列"], "#f5f0fa", "#d2bfdf")
    s.box(279, 190, 260, 130, "视觉投影", ["Q = v W_q^v", "V_v = v W_v^v"], "#eaf1fd", "#aac2e8")
    s.box(279, 395, 260, 130, "语言投影", ["K = l W_k^l", "V_l = l W_v^l"], "#f5f0fa", "#d2bfdf")
    s.box(620, 302, 260, 141, "共享相似度 S", ["S = QKᵀ / √d", "复用 S 与 Sᵀ"], "#e6f5f1", "#91cdbf")
    s.box(964, 185, 231, 131, "更新视觉 O_v", ["softmax(S + M_l) V_l", "语言引导视觉聚焦"], "#eaf1fd", "#aac2e8", 21)
    s.box(964, 422, 231, 131, "更新语言 O_l", ["softmax(Sᵀ + M_v) V_v", "视觉反馈语义消歧"], "#f5f0fa", "#d2bfdf", 21)
    s.box(1234, 171, 230, 164, "视觉流输出 v′", ["投影 · 层缩放 · 残差", "LayerNorm + FFN_v", "保留模态特异性"], "#fff", "#aac2e8", 21)
    s.box(1234, 408, 230, 164, "语言流输出 l′", ["投影 · 层缩放 · 残差", "LayerNorm + FFN_l", "保留模态特异性"], "#fff", "#d2bfdf", 21)
    s.text(36, 666, "M_l / M_v 是序列填充掩码，区别于分割掩码 M；两个方向的注意力权重不要求互为转置。", 21, color="#596b80")
    s.text(1480, 704, "依据论文式 (1)–(2) 与图 4 重绘 · 省略多头重塑细节", 16, anchor="end", color="#596b80")
    s.save("bidirectional-attention.svg")


def ablation_chart():
    s = SVG(1300, 630, "RoboRefIt 逐步消融的 IoU 变化", "TestA 的四组 IoU 为85.46、86.83、89.14、90.03；TestB 为61.49、65.55、67.05、68.84。柱状图使用从0到100的完整百分比轴。")
    s.text(40, 49, "RoboRefIt: Component-wise Ablation", 29, 700)
    s.text(40, 84, "同一顺序添加 CLIP 文本、视觉适配器、双向编码器；数据来自论文表 4。", 21, color="#596b80")
    left, top, bottom = 100, 135, 485
    for tick in range(0, 101, 20):
        y = bottom - tick * 3.5
        s.line(f"100,{y} 1250,{y}", "#e4eaf0", False)
        s.text(82, y+7, str(tick), 19, anchor="end", color="#596b80")
    s.text(40, 117, "IoU (%)", 19, color="#596b80")
    groups = [(85.46, 61.49), (86.83, 65.55), (89.14, 67.05), (90.03, 68.84)]
    labels = ["VL-Grasp 基准", "+ CLIP 文本", "+ 视觉适配器", "+ 双向编码器"]
    for i, (a, b) in enumerate(groups):
        center = 245 + i * 280
        for x, value, fill in [(center-71, a, "#4c78b9"), (center+5, b, "#339a83")]:
            s.rect(x, bottom-value*3.5, 66, value*3.5, fill, fill, 3)
            s.text(x+33, bottom-value*3.5-13, f"{value:.2f}", 22, 650, "middle")
        s.text(center, 526, labels[i], 22, 600, "middle")
    s.rect(410, 573, 20, 20, "#4c78b9", "#4c78b9", 3)
    s.text(442, 590, "TestA · 已知类别", 21)
    s.rect(729, 573, 20, 20, "#339a83", "#339a83", 3)
    s.text(761, 590, "TestB · 未知类别", 21)
    s.save("ablation-iou.svg")


def extract_figures():
    document = pdfium.PdfDocument(str(PDF))
    manifest = []
    for page_number, figure, name, bounds in FIGURES:
        page = document[page_number-1]
        bitmap = page.render(scale=3.2)
        image = bitmap.to_pil().convert("RGB")
        x0, y0, x1, y1 = bounds
        # 按页尺寸缩放坐标，以完整原页渲染保留矢量标签的清晰度。
        sx, sy = image.width / 953, image.height / 1348
        crop = image.crop((round(x0*sx), round(y0*sy), round(x1*sx), round(y1*sy)))
        filename = f"{name}.webp"
        crop.save(OUT / filename, "WEBP", quality=95, method=6)
        manifest.append({"file": filename, "paper_figure": figure, "pdf_page": page_number, "printed_page": page_number+97, "reference_page_size": [953, 1348], "crop_bounds": bounds, "width": crop.width, "height": crop.height})
        bitmap.close()
        page.close()
    document.close()
    (OUT / "sources.json").write_text(json.dumps({"source_pdf": PDF.name, "doi": "10.3778/j.issn.1002-8331.2601-0088", "figures": manifest, "redrawn": ["framework.svg", "bidirectional-attention.svg", "ablation-iou.svg"]}, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")


if __name__ == "__main__":
    extract_figures()
    framework()
    attention()
    ablation_chart()
    print(f"已生成 6 张论文原图、3 张 SVG 和来源清单：{OUT}")
