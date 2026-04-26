import pandas as pd
import os

data_dir = r'd:\trae_projects\solo_coder_04\solo_summary_charts\data'

# 获取所有 Excel 文件
excel_files = [f for f in os.listdir(data_dir) if f.endswith('.xlsx') or f.endswith('.xls')]
excel_files.sort()

print(f"找到 {len(excel_files)} 个 Excel 文件")
print("=" * 50)

# 读取第一个文件分析结构
if excel_files:
    first_file = os.path.join(data_dir, excel_files[0])
    print(f"\n分析文件: {excel_files[0]}")
    
    # 尝试读取 Excel 文件
    try:
        # 微信支付账单通常有头部说明，需要跳过
        # 先读取前 20 行看看结构
        df_head = pd.read_excel(first_file, nrows=20)
        print("\n文件前 20 行:")
        print(df_head.to_string())
        
        # 尝试查找实际数据开始的位置
        # 微信支付账单通常在第 16 行左右开始（0 索引）
        # 让我们尝试不同的跳过行数
        for skiprows in [0, 5, 10, 15, 16, 17, 18, 19, 20]:
            try:
                df = pd.read_excel(first_file, skiprows=skiprows)
                if len(df.columns) > 0 and not df.empty:
                    print(f"\n\n尝试跳过 {skiprows} 行:")
                    print(f"列名: {list(df.columns)}")
                    print(f"行数: {len(df)}")
                    if len(df) > 0:
                        print("\n前 5 行数据:")
                        print(df.head().to_string())
            except Exception as e:
                print(f"跳过 {skiprows} 行时出错: {e}")
                
    except Exception as e:
        print(f"读取文件时出错: {e}")
