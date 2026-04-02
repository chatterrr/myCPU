#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from __future__ import annotations

import json
import os
import sys
import tkinter as tk
from tkinter import filedialog, messagebox, ttk
from typing import Any, Dict, List, Optional, Tuple

TraceRecord = Dict[str, Any]


def parse_int(value: Any) -> Optional[int]:
    if value is None:
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return None
        try:
            return int(text, 0)
        except ValueError:
            return None
    return None


def format_hex32(value: int) -> str:
    return f"0x{value & 0xFFFFFFFF:08X}"


class TraceModel:
    def __init__(self) -> None:
        self.path: str = ""
        self.meta: Dict[str, Any] = {}
        self.steps: List[TraceRecord] = []
        self.summary: Dict[str, Any] = {}
        self.reg_states: List[List[int]] = []
        self.uart_text_per_step: List[str] = []

    def clear(self) -> None:
        self.__init__()

    def load_jsonl(self, path: str) -> None:
        self.clear()
        self.path = path

        with open(path, "r", encoding="utf-8") as f:
            for lineno, raw_line in enumerate(f, start=1):
                line = raw_line.strip()
                if not line:
                    continue
                try:
                    obj = json.loads(line)
                except json.JSONDecodeError as e:
                    raise ValueError(f"JSON parse error at line {lineno}: {e}") from e

                rec_type = obj.get("type")
                if rec_type == "meta":
                    self.meta = obj
                elif rec_type == "step":
                    self.steps.append(obj)
                elif rec_type == "summary":
                    self.summary = obj

        if not self.steps:
            raise ValueError("No step records found in trace file.")

        self._build_reg_states()
        self._build_uart_text()

    def _build_reg_states(self) -> None:
        current = [0] * 32
        self.reg_states = []

        for step in self.steps:
            changes = step.get("gpr_changes") or []
            for item in changes:
                reg = parse_int(item.get("reg"))
                value = parse_int(item.get("value"))
                if reg is None or value is None:
                    continue
                if 0 <= reg < 32:
                    current[reg] = value & 0xFFFFFFFF
            self.reg_states.append(current.copy())

    def _build_uart_text(self) -> None:
        current = ""
        self.uart_text_per_step = []

        for step in self.steps:
            uart = step.get("uart")
            if uart:
                if isinstance(uart, str):
                    current += uart
                elif isinstance(uart, dict):
                    if "text" in uart and isinstance(uart["text"], str):
                        current += uart["text"]
                    elif "char" in uart and isinstance(uart["char"], str):
                        current += uart["char"]
                    elif "value" in uart:
                        iv = parse_int(uart["value"])
                        if iv is not None:
                            current += chr(iv & 0xFF)
            self.uart_text_per_step.append(current)

    def get_step_title(self, index: int) -> str:
        step = self.steps[index]
        step_no = step.get("step", index)
        pc = step.get("pc", "N/A")
        op = step.get("op", "UNKNOWN")
        return f"{step_no:>3}  {pc:<12}  {op}"

    def get_reg_state(self, index: int) -> List[int]:
        return self.reg_states[index]

    def get_uart_text(self, index: int) -> str:
        return self.uart_text_per_step[index]


