import pandas as pd
import os
from datetime import datetime

DATA_DIR = r'd:\trae_projects\solo_coder_04\solo_summary_charts\data'

def load_all_data():
    """加载所有 Excel 文件并合并数据"""
    all_data = []
    
    # 获取所有 Excel 文件
    excel_files = [f for f in os.listdir(DATA_DIR) if f.endswith('.xlsx') or f.endswith('.xls')]
    excel_files.sort()
    
    for file in excel_files:
        file_path = os.path.join(DATA_DIR, file)
        try:
            # 微信支付账单通常在第 16 行（0 索引）开始有数据
            # 第 16 行是表头
            df = pd.read_excel(file_path, skiprows=16)
            
            # 检查是否有数据
            if not df.empty:
                # 重命名列名（处理可能的空格）
                df.columns = [col.strip() for col in df.columns]
                
                # 添加到合并数据
                all_data.append(df)
                print(f"成功加载文件: {file}, 行数: {len(df)}")
        except Exception as e:
            print(f"加载文件 {file} 时出错: {e}")
    
    # 合并所有数据
    if all_data:
        combined_df = pd.concat(all_data, ignore_index=True)
        print(f"\n总数据行数: {len(combined_df)}")
        return combined_df
    else:
        return pd.DataFrame()

def clean_data(df):
    """清洗和预处理数据"""
    if df.empty:
        return df
    
    # 复制数据以避免修改原始数据
    df = df.copy()
    
    # 1. 处理金额列 - 移除 ¥ 符号并转换为数值
    if '金额(元)' in df.columns:
        # 移除 ¥ 符号和空格
        df['金额(元)'] = df['金额(元)'].astype(str).str.replace('¥', '', regex=False)
        df['金额(元)'] = df['金额(元)'].str.strip()
        # 转换为数值
        df['金额(元)'] = pd.to_numeric(df['金额(元)'], errors='coerce')
    
    # 2. 处理交易时间 - 转换为 datetime
    if '交易时间' in df.columns:
        df['交易时间'] = pd.to_datetime(df['交易时间'], errors='coerce')
        
        # 提取时间维度
        df['年份'] = df['交易时间'].dt.year
        df['月份'] = df['交易时间'].dt.month
        df['日期'] = df['交易时间'].dt.date
        df['星期'] = df['交易时间'].dt.day_name()
        df['季度'] = df['交易时间'].dt.quarter
    
    # 3. 处理空值
    # 对于字符串列，用空字符串填充
    str_columns = ['交易类型', '交易对方', '商品', '收/支', '支付方式', '当前状态', '备注']
    for col in str_columns:
        if col in df.columns:
            df[col] = df[col].fillna('')
    
    # 4. 过滤掉无效数据（金额为空或交易时间为空）
    if '金额(元)' in df.columns and '交易时间' in df.columns:
        df = df.dropna(subset=['金额(元)', '交易时间'])
    
    return df

def get_summary_stats(df):
    """获取汇总统计数据"""
    if df.empty:
        return {}
    
    summary = {
        '总交易笔数': int(len(df)),
        '总收入': 0.0,
        '总支出': 0.0,
        '净收入': 0.0,
        '收入笔数': 0,
        '支出笔数': 0,
        '中性交易笔数': 0,
        '交易类型分布': {},
        '支付方式分布': {},
        '时间范围': {}
    }
    
    # 计算收入和支出
    if '收/支' in df.columns and '金额(元)' in df.columns:
        # 收入
        income_mask = df['收/支'] == '收入'
        summary['总收入'] = float(df[income_mask]['金额(元)'].sum())
        summary['收入笔数'] = int(income_mask.sum())
        
        # 支出
        expense_mask = df['收/支'] == '支出'
        summary['总支出'] = float(df[expense_mask]['金额(元)'].sum())
        summary['支出笔数'] = int(expense_mask.sum())
        
        # 净收入
        summary['净收入'] = summary['总收入'] - summary['总支出']
        
        # 中性交易
        neutral_mask = ~(income_mask | expense_mask)
        summary['中性交易笔数'] = int(neutral_mask.sum())
    
    # 交易类型分布
    if '交易类型' in df.columns:
        type_counts = df['交易类型'].value_counts().head(10)
        summary['交易类型分布'] = {str(k): int(v) for k, v in type_counts.items()}
    
    # 支付方式分布
    if '支付方式' in df.columns:
        pay_counts = df['支付方式'].value_counts().head(10)
        summary['支付方式分布'] = {str(k): int(v) for k, v in pay_counts.items()}
    
    # 时间范围
    if '交易时间' in df.columns:
        min_time = df['交易时间'].min()
        max_time = df['交易时间'].max()
        summary['时间范围'] = {
            '开始': min_time.strftime('%Y-%m-%d') if pd.notna(min_time) else '',
            '结束': max_time.strftime('%Y-%m-%d') if pd.notna(max_time) else ''
        }
    
    return summary

