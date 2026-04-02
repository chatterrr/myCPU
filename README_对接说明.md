# myCPU（LoongArch 版）成员 B 第二阶段对接说明

本文档说明当前成员 B 侧工程的可对接状态、构建方法、测试方式、运行方式，以及下一阶段与成员 A 的继续协作方向。

---

## 一、当前工程状态

当前版本已经完成并验证了以下内容：

### 1. 运行支撑层
- `Memory`
  - 小端读写正确
  - `read8/read16/read32`
  - `write8/write16/write32`
  - 未对齐访问检查
  - 越界访问检查
- `Loader`
  - 支持 `load_program_words`
  - 支持 `load_program_bin`
  - 空程序/空二进制检查
  - 非法加载地址/加载越界检查
- `UART`
  - 支持内存映射输出
  - `UART_ADDR` 写入可输出字符
- `main`
  - 支持 `--bin`
  - 支持 `--use-smoke`
  - 支持 `--base`
  - 支持 `--entry`
  - 支持 `--max-steps`
  - 支持 `--dump-regs`

### 2. CPU 联调状态
当前工程已经和成员 A 的 CPU 核心目录完成联调，并通过自动化测试验证以下指令路径：

- `addi.w`
- `add.w`
- `sub.w`
- `and`
- `or`
- `xor`
- `ld.w`
- `st.w`
- `beq`
- `bne`
- `b`

### 3. 当前已验证的关键行为
- `CPU::reset()` 统一初始化：
  - `pc`
  - `running`
  - `last_inst`
  - `exit_code`
  - `sp = gpr[3] = STACK_TOP`
- `gpr[0]` 始终保持为 0
- `branch` 当前偏移实现已通过现有测试程序验证
- `tests/test_programs.h` 当前编码方式已确认可用

---

## 二、当前测试体系

当前测试分为两层：

### 1. `member_b_tests`
用于验证支撑层：
- 内存小端序
- 未对齐访问异常
- 越界访问异常
- `load_program_words`
- `load_program_bin`
- 空程序/空二进制/加载越界
- UART 映射输出

### 2. `cpu_integration_tests`
用于验证 CPU + Memory + Loader 的联调：
- 算术程序
- 逻辑程序
- 访存程序
- 分支程序
- smoke program
- `r0` 写保护程序
- 未对齐访存异常程序
- 越界访存异常程序
- 非法指令程序

---

## 三、目录说明

```text
myCPU_compatible/
├── CMakeLists.txt
├── main.cpp
├── config/
│   └── constants.h
├── cpu/
│   ├── CPU.h / CPU.cpp
│   ├── decode.h / decode.cpp
│   ├── execute.h / execute.cpp
│   └── isa.h
├── memory/
│   ├── memory.h / memory.cpp
├── loader/
│   ├── loader.h / loader.cpp
├── device/
│   ├── uart.h / uart.cpp
├── utils/
│   ├── debug.h / debug.cpp
└── tests/
    ├── test_member_b.cpp
    ├── test_cpu_integration.cpp
    └── test_programs.h
```
---

## 四、Windows构建命令
```powershell
mkdir build
cd build
cmake -A x64 ..
cmake --build . --config Release
ctest -C Release --output-on-failure
```

---

## 五、Linux/macOS构建命令
```bash
mkdir build
cd build
cmake ..
cmake --build .
ctest --output-on-failure
```
---

## 六、运行方式
1.运行内置 smoke program：
```powershell
.\Release\mycpu.exe --use-smoke --max-steps 13 --dump-regs
```
2.自定义加载地址和入口地址：
```powershell
.\Release\mycpu.exe --use-smoke --base 0x1000 --entry 0x1000 --max-steps 13 --dump-regs
```
3.运行外部二进制文件：
```powershell
.\Release\mycpu.exe --bin program.bin --base 0x1000 --entry 0x1000 --max-steps 100 --dump-regs
```
4.查看帮助信息：
```powershell
.\Release\mycpu.exe --help
```

---

## 七、当前阶段验收标准
1.自动化测试：
```powershell
ctest -C Release --output-on-failure
```
2.smoke运行：
```powershell
.\Release\mycpu.exe --use-smoke --max-steps 13 --dump-regs
```
3.关键结果验证：
- r1 = 5
- r2 = 7
- r4 = 12
- r5 = 2
- r6 = 0x80
- r7 = 12
- r10 = 12
- r11 = 14
- r12 = 14
- r20 = 0
- r21 = 0
- r22 = 0

---

## 八、成员A/B当前接口冻结
- CPUstate
- DecodeInst
- Memory读写接口
- Loader::load_program_words
- PROGRAM_BASE / STACK_TOP / MEM_SIZE / UART_ADDR 
- decode.cpp当前字段位规则
- 现有test_programs.h中的指令编码方式
- 当前分支偏移实现

---

## 九、下一阶段协作方向
成员A：
补充lu12i.w、slt

成员B：
1. 为lu12i.w准备新的测试程序
2. 为UART端到端程序准备测试框架
3. 增强README / 运行示例 / 演示流程
4. 保持自动化回归测试可用