class TraceViewerApp:
    def __init__(self, root: tk.Tk, initial_path: Optional[str] = None) -> None:
        self.root = root
        self.root.title("myCPU Trace Viewer")
        self.root.geometry("1360x860")
        self.root.minsize(1150, 720)

        self.model = TraceModel()
        self.current_index = 0
        self.is_playing = False
        self.play_interval_ms = 600

        self._build_ui()

        if initial_path:
            self.open_trace(initial_path)

    def _build_ui(self) -> None:
        self.root.rowconfigure(1, weight=1)
        self.root.columnconfigure(0, weight=1)

        top_bar = ttk.Frame(self.root, padding=(10, 10, 10, 6))
        top_bar.grid(row=0, column=0, sticky="ew")
        top_bar.columnconfigure(2, weight=1)

        ttk.Button(top_bar, text="Open Trace...", command=self.open_dialog).grid(row=0, column=0, padx=(0, 8))
        ttk.Button(top_bar, text="Reload", command=self.reload_current).grid(row=0, column=1, padx=(0, 12))

        self.path_var = tk.StringVar(value="No trace loaded")
        ttk.Entry(top_bar, textvariable=self.path_var).grid(row=0, column=2, sticky="ew", padx=(0, 12))

        self.step_pos_var = tk.StringVar(value="Step - / -")
        ttk.Label(top_bar, textvariable=self.step_pos_var).grid(row=0, column=3, padx=(0, 12))

        ttk.Button(top_bar, text="Reset", command=self.reset_step).grid(row=0, column=4, padx=(0, 6))
        ttk.Button(top_bar, text="Prev", command=self.prev_step).grid(row=0, column=5, padx=(0, 6))
        ttk.Button(top_bar, text="Next", command=self.next_step).grid(row=0, column=6, padx=(0, 6))

        self.play_btn = ttk.Button(top_bar, text="Play", command=self.toggle_play)
        self.play_btn.grid(row=0, column=7)

        self.main_pane = ttk.Panedwindow(self.root, orient=tk.HORIZONTAL)
        self.main_pane.grid(row=1, column=0, sticky="nsew", padx=10, pady=(0, 10))

        left_frame = ttk.Frame(self.main_pane, padding=8)
        left_frame.rowconfigure(1, weight=1)
        left_frame.columnconfigure(0, weight=1)

        ttk.Label(left_frame, text="Steps", font=("", 11, "bold")).grid(row=0, column=0, sticky="w", pady=(0, 6))

        self.step_listbox = tk.Listbox(left_frame, activestyle="dotbox", exportselection=False)
        self.step_listbox.grid(row=1, column=0, sticky="nsew")
        self.step_listbox.bind("<<ListboxSelect>>", self.on_step_selected)

        step_scroll = ttk.Scrollbar(left_frame, orient="vertical", command=self.step_listbox.yview)
        step_scroll.grid(row=1, column=1, sticky="ns")
        self.step_listbox.configure(yscrollcommand=step_scroll.set)

        self.main_pane.add(left_frame, weight=1)

        right_frame = ttk.Frame(self.main_pane, padding=8)
        right_frame.rowconfigure(2, weight=1)
        right_frame.columnconfigure(0, weight=1)

        meta_box = ttk.LabelFrame(right_frame, text="Trace Meta", padding=8)
        meta_box.grid(row=0, column=0, sticky="ew", pady=(0, 8))
        meta_box.columnconfigure(1, weight=1)

        self.meta_program_var = tk.StringVar(value="-")
        self.meta_base_var = tk.StringVar(value="-")
        self.meta_entry_var = tk.StringVar(value="-")
        self.meta_max_steps_var = tk.StringVar(value="-")

        self._add_kv(meta_box, 0, "Program", self.meta_program_var)
        self._add_kv(meta_box, 1, "Load base", self.meta_base_var)
        self._add_kv(meta_box, 2, "Entry PC", self.meta_entry_var)
        self._add_kv(meta_box, 3, "Max steps", self.meta_max_steps_var)

        detail_box = ttk.LabelFrame(right_frame, text="Current Step", padding=8)
        detail_box.grid(row=1, column=0, sticky="ew", pady=(0, 8))
        for c in range(4):
            detail_box.columnconfigure(c, weight=1)

        self.step_no_var = tk.StringVar(value="-")
        self.pc_var = tk.StringVar(value="-")
        self.raw_var = tk.StringVar(value="-")
        self.op_var = tk.StringVar(value="-")
        self.rd_var = tk.StringVar(value="-")
        self.rj_var = tk.StringVar(value="-")
        self.rk_var = tk.StringVar(value="-")
        self.imm_var = tk.StringVar(value="-")
        self.next_pc_var = tk.StringVar(value="-")
        self.running_var = tk.StringVar(value="-")
        self.exit_code_var = tk.StringVar(value="-")
        self.branched_var = tk.StringVar(value="-")
        self.gpr_changes_var = tk.StringVar(value="-")
        self.mem_write_var = tk.StringVar(value="-")
        self.uart_step_var = tk.StringVar(value="-")

        self._add_kv(detail_box, 0, "Step", self.step_no_var, 0)
        self._add_kv(detail_box, 0, "PC", self.pc_var, 2)
        self._add_kv(detail_box, 1, "Raw", self.raw_var, 0)
        self._add_kv(detail_box, 1, "Op", self.op_var, 2)
        self._add_kv(detail_box, 2, "rd", self.rd_var, 0)
        self._add_kv(detail_box, 2, "rj", self.rj_var, 2)
        self._add_kv(detail_box, 3, "rk", self.rk_var, 0)
        self._add_kv(detail_box, 3, "imm", self.imm_var, 2)
        self._add_kv(detail_box, 4, "Next PC", self.next_pc_var, 0)
        self._add_kv(detail_box, 4, "Running", self.running_var, 2)
        self._add_kv(detail_box, 5, "Exit code", self.exit_code_var, 0)
        self._add_kv(detail_box, 5, "Branched", self.branched_var, 2)
        self._add_kv(detail_box, 6, "UART(step)", self.uart_step_var, 0, span=4)
        self._add_kv(detail_box, 7, "GPR changes", self.gpr_changes_var, 0, span=4)
        self._add_kv(detail_box, 8, "Mem write", self.mem_write_var, 0, span=4)

        bottom_pane = ttk.Panedwindow(right_frame, orient=tk.VERTICAL)
        bottom_pane.grid(row=2, column=0, sticky="nsew")

        upper_bottom = ttk.Panedwindow(bottom_pane, orient=tk.HORIZONTAL)

        regs_box = ttk.LabelFrame(upper_bottom, text="Register State", padding=8)
        regs_box.rowconfigure(0, weight=1)
        regs_box.columnconfigure(0, weight=1)

        self.reg_tree = ttk.Treeview(
            regs_box,
            columns=("reg", "value"),
            show="headings",
            height=16,
        )
        self.reg_tree.heading("reg", text="Register")
        self.reg_tree.heading("value", text="Value")
        self.reg_tree.column("reg", width=100, anchor="center")
        self.reg_tree.column("value", width=180, anchor="center")
        self.reg_tree.grid(row=0, column=0, sticky="nsew")

        reg_scroll = ttk.Scrollbar(regs_box, orient="vertical", command=self.reg_tree.yview)
        reg_scroll.grid(row=0, column=1, sticky="ns")
        self.reg_tree.configure(yscrollcommand=reg_scroll.set)

        uart_box = ttk.LabelFrame(upper_bottom, text="UART Output", padding=8)
        uart_box.rowconfigure(0, weight=1)
        uart_box.columnconfigure(0, weight=1)

        self.uart_text = tk.Text(uart_box, wrap="word", height=10)
        self.uart_text.grid(row=0, column=0, sticky="nsew")
        self.uart_text.configure(state="disabled")

        uart_scroll = ttk.Scrollbar(uart_box, orient="vertical", command=self.uart_text.yview)
        uart_scroll.grid(row=0, column=1, sticky="ns")
        self.uart_text.configure(yscrollcommand=uart_scroll.set)

        upper_bottom.add(regs_box, weight=1)
        upper_bottom.add(uart_box, weight=1)

        summary_box = ttk.LabelFrame(bottom_pane, text="Summary", padding=8)
        summary_box.rowconfigure(0, weight=1)
        summary_box.columnconfigure(0, weight=1)

        self.summary_text = tk.Text(summary_box, wrap="word", height=8)
        self.summary_text.grid(row=0, column=0, sticky="nsew")
        self.summary_text.configure(state="disabled")

        summary_scroll = ttk.Scrollbar(summary_box, orient="vertical", command=self.summary_text.yview)
        summary_scroll.grid(row=0, column=1, sticky="ns")
        self.summary_text.configure(yscrollcommand=summary_scroll.set)

        bottom_pane.add(upper_bottom, weight=3)
        bottom_pane.add(summary_box, weight=1)

        self.main_pane.add(right_frame, weight=3)

    def _add_kv(
        self,
        parent: ttk.Widget,
        row: int,
        label: str,
        variable: tk.StringVar,
        column: int = 0,
        span: int = 2,
    ) -> None:
        ttk.Label(parent, text=f"{label}:").grid(row=row, column=column, sticky="w", padx=(0, 8), pady=2)
        ttk.Label(parent, textvariable=variable).grid(
            row=row,
            column=column + 1,
            columnspan=span - 1,
            sticky="w",
            pady=2,
        )

    def open_dialog(self) -> None:
        path = filedialog.askopenfilename(
            title="Open trace JSONL",
            filetypes=[("JSONL files", "*.jsonl"), ("All files", "*.*")],
        )
        if path:
            self.open_trace(path)

    def reload_current(self) -> None:
        if self.model.path:
            self.open_trace(self.model.path)

    def open_trace(self, path: str) -> None:
        try:
            self.model.load_jsonl(path)
        except Exception as e:
            messagebox.showerror("Trace Viewer", str(e))
            return

        self.is_playing = False
        self.play_btn.configure(text="Play")

        self.path_var.set(os.path.abspath(path))
        self._refresh_meta()
        self._refresh_step_list()
        self._refresh_summary()
        self.show_step(0)

    def _refresh_meta(self) -> None:
        meta = self.model.meta
        self.meta_program_var.set(str(meta.get("program", "-")))
        self.meta_base_var.set(str(meta.get("load_base", "-")))
        self.meta_entry_var.set(str(meta.get("entry_pc", "-")))
        self.meta_max_steps_var.set(str(meta.get("max_steps", "-")))

    def _refresh_step_list(self) -> None:
        self.step_listbox.delete(0, tk.END)
        for i in range(len(self.model.steps)):
            self.step_listbox.insert(tk.END, self.model.get_step_title(i))

    def _refresh_summary(self) -> None:
        summary = self.model.summary
        lines: List[str] = []

        if not summary:
            lines.append("No summary record found.")
        else:
            lines.append(f"PC: {summary.get('pc', '-')}")
            lines.append(f"Last instruction: {summary.get('last_inst', '-')}")
            lines.append(f"Running: {summary.get('running', '-')}")
            lines.append(f"Exit code: {summary.get('exit_code', '-')}")
            regs = summary.get("regs")
            if isinstance(regs, list) and regs:
                lines.append("")
                lines.append("Final registers:")
                for i, value in enumerate(regs):
                    lines.append(f"r{i:02d} = {value}")

        self._set_text_widget(self.summary_text, "\n".join(lines))

    def on_step_selected(self, _event: tk.Event) -> None:
        sel = self.step_listbox.curselection()
        if not sel:
            return
        self.show_step(sel[0])

    def reset_step(self) -> None:
        if not self.model.steps:
            return
        self.show_step(0)

    def prev_step(self) -> None:
        if not self.model.steps:
            return
        self.show_step(max(0, self.current_index - 1))

    def next_step(self) -> None:
        if not self.model.steps:
            return
        self.show_step(min(len(self.model.steps) - 1, self.current_index + 1))

    def toggle_play(self) -> None:
        if not self.model.steps:
            return
        self.is_playing = not self.is_playing
        self.play_btn.configure(text="Pause" if self.is_playing else "Play")
        if self.is_playing:
            self._auto_advance()

    def _auto_advance(self) -> None:
        if not self.is_playing:
            return
        if self.current_index >= len(self.model.steps) - 1:
            self.is_playing = False
            self.play_btn.configure(text="Play")
            return
        self.show_step(self.current_index + 1)
        self.root.after(self.play_interval_ms, self._auto_advance)

    def show_step(self, index: int) -> None:
        if not self.model.steps:
            return
        if not (0 <= index < len(self.model.steps)):
            return

        self.current_index = index
        self.step_pos_var.set(f"Step {index + 1} / {len(self.model.steps)}")

        self.step_listbox.selection_clear(0, tk.END)
        self.step_listbox.selection_set(index)
        self.step_listbox.see(index)

        step = self.model.steps[index]
        self.step_no_var.set(str(step.get("step", index)))
        self.pc_var.set(str(step.get("pc", "-")))
        self.raw_var.set(str(step.get("raw", "-")))
        self.op_var.set(str(step.get("op", "-")))
        self.rd_var.set(str(step.get("rd", "-")))
        self.rj_var.set(str(step.get("rj", "-")))
        self.rk_var.set(str(step.get("rk", "-")))
        self.imm_var.set(str(step.get("imm", "-")))
        self.next_pc_var.set(str(step.get("next_pc", "-")))
        self.running_var.set(str(step.get("running", "-")))
        self.exit_code_var.set(str(step.get("exit_code", "-")))
        self.branched_var.set(str(step.get("branched", "-")))
        self.uart_step_var.set(str(step.get("uart", "-")))

        changes = step.get("gpr_changes") or []
        if changes:
            rendered = ", ".join(
                f"r{parse_int(item.get('reg'))}: {item.get('value')}"
                for item in changes
                if parse_int(item.get("reg")) is not None
            )
        else:
            rendered = "-"
        self.gpr_changes_var.set(rendered)

        mem_write = step.get("mem_write")
        if mem_write is not None:
            self.mem_write_var.set(json.dumps(mem_write, ensure_ascii=False))
        else:
            self.mem_write_var.set("-")

        self._refresh_reg_view(index)
        self._refresh_uart_view(index)

    def _refresh_reg_view(self, index: int) -> None:
        for item in self.reg_tree.get_children():
            self.reg_tree.delete(item)

        regs = self.model.get_reg_state(index)
        changed_regs = {
            parse_int(item.get("reg"))
            for item in (self.model.steps[index].get("gpr_changes") or [])
        }

        for i, value in enumerate(regs):
            tags: Tuple[str, ...] = ("changed",) if i in changed_regs else ()
            self.reg_tree.insert("", tk.END, values=(f"r{i:02d}", format_hex32(value)), tags=tags)

        self.reg_tree.tag_configure("changed", background="#fff2a8")

    def _refresh_uart_view(self, index: int) -> None:
        text = self.model.get_uart_text(index)
        self._set_text_widget(self.uart_text, text)

    @staticmethod
    def _set_text_widget(widget: tk.Text, content: str) -> None:
        widget.configure(state="normal")
        widget.delete("1.0", tk.END)
        widget.insert("1.0", content)
        widget.configure(state="disabled")


def main() -> int:
    initial_path = sys.argv[1] if len(sys.argv) > 1 else None
    root = tk.Tk()
    app = TraceViewerApp(root, initial_path=initial_path)
    root.mainloop()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())