def get_time_series_data(df, freq='M'):
    """
    获取时间序列数据
    
    参数:
        df: 数据框
        freq: 频率 ('D'=日, 'W'=周, 'M'=月, 'Q'=季度, 'Y'=年)
    """
    if df.empty or '交易时间' not in df.columns:
        return []
    
    # 映射旧频率到新频率（pandas 3.0+ 版本要求）
    freq_mapping = {
        'D': 'D',    # 日 - 保持不变
        'W': 'W',    # 周 - 保持不变
        'M': 'ME',   # 月 - 月末
        'Q': 'QE',   # 季度 - 季度末
        'Y': 'YE'    # 年 - 年末
    }
    resample_freq = freq_mapping.get(freq, freq)
    
    df = df.copy()
    df = df.set_index('交易时间')
    
    # 按频率分组
    time_groups = df.resample(resample_freq)
    
    result = []
    for time_period, group in time_groups:
        if len(group) > 0:
            # 计算收入
            income = group[group['收/支'] == '收入']['金额(元)'].sum()
            # 计算支出
            expense = group[group['收/支'] == '支出']['金额(元)'].sum()
            
            # 格式化时间标签
            if freq == 'D':
                label = time_period.strftime('%Y-%m-%d')
            elif freq == 'W':
                label = time_period.strftime('%Y年第%W周')
            elif freq == 'M':
                label = time_period.strftime('%Y-%m')
            elif freq == 'Q':
                label = f"{time_period.year}Q{time_period.quarter}"
            elif freq == 'Y':
                label = str(time_period.year)
            else:
                label = time_period.strftime('%Y-%m-%d')
            
            result.append({
                '时间': label,
                '收入': float(income),
                '支出': float(expense),
                '净收入': float(income - expense),
                '交易笔数': int(len(group))
            })
    
    return result

def get_transaction_type_data(df):
    """获取按交易类型分组的数据"""
    if df.empty or '交易类型' not in df.columns:
        return []
    
    # 按交易类型分组
    type_groups = df.groupby('交易类型')
    
    result = []
    for trans_type, group in type_groups:
        if trans_type:  # 跳过空类型
            income = group[group['收/支'] == '收入']['金额(元)'].sum()
            expense = group[group['收/支'] == '支出']['金额(元)'].sum()
            
            result.append({
                '交易类型': str(trans_type),
                '总收入': float(income),
                '总支出': float(expense),
                '净收入': float(income - expense),
                '交易笔数': int(len(group)),
                '平均金额': float(group['金额(元)'].mean()) if len(group) > 0 else 0
            })
    
    # 按交易笔数排序
    result.sort(key=lambda x: x['交易笔数'], reverse=True)
    return result

def get_counterparty_data(df, top_n=50, sort_by='count'):
    """获取按交易对方分组的数据（前 N 个）
    
    参数:
        df: 数据框
        top_n: 返回前 N 个
        sort_by: 排序方式 ('count'=按交易笔数, 'amount'=按交易金额)
    """
    if df.empty or '交易对方' not in df.columns:
        return []
    
    # 按交易对方分组
    counterparty_groups = df.groupby('交易对方')
    
    result = []
    for counterparty, group in counterparty_groups:
        if counterparty and counterparty != '/':  # 跳过空值和 '/'
            income = group[group['收/支'] == '收入']['金额(元)'].sum()
            expense = group[group['收/支'] == '支出']['金额(元)'].sum()
            total_amount = abs(income) + abs(expense)
            
            result.append({
                '交易对方': str(counterparty),
                '总收入': float(income),
                '总支出': float(expense),
                '净收入': float(income - expense),
                '交易笔数': int(len(group)),
                '交易金额': float(total_amount)
            })
    
    # 按指定方式排序
    if sort_by == 'amount':
        result.sort(key=lambda x: x['交易金额'], reverse=True)
    else:
        result.sort(key=lambda x: x['交易笔数'], reverse=True)
    
    return result[:top_n]

