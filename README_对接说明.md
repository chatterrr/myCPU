# 成员 B 可对接版本说明

这个压缩包已经把成员 B 的运行支撑层改成了和成员 A 当前代码更容易对接的版本，主要调整如下：

1. 去掉了之前 `mycpu` 命名空间，改为和接口文档一致的全局类/命名空间风格。
2. 删除了成员 B 之前的占位 `cpu` 头文件，改为直接放入成员 A 的 `CPU/decode/execute/isa` 文件。
3. 已把成员 A 的几个明显编译问题顺手补上：
   - `isa.h` 增加了 `#pragma once`
   - `decode.h` 增加了 `decode(uint32_t raw)` 声明
   - `decode.cpp` 的 `get_rd/get_rj/get_rk` 增加了 `return`
   - `CPU.cpp` 中补上了构造和 `reset()` 的基本初始化逻辑
4. CMake 已改成直接编译 `cpu/CPU.cpp`、`cpu/decode.cpp`、`cpu/execute.cpp`。

## 当前状态

这个版本可以：

- 正常编译成员 B 的 `Memory / Loader / UART / main / tests`
- 和成员 A 当前的 CPU 目录一起完成工程级构建
- 通过成员 B 自测 `member_b_tests`

## 仍然需要你们后续继续补的地方

1. `cpu/decode.cpp` 里的 LoongArch opcode 常量现在仍是 TODO 占位值。
   这意味着工程虽然能编译，但要真正执行 LoongArch 指令，还需要你们根据课程给定编码表把真实编码补齐。
2. `tests/test_programs.h` 里的 `kSmokeProgramWords` 还是空的。
   等成员 A 确认指令编码后，再把冒烟程序的机器码填进去。

## Windows 构建命令

```powershell
mkdir build
cd build
cmake ..
cmake --build . --config Release
ctest -C Release --output-on-failure
```

## Linux / macOS 构建命令

```bash
mkdir build
cd build
cmake ..
cmake --build .
ctest --output-on-failure
```
