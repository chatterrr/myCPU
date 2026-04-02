cmake_minimum_required(VERSION 3.16)
project(myCPU_loongarch_stage2 LANGUAGES CXX)

include(CTest)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

if (MSVC)
    add_compile_options(/utf-8 /W4 /permissive-)
else()
    add_compile_options(-Wall -Wextra -Wpedantic)
endif()

option(MYCPU_ENABLE_DEBUG_TRACE "Enable DEBUG_TRACE macro" OFF)

set(MYCPU_SUPPORT_SOURCES
    memory/memory.cpp
    loader/loader.cpp
    device/uart.cpp
    utils/debug.cpp
)

set(MYCPU_CPU_SOURCES
    cpu/CPU.cpp
    cpu/decode.cpp
    cpu/execute.cpp
)

add_library(member_b_support
    ${MYCPU_SUPPORT_SOURCES}
)

target_include_directories(member_b_support
    PUBLIC
        ${CMAKE_CURRENT_SOURCE_DIR}
)

if (MYCPU_ENABLE_DEBUG_TRACE)
    target_compile_definitions(member_b_support PUBLIC DEBUG_TRACE)
endif()

add_executable(mycpu
    main.cpp
    ${MYCPU_CPU_SOURCES}
)

target_link_libraries(mycpu PRIVATE member_b_support)
target_include_directories(mycpu PRIVATE ${CMAKE_CURRENT_SOURCE_DIR})

if (MYCPU_ENABLE_DEBUG_TRACE)
    target_compile_definitions(mycpu PRIVATE DEBUG_TRACE)
endif()

if (BUILD_TESTING)
    add_executable(member_b_tests
        tests/test_member_b.cpp
    )
    target_link_libraries(member_b_tests PRIVATE member_b_support)
    target_include_directories(member_b_tests PRIVATE ${CMAKE_CURRENT_SOURCE_DIR})

    add_executable(cpu_integration_tests
        tests/test_cpu_integration.cpp
        ${MYCPU_CPU_SOURCES}
    )
    target_link_libraries(cpu_integration_tests PRIVATE member_b_support)
    target_include_directories(cpu_integration_tests PRIVATE ${CMAKE_CURRENT_SOURCE_DIR})

    add_test(NAME member_b_tests COMMAND member_b_tests)
    add_test(NAME cpu_integration_tests COMMAND cpu_integration_tests)
endif()