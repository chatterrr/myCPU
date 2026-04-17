# myCPU LoongArch 教学流水线实验台

一个面向教学演示的 LoongArch ISA 模拟与流水线可视化项目。

当前仓库包含两部分：

- C++ 模拟器：负责装载程序、运行 CPU、导出执行 trace。
- Web 教学前端：负责把 trace 渲染成可交互的流水线教学页面与轻游戏页面。

项目目标不是做工业级 CPU 模拟器，而是做一个适合课堂、答辩、演示和自学的“看得见 hazard、看得见流水线推进”的教学台。

---

## 1. 当前包含内容

### 1.1 C++ 模拟器

- 基于 `C++17 + CMake + Visual Studio`
- 支持加载原始二进制文件
- 支持运行内置测试程序
- 支持寄存器打印
- 支持导出 JSONL trace
- 支持教学用途的最小 5 级流水线模式：`--pipeline`

当前命令行程序入口：

- `mycpu.exe`

核心目录：

- `cpu/`：CPU、译码、执行
- `memory/`：内存实现
- `loader/`：程序装载
- `device/`：UART 等设备
- `tests/`：内置程序与自动化测试

### 1.2 Web 教学前端

- 基于 `React 18 + TypeScript + Vite`
- 使用 `motion` 做关键动画
- 使用 `Pixi.js` / 现有画布组件做教学舞台表达
- 消费 C++ 侧导出的 trace JSONL

当前 Web 路由：

- `/`：首页总览
- `/hazard-puzzle`：入口 1，`Hazard 判断`
- `/traffic-control`：入口 2，`流水线方块调度`

### 1.3 当前教学玩法

#### 入口 1：Hazard 判断

- 先看主画幅中的关键流水线时刻
- 点击左侧关卡地图切换场景
- 对当前 hazard 做 A / B / C 判断
- 反馈“正确 / 错误”
- 用于讲解：
  - RAW 依赖
  - forwarding
  - stall / bubble
  - flush

#### 入口 2：流水线方块调度

- 一个 falling-block 风格的轻游戏页面
- 玩家可用键盘操作下落方块
- 页面同时显示实时流水线联动画面
- 点击方块可查看对应指令状态卡
- 寄存器读 / 目标 / 写回会发光或变色提示

支持操作：

- `← / A`：左移
- `→ / D`：右移
- `↑ / W`：旋转
- `↓ / S`：加速下落
- `Space`：硬降
- `P`：暂停 / 继续

---

## 2. 当前可运行的内置程序

命令行支持以下内置程序名：

```text
smoke
arith
logic
mem
branch
r0
slt
lu12i
uart
pipeline-nohaz
pipeline-raw
pipeline-forward
pipeline-loaduse
pipeline-branch
```

其中当前项目特别要求保持稳定可用的程序包括：

- `smoke`
- `slt`
- `lu12i`
- `uart`

用于 Web 教学的典型 trace 程序包括：

- `pipeline-raw`
- `pipeline-forward`
- `pipeline-loaduse`
- `pipeline-branch`

---

## 3. 环境要求

推荐环境：

- Windows
- PowerShell
- Visual Studio 18 2026
- CMake 3.16+
- Node.js 18+（用于 Web）

---

## 4. C++ 构建与测试

在仓库根目录执行：

```powershell
cmake -S . -B .\build -G "Visual Studio 18 2026" -A x64
cmake --build .\build --config Release
ctest -C Release --output-on-failure --test-dir .\build
```

自动化测试包括：

- `member_b_tests`
- `cpu_integration_tests`

---

## 5. 命令行运行示例

### 5.1 查看帮助

```powershell
.\build\Release\mycpu.exe --help
```

### 5.2 运行内置程序

```powershell
.\build\Release\mycpu.exe --use-program smoke --max-steps 32 --dump-regs
```

### 5.3 运行指定内置程序

```powershell
.\build\Release\mycpu.exe --use-program slt --max-steps 32 --dump-regs
.\build\Release\mycpu.exe --use-program lu12i --max-steps 32 --dump-regs
.\build\Release\mycpu.exe --use-program uart --max-steps 64 --dump-regs
```

