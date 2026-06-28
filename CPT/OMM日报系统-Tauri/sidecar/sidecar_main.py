import sys
import json
import os
import re
import shutil
from datetime import datetime

# Ensure sidecar can import generate_report.py from same directory
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import generate_report as gr
from generate_report import (
    parse_all_folders,
    read_xlsx_quantity,
    schedule_tasks,
    generate_report,
    preview,
    set_work_dir,
    get_work_dir,
    refresh_template,
)


def handle_command(cmd: dict) -> dict:
    command = cmd.get("command")
    params = cmd.get("params", {})

    if command == "ping":
        return {"success": True, "data": {"pong": True}, "error": None}

    elif command == "parse_folders":
        base_dir = params["base_dir"]
        if not os.path.isdir(base_dir):
            return {"success": False, "data": None, "error": f"目录不存在: {base_dir}"}
        operator_name = params.get("operator_name", "禹欣")
        # work_dir is parent of base_dir
        work_dir = os.path.dirname(base_dir)
        set_work_dir(work_dir)
        records, review_map = parse_all_folders(base_dir, operator_name=operator_name)
        # Convert records to JSON-safe format
        safe_records = []
        for r in records:
            safe_r = {}
            for k, v in r.items():
                if isinstance(v, (str, int, float, bool)) or v is None:
                    safe_r[k] = v
                else:
                    safe_r[k] = str(v)
            safe_records.append(safe_r)
        return {
            "success": True,
            "data": {"records": safe_records, "review_map": review_map},
            "error": None,
        }

    elif command == "read_xlsx":
        xlsx_path = params["xlsx_path"]
        qty = read_xlsx_quantity(xlsx_path)
        return {
            "success": True,
            "data": {"quantity": qty, "is_standard": qty is not None},
            "error": None,
        }

    elif command == "generate":
        base_dir = params["base_dir"]
        records = params.get("records", [])
        settings = params.get("settings", {})
        if not os.path.isdir(base_dir):
            return {"success": False, "data": None, "error": f"目录不存在: {base_dir}"}
        # work_dir is parent of base_dir
        work_dir = os.path.dirname(base_dir)
        set_work_dir(work_dir)

        if not gr.TEMPLATE_PATH or not os.path.isfile(gr.TEMPLATE_PATH):
            return {
                "success": False,
                "data": None,
                "error": f"未找到模板文件，请在工作目录放置模板：{work_dir}",
            }

        # Normalize records from JSON (quantity may be string)
        valid_records = []
        for r in records:
            rec = dict(r)
            qty = rec.get("quantity")
            if isinstance(qty, str) and qty.isdigit():
                rec["quantity"] = int(qty)
            elif isinstance(qty, (int, float)):
                rec["quantity"] = int(qty)
            valid_records.append(rec)

        folder_name = os.path.basename(base_dir.rstrip("\\/"))
        shift_override = settings.get("shift_override")  # 'A' or 'B', or None
        shift_label = "B" if folder_name.upper().endswith("B") else "A"
        if shift_override in ("A", "B") and not folder_name.upper()[-1:] in ("A", "B"):
            shift_label = shift_override  # user override when folder name is ambiguous
        early_leave = bool(settings.get("early_leave", False))
        # 兼容旧 early_leave，新 leave_strategy 优先
        leave_strategy = settings.get("leave_strategy")
        if leave_strategy is None:
            leave_strategy = "early" if early_leave else "normal"
        if leave_strategy not in ("auto", "early", "normal"):
            leave_strategy = "normal"
        enable_hand = bool(settings.get("enable_hand", True))
        enable_other = bool(settings.get("enable_other", False))
        operator_name = settings.get("operator_name", "禹欣")
        output_dir = settings.get("output_dir") or base_dir
        tpp_min = float(settings.get("tpp_min", 3.0))
        tpp_max = float(settings.get("tpp_max", 7.0))
        pkg_rest = int(settings.get("pkg_rest", 0))
        special_items = settings.get("special_items") or None
        hand_max = float(settings.get("hand_max", 120))
        other_max = float(settings.get("other_max", 90))

        real_manual_tasks = settings.get("real_manual_tasks") or None

        segments, sched_warnings = schedule_tasks(
            valid_records,
            shift_label,
            early_leave=early_leave,
            leave_strategy=leave_strategy,
            tpp_min=tpp_min,
            tpp_max=tpp_max,
            pkg_rest=pkg_rest,
            enable_hand=enable_hand,
            enable_other=enable_other,
            special_items=special_items,
            hand_max=hand_max,
            other_max=other_max,
            real_manual_tasks=real_manual_tasks,
        )

        suffix = f"-{folder_name}"
        if leave_strategy == "early":
            suffix += "-下早班"

        m = re.match(r"(\d+)\.(\d+)", folder_name)
        if m:
            test_date = datetime(datetime.now().year, int(m.group(1)), int(m.group(2)))
        else:
            test_date = datetime.now()

        output_path = generate_report(
            valid_records,
            segments,
            test_date,
            suffix,
            operator_name=operator_name,
            output_dir=output_dir,
        )

        if output_path:
            return {
                "success": True,
                "data": {
                    "output_path": output_path,
                    "warnings": [],
                    "sched_warnings": sched_warnings,
                },
                "error": None,
            }
        else:
            return {
                "success": False,
                "data": None,
                "error": "报表生成失败，请检查模板和输入数据。",
            }

    elif command == "preview":
        base_dir = params["base_dir"]
        if not os.path.isdir(base_dir):
            return {"success": False, "data": None, "error": f"目录不存在: {base_dir}"}
        # work_dir is parent of base_dir
        work_dir = os.path.dirname(base_dir)
        set_work_dir(work_dir)

        records = params.get("records")
        # If records are provided, convert them back to proper format
        if records:
            valid_records = []
            for r in records:
                rec = dict(r)
                qty = rec.get("quantity")
                if isinstance(qty, str) and qty.isdigit():
                    rec["quantity"] = int(qty)
                elif isinstance(qty, (int, float)):
                    rec["quantity"] = int(qty)
                valid_records.append(rec)
            records = valid_records

        settings = params.get("settings", {})
        early_leave = bool(settings.get("early_leave", False))
        leave_strategy = settings.get("leave_strategy")
        if leave_strategy is None:
            leave_strategy = "early" if early_leave else "normal"
        if leave_strategy not in ("auto", "early", "normal"):
            leave_strategy = "normal"
        enable_hand = bool(settings.get("enable_hand", True))
        enable_other = bool(settings.get("enable_other", False))
        tpp_min = float(settings.get("tpp_min", 3.0))
        tpp_max = float(settings.get("tpp_max", 7.0))
        pkg_rest = int(settings.get("pkg_rest", 0))
        operator_name = settings.get("operator_name", "禹欣")
        shift_override = settings.get("shift_override")
        special_items = settings.get("special_items") or None
        hand_max = float(settings.get("hand_max", 120))
        other_max = float(settings.get("other_max", 90))
        real_manual_tasks = settings.get("real_manual_tasks") or None

        result = preview(base_dir, early_leave=early_leave, leave_strategy=leave_strategy,
                         tpp_min=tpp_min, tpp_max=tpp_max,
                         pkg_rest=pkg_rest,
                         enable_hand=enable_hand, enable_other=enable_other,
                         operator_name=operator_name, records=records,
                         shift_override=shift_override,
                         special_items=special_items,
                         hand_max=hand_max, other_max=other_max,
                         real_manual_tasks=real_manual_tasks)
        if result:
            return {"success": True, "data": result, "error": None}
        else:
            return {"success": False, "data": None, "error": "预览失败，请检查日志"}

    elif command == "get_config":
        return {
            "success": True,
            "data": {"work_dir": get_work_dir()},
            "error": None,
        }

    elif command == "get_template_info":
        """返回当前生效的模板信息：路径、来源、是否存在。"""
        tpl = gr.TEMPLATE_PATH
        if tpl and os.path.isfile(tpl):
            source = "unknown"
            if os.environ.get('YX_USER_TEMPLATE') == tpl:
                source = "user"
            elif os.environ.get('YX_BUNDLED_TEMPLATE') == tpl:
                source = "bundled"
            elif get_work_dir() and tpl.startswith(get_work_dir()):
                source = "workdir"
            return {
                "success": True,
                "data": {"path": tpl, "exists": True, "source": source},
                "error": None,
            }
        else:
            return {
                "success": True,
                "data": {"path": None, "exists": False, "source": None},
                "error": None,
            }

    elif command == "replace_template":
        """用户选择一个 xlsx 文件作为自定义模板。
        params: { "template_path": "C:/path/to/user.xlsx" }
        将文件复制到 app config 目录作为用户模板，并设置 YX_USER_TEMPLATE 环境变量。
        """
        src_path = params.get("template_path")
        if not src_path or not os.path.isfile(src_path):
            return {"success": False, "data": None, "error": f"模板文件不存在: {src_path}"}
        if not src_path.lower().endswith('.xlsx'):
            return {"success": False, "data": None, "error": "模板文件必须是 .xlsx 格式"}

        # 复制到 app config 目录（YX_USER_TEMPLATE_DIR 由 Rust 注入，缺省用工作目录）
        user_tpl_dir = os.environ.get('YX_USER_TEMPLATE_DIR')
        if not user_tpl_dir or not os.path.isdir(user_tpl_dir):
            user_tpl_dir = get_work_dir() or os.path.dirname(os.path.abspath(__file__))
        try:
            os.makedirs(user_tpl_dir, exist_ok=True)
        except OSError:
            pass
        dest = os.path.join(user_tpl_dir, "user_template.xlsx")
        try:
            shutil.copyfile(src_path, dest)
        except OSError as e:
            return {"success": False, "data": None, "error": f"复制模板失败: {e}"}

        os.environ['YX_USER_TEMPLATE'] = dest
        new_tpl = refresh_template()
        return {
            "success": True,
            "data": {"path": new_tpl, "source": "user" if new_tpl == dest else None},
            "error": None,
        }

    elif command == "reset_template":
        """重置为内置模板（清除用户自定义模板）。"""
        # 删除用户模板文件
        user_tpl_dir = os.environ.get('YX_USER_TEMPLATE_DIR')
        if user_tpl_dir:
            user_file = os.path.join(user_tpl_dir, "user_template.xlsx")
            if os.path.isfile(user_file):
                try:
                    os.remove(user_file)
                except OSError:
                    pass
        os.environ.pop('YX_USER_TEMPLATE', None)
        new_tpl = refresh_template()
        return {
            "success": True,
            "data": {"path": new_tpl},
            "error": None,
        }

    elif command == "save_config":
        # Config is managed by frontend/Rust, Python doesn't need to do much
        return {"success": True, "data": {}, "error": None}

    else:
        return {"success": False, "data": None, "error": f"Unknown command: {command}"}


