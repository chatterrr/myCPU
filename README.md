# myCPU LoongArch 教学模拟器

本项目是一个面向课程设计与教学演示的 LoongArch ISA 模拟器。仓库同时包含两部分：

- C++ 模拟器：负责加载程序、执行 CPU、驱动内存与设备，并导出 trace。
- Web 教学前端：负责把 trace 组织成统一中文教学门户，用于展示执行过程、流水线现场、异常中断过程和设备行为。

## 项目结构

以下只列出项目本体的核心代码目录与执行过程中生成的主要目录，不包含本地说明、调试辅助或协作指导文件。

### 源码目录

```text
CMakeLists.txt  CMake 构建入口
config/    运行配置与常量
cpu/       CPU、译码、执行、流水线相关实现
device/    UART、Timer 等设备模型
loader/    二进制加载逻辑
memory/    内存模型
tests/     自动化测试与内置样例程序
utils/     调试与公共工具
web/       React + TypeScript Web 教学前端
main.cpp   命令行入口
```

### 生成目录

```text
build/             CMake 构建产物
web/node_modules/  Web 依赖安装目录
web/dist/          Web 生产构建产物
```

其中，`build/`、`web/node_modules/` 和 `web/dist/` 都属于执行过程中的生成内容，不是核心源码的一部分。

## 环境要求

- Windows
- PowerShell
- Visual Studio 18 2026
- CMake 3.16 或更高版本
- Node.js 18 或更高版本

## C++ 构建与测试

在仓库根目录执行：

```powershell
cmake -S . -B .\build -G "Visual Studio 18 2026" -A x64
cmake --build .\build --config Release
ctest -C Release --output-on-failure --test-dir .\build
```

当前自动化测试包括：

- `member_b_tests`
- `cpu_integration_tests`

## 命令行运行方式

可执行文件路径：

```text
.\build\Release\mycpu.exe
```

帮助命令：

```powershell
.\build\Release\mycpu.exe --help
```

命令行支持以下两类输入：

- 外部二进制：`--bin <path>`
- 内置样例：`--use-program <name>`

常用选项如下：

- `--pipeline`：启用教学用五级流水线模式
- `--base <addr>`：设置加载地址
- `--entry <addr>`：设置入口地址
- `--max-steps <N>`：设置最大执行步数
- `--dump-regs`：执行后打印寄存器
- `--trace <path>`：导出 JSONL trace

### 运行内置样例

```powershell
.\build\Release\mycpu.exe --use-program smoke --dump-regs
.\build\Release\mycpu.exe --use-program slt --dump-regs
.\build\Release\mycpu.exe --use-program lu12i --dump-regs
.\build\Release\mycpu.exe --use-program uart --dump-regs
```

### 运行外部二进制

```powershell
.\build\Release\mycpu.exe --bin .\program.bin --base 0x1000 --entry 0x1000 --max-steps 128 --dump-regs
```

### 导出流水线样例 trace

```powershell
.\build\Release\mycpu.exe --pipeline --use-program pipeline-raw --max-steps 64 --trace .\build\pipeline-raw.jsonl
.\build\Release\mycpu.exe --pipeline --use-program pipeline-forward --max-steps 64 --trace .\build\pipeline-forward.jsonl
.\build\Release\mycpu.exe --pipeline --use-program pipeline-loaduse --max-steps 64 --trace .\build\pipeline-loaduse.jsonl
.\build\Release\mycpu.exe --pipeline --use-program pipeline-branch --max-steps 64 --trace .\build\pipeline-branch.jsonl
```

### 当前内置样例

当前命令行帮助中列出的内置样例为：

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
invalid
break-resume
timer-interrupt
pipeline-nohaz
pipeline-raw
pipeline-forward
pipeline-loaduse
pipeline-branch
```

其中，课程阶段要求重点保持稳定可用的样例包括：

- `smoke`
- `slt`
- `lu12i`
- `uart`

## Web 前端运行方式

Web 工程位于 `web/`，使用 `React 18 + TypeScript + Vite`。

### 安装依赖

```powershell
cd .\web
npm.cmd ci
```

### 启动开发服务器

```powershell
npm.cmd run dev -- --host 127.0.0.1 --port 4174
```

开发服务器启动后，可访问以下入口：

- [http://127.0.0.1:4174/](http://127.0.0.1:4174/)
- [http://127.0.0.1:4174/hazard-puzzle](http://127.0.0.1:4174/hazard-puzzle)
- [http://127.0.0.1:4174/traffic-control](http://127.0.0.1:4174/traffic-control)

### 生产构建

```powershell
npm.cmd run build
npm.cmd run preview -- --host 127.0.0.1 --port 4175
```

## Trace 到 Web 的使用流程

Web 端默认从 `web/public/traces/` 读取样例 trace。推荐流程如下：

### 1. 在 C++ 侧生成 trace

```powershell
.\build\Release\mycpu.exe --pipeline --use-program pipeline-raw --max-steps 64 --trace .\build\pipeline-raw.jsonl
.\build\Release\mycpu.exe --pipeline --use-program pipeline-forward --max-steps 64 --trace .\build\pipeline-forward.jsonl
.\build\Release\mycpu.exe --pipeline --use-program pipeline-loaduse --max-steps 64 --trace .\build\pipeline-loaduse.jsonl
.\build\Release\mycpu.exe --pipeline --use-program pipeline-branch --max-steps 64 --trace .\build\pipeline-branch.jsonl
```

### 2. 同步到 Web 公共目录

```powershell
cd .\web
npm.cmd run sync:traces
```

该脚本会把生成好的样例 trace 同步到 `web/public/traces/`。

## Web 前端的当前组织方式

`web/src/` 目前按以下方式组织：

```text
app/         应用壳层、门户配置与导航
assets/      前端静态资源
components/  复用型界面组件
features/    按教学功能划分的领域模块
routes/      路由页面
styles/      全局样式
```

其中，`features/` 下的主要模块包括：

- `lesson_hazard/`：Hazard 教学互动
- `pipeline/`：共享流水线展示组件
- `trace/`：trace schema、样例与工作台逻辑
- `traffic_game/`：方块调度互动

## 当前统一入口

Web 前端当前保留三条主路径：

- `/`：统一教学门户与工作台入口
- `/hazard-puzzle`：Hazard 教学互动
- `/traffic-control`：方块调度互动

这三条路径共享同一项目语义和导航体系，不再作为彼此割裂的独立演示页使用。

## 补充说明

- 内置样例程序定义位于 `tests/test_programs.h`
- CLI 入口定义位于 `main.cpp`
- Web 端样例同步脚本位于 `web/scripts/sync-samples.ps1`

如果命令行执行因步数上限提前结束，程序会以退出码 `2` 退出；若内置样例正常运行到模拟器 `HALT`，则可以在不显式设置 `--max-steps` 的情况下自然停止。