### 5.4 运行外部二进制

```powershell
.\build\Release\mycpu.exe --bin .\program.bin --base 0x1000 --entry 0x1000 --max-steps 128 --dump-regs
```

### 5.5 运行流水线模式并导出 trace

```powershell
.\build\Release\mycpu.exe --pipeline --use-program pipeline-raw --max-steps 64 --trace .\build\pipeline-raw.jsonl
.\build\Release\mycpu.exe --pipeline --use-program pipeline-forward --max-steps 64 --trace .\build\pipeline-forward.jsonl
.\build\Release\mycpu.exe --pipeline --use-program pipeline-loaduse --max-steps 64 --trace .\build\pipeline-loaduse.jsonl
.\build\Release\mycpu.exe --pipeline --use-program pipeline-branch --max-steps 64 --trace .\build\pipeline-branch.jsonl
```

---

## 6. Web 前端启动

先安装依赖：

```powershell
cd .\web
npm.cmd ci
```

开发模式启动：

```powershell
npm.cmd run dev -- --host 127.0.0.1 --port 4174
```

然后打开：

- [http://127.0.0.1:4174/](http://127.0.0.1:4174/)
- [http://127.0.0.1:4174/hazard-puzzle](http://127.0.0.1:4174/hazard-puzzle)
- [http://127.0.0.1:4174/traffic-control](http://127.0.0.1:4174/traffic-control)

生产构建：

```powershell
npm.cmd run build
npm.cmd run preview -- --host 127.0.0.1 --port 4175
```

---

## 7. Trace 到 Web 的工作流

Web 前端默认从 `web/public/traces/` 读取样例 trace。

推荐流程：

### 7.1 在 C++ 侧生成 trace

```powershell
.\build\Release\mycpu.exe --pipeline --use-program pipeline-raw --max-steps 64 --trace .\build\pipeline-raw.jsonl
.\build\Release\mycpu.exe --pipeline --use-program pipeline-forward --max-steps 64 --trace .\build\pipeline-forward.jsonl
.\build\Release\mycpu.exe --pipeline --use-program pipeline-loaduse --max-steps 64 --trace .\build\pipeline-loaduse.jsonl
.\build\Release\mycpu.exe --pipeline --use-program pipeline-branch --max-steps 64 --trace .\build\pipeline-branch.jsonl
```

### 7.2 同步到 Web 公共目录

```powershell
cd .\web
npm.cmd run sync:traces
```

该脚本会把 `build/` 下的样例 trace 复制到：

- `web/public/traces/`

---

## 8. 仓库结构

```text
myCPU_compatible/
├── CMakeLists.txt
├── main.cpp
├── README.md
├── README_对接说明.md
├── AGENTS.md
├── config/
├── cpu/
├── device/
├── docs/
│   ├── Prompt.md
│   └── Plan.md
├── loader/
├── memory/
├── tests/
├── tools/
├── utils/
└── web/
    ├── package.json
    ├── public/
    ├── scripts/
    └── src/
```

---

## 9. 当前验证范围

当前仓库已覆盖并持续回归验证以下内容：

- 内存读写与越界/未对齐检查
- Loader 装载
- UART 内存映射输出
- 基本整数运算与逻辑运算
- 访存
- 分支
- `slt`
- `lu12i`
- `uart`
- 教学流水线样例：
  - no hazard
  - RAW
  - forwarding
  - load-use
  - branch flush

---

## 10. 适合怎么使用

这个项目适合以下场景：

- 课程演示 LoongArch 基础指令执行
- 讲解 5 级流水线推进
- 讲解 hazard 类型与处理策略
- 用 Web 页面做课堂互动或展示
- 把命令行 trace 导入前端做可视化教学

---

## 11. 补充说明

- 当前仓库以教学表达为优先，不追求完整 CPU 微架构覆盖。
- 根目录中的 `README_对接说明.md` 保留了较早阶段的对接说明，可作为历史参考。
- 当前推荐阅读顺序：
  1. 本 README
  2. `main.cpp`
  3. `tests/test_programs.h`
  4. `web/src/routes/`