def get_payment_method_data(df):
    """获取按支付方式分组的数据"""
    if df.empty or '支付方式' not in df.columns:
        return []
    
    # 按支付方式分组
    pay_groups = df.groupby('支付方式')
    
    result = []
    for pay_method, group in pay_groups:
        if pay_method and pay_method != '/':  # 跳过空值和 '/'
            income = group[group['收/支'] == '收入']['金额(元)'].sum()
            expense = group[group['收/支'] == '支出']['金额(元)'].sum()
            
            result.append({
                '支付方式': str(pay_method),
                '总收入': float(income),
                '总支出': float(expense),
                '净收入': float(income - expense),
                '交易笔数': int(len(group))
            })
    
    # 按交易笔数排序
    result.sort(key=lambda x: x['交易笔数'], reverse=True)
    return result

def filter_data(df, start_date=None, end_date=None, trans_type=None, trans_direction=None):
    """
    过滤数据
    
    参数:
        df: 数据框
        start_date: 开始日期 (YYYY-MM-DD)
        end_date: 结束日期 (YYYY-MM-DD)
        trans_type: 交易类型
        trans_direction: 交易方向 ('收入', '支出', '全部')
    """
    if df.empty:
        return df
    
    filtered = df.copy()
    
    # 按日期过滤
    if start_date and '交易时间' in filtered.columns:
        start_dt = pd.to_datetime(start_date)
        filtered = filtered[filtered['交易时间'] >= start_dt]
    
    if end_date and '交易时间' in filtered.columns:
        end_dt = pd.to_datetime(end_date) + pd.Timedelta(days=1)  # 包含结束日期
        filtered = filtered[filtered['交易时间'] < end_dt]
    
    # 按交易类型过滤
    if trans_type and '交易类型' in filtered.columns:
        filtered = filtered[filtered['交易类型'] == trans_type]
    
    # 按交易方向过滤
    if trans_direction and trans_direction != '全部' and '收/支' in filtered.columns:
        if trans_direction == '收入':
            filtered = filtered[filtered['收/支'] == '收入']
        elif trans_direction == '支出':
            filtered = filtered[filtered['收/支'] == '支出']
    
    return filtered

# 全局变量，缓存数据
_cached_df = None
_cached_clean_df = None

def get_cached_data():
    """获取缓存的数据，如果没有则加载"""
    global _cached_df, _cached_clean_df
    
    if _cached_df is None:
        print("正在加载数据...")
        _cached_df = load_all_data()
        print("正在清洗数据...")
        _cached_clean_df = clean_data(_cached_df)
        print(f"数据加载完成，共 {len(_cached_clean_df)} 条有效记录")
    
    return _cached_clean_df

def reload_data():
    """重新加载数据"""
    global _cached_df, _cached_clean_df
    _cached_df = None
    _cached_clean_df = None
    return get_cached_data()

def get_transactions_list(df):
    """
    获取交易记录列表（用于表格展示）
    
    返回格式化后的交易数据列表
    """
    if df.empty:
        return []
    
    # 选择需要的列
    columns = ['交易时间', '交易类型', '交易对方', '商品', '收/支', '金额(元)', '支付方式', '当前状态', '备注']
    available_columns = [col for col in columns if col in df.columns]
    
    # 复制数据并处理
    result_df = df[available_columns].copy()
    
    # 格式化交易时间
    if '交易时间' in result_df.columns:
        result_df['交易时间'] = result_df['交易时间'].dt.strftime('%Y-%m-%d %H:%M:%S')
    
    # 转换为字典列表
    result = result_df.to_dict('records')
    
    return result