def main():
    # 保存真正的 stdout fd（fd 1），用于写 JSON 响应。
    # 必须 dup，因为下面要把 sys.stdout 重定向到 stderr，防止
    # generate_report.py 里的 print() 污染 JSON 通信通道。
    real_stdout_fd = os.dup(1)

    # Set stdin/stderr to UTF-8
    sys.stdin = os.fdopen(sys.stdin.fileno(), "r", buffering=1, encoding="utf-8")
    sys.stderr = os.fdopen(sys.stderr.fileno(), "w", buffering=1, encoding="utf-8")

    # 关键：把 sys.stdout 重定向到 stderr，这样 generate_report.py 里
    # 所有的 print() 都输出到 stderr（被 Rust 端的 stderr 线程捕获），
    # 不会污染 stdout 的 JSON 响应流。
    sys.stdout = sys.stderr

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            cmd = json.loads(line)
            result = handle_command(cmd)
        except json.JSONDecodeError as e:
            result = {"success": False, "data": None, "error": f"Invalid JSON: {e}"}
        except Exception as e:
            import traceback
            traceback.print_exc(file=sys.stderr)
            result = {
                "success": False,
                "data": None,
                "error": str(e),
            }

        # Write JSON response directly to the real stdout fd (保存的副本),
        # 绕过已被重定向到 stderr 的 sys.stdout。
        response_line = json.dumps(result, ensure_ascii=False)
        os.write(real_stdout_fd, (response_line + "\n").encode("utf-8"))


if __name__ == "__main__":
    main()
