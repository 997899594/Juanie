#!/usr/bin/env python3
"""
自动删除 Vue 文件中未使用的导入
"""
import re
import sys
from pathlib import Path

def get_unused_imports(file_path):
    """从 TypeScript 错误中提取未使用的导入"""
    import subprocess
    result = subprocess.run(
        ['bun', 'run', 'type-check'],
        cwd='apps/web',
        capture_output=True,
        text=True
    )
    
    unused = []
    for line in result.stderr.split('\n'):
        if 'TS6133' in line and str(file_path) in line:
            # 提取变量名
            match = re.search(r"'(\w+)' is declared but", line)
            if match:
                unused.append(match.group(1))
    
    return unused

def remove_unused_from_import(content, unused_names):
    """从导入语句中删除未使用的名称"""
    lines = content.split('\n')
    result = []
    
    for line in lines:
        if 'import' in line and any(name in line for name in unused_names):
            # 处理单行导入
            if '{' in line and '}' in line:
                # 提取导入的名称
                match = re.search(r'\{([^}]+)\}', line)
                if match:
                    imports = [i.strip() for i in match.group(1).split(',')]
                    # 过滤掉未使用的
                    used_imports = [i for i in imports if i.split()[0] not in unused_names]
                    
                    if used_imports:
                        # 重建导入语句
                        new_imports = ', '.join(used_imports)
                        line = re.sub(r'\{[^}]+\}', f'{{{new_imports}}}', line)
                        result.append(line)
                    # 如果所有导入都未使用，跳过这一行
                else:
                    result.append(line)
            else:
                result.append(line)
        else:
            result.append(line)
    
    return '\n'.join(result)

def main():
    # 获取问题最多的文件
    problem_files = [
        'apps/web/src/views/ai/AIAssistants.vue',
        'apps/web/src/views/Repositories.vue',
    ]
    
    for file_path in problem_files:
        path = Path(file_path)
        if not path.exists():
            continue
            
        print(f"Processing {file_path}...")
        
        # 读取文件
        content = path.read_text()
        
        # 获取未使用的导入
        unused = get_unused_imports(path)
        if not unused:
            continue
            
        print(f"  Found unused: {', '.join(unused)}")
        
        # 删除未使用的导入
        new_content = remove_unused_from_import(content, unused)
        
        # 写回文件
        path.write_text(new_content)
        print(f"  ✓ Cleaned")

if __name__ == '__main__':
    main()